from __future__ import annotations

from datetime import datetime, timezone
from time import perf_counter
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from ..auth import Actor
from ..intent import classify_intent
from ..llm import generate_json
from ..logging_config import logger
from ..models import Action, Approval, AuditRecord, Customer, RunDecision, RunEvidence, UsageMetric, WorkflowRun
from ..reasoning import analyst_stage, arbiter_stage, comms_summary, planner_stage, risk_stage
from ..retrieval import retrieve_evidence
from ..schemas import (
    ActionResult,
    ApprovalRequest,
    ArbiterDecision,
    AuditRecord as AuditRecordSchema,
    EvidenceItem,
    PlannerOutput,
    RiskReview,
    TargetEntity,
    WorkflowRequest,
    WorkflowResponse,
)


def _target_customer(session: Session, payload: WorkflowRequest) -> Customer:
    if payload.focusCustomerId:
        customer = session.get(Customer, payload.focusCustomerId)
        if customer is not None:
            return customer
    customer = session.scalar(select(Customer).order_by(desc(Customer.churn_probability)).limit(1))
    if customer is None:
        raise HTTPException(status_code=400, detail="No customers available")
    return customer


def _isoformat(value: datetime | None) -> str:
    if value is None:
        return datetime.now(timezone.utc).isoformat()
    return value.isoformat()


def _latest_usage(session: Session, customer_id: str):
    metric = session.scalar(select(UsageMetric).where(UsageMetric.customer_id == customer_id).order_by(desc(UsageMetric.created_at)).limit(1))
    if metric is None:
        raise HTTPException(status_code=400, detail=f"No usage metric for customer {customer_id}")
    return metric


def _approval_schema(approval: Approval, customer: Customer) -> ApprovalRequest:
    return ApprovalRequest(
        id=approval.id,
        runId=approval.run_id,
        customerId=approval.customer_id,
        customerName=customer.name,
        actionTitle=approval.action_title,
        owner=approval.owner,
        priority=approval.priority,  # type: ignore[arg-type]
        status=approval.status,  # type: ignore[arg-type]
        rationale=approval.rationale,
        estimatedImpact=approval.estimated_impact,
        dueLabel=approval.due_label,
        createdAt=_isoformat(approval.created_at),
        actorIdCreatedBy=approval.actor_id_created_by,
        approvedBy=approval.approved_by,
        approvedAt=_isoformat(approval.approved_at) if approval.approved_at else None,
        rejectedBy=approval.rejected_by,
        rejectedAt=_isoformat(approval.rejected_at) if approval.rejected_at else None,
        executedBy=approval.executed_by,
        executedAt=_isoformat(approval.executed_at) if approval.executed_at else None,
        rejectionReason=approval.rejection_reason,
    )


def _action_schema(action: Action) -> ActionResult:
    return ActionResult(
        id=action.id,
        approvalId=action.approval_id,
        status=action.status,  # type: ignore[arg-type]
        summary=action.summary,
        auditNote=action.audit_note,
        executedAt=_isoformat(action.executed_at),
    )


def _audit_schema(row: AuditRecord) -> AuditRecordSchema:
    return AuditRecordSchema(
        id=row.id,
        runId=row.run_id,
        approvalId=row.approval_id,
        eventType=row.event_type,  # type: ignore[arg-type]
        actor=row.actor,
        message=row.message,
        createdAt=_isoformat(row.created_at),
        requestId=row.request_id,
        actorId=row.actor_id,
        actorRole=row.actor_role,
        entityType=row.entity_type,
        entityId=row.entity_id,
    )


def run_workflow(session: Session, payload: WorkflowRequest, actor: Actor, request_id: str) -> WorkflowResponse:
    if not payload.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    customer = _target_customer(session, payload)
    usage = _latest_usage(session, customer.id)
    intent = classify_intent(payload.prompt).intent
    run_id = f"run-{uuid4().hex[:10]}"

    timings: dict[str, int] = {}
    started_at = perf_counter()

    t0 = perf_counter()
    analyst = analyst_stage(customer, usage, [], intent)
    timings["analyst_duration_ms"] = int((perf_counter() - t0) * 1000)

    t0 = perf_counter()
    evidence = retrieve_evidence(session, customer, payload.prompt)
    timings["researcher_duration_ms"] = int((perf_counter() - t0) * 1000)

    t0 = perf_counter()
    planner = planner_stage(customer, analyst, intent)
    timings["planner_duration_ms"] = int((perf_counter() - t0) * 1000)

    t0 = perf_counter()
    risk_review = risk_stage(customer, analyst, planner, intent)
    if len(evidence) <= 1:
        risk_review.concerns.append("Evidence depth is limited; recommendation confidence should be treated as provisional.")
    timings["risk_duration_ms"] = int((perf_counter() - t0) * 1000)

    t0 = perf_counter()
    arbiter = arbiter_stage(customer, planner, risk_review, intent)
    timings["arbiter_duration_ms"] = int((perf_counter() - t0) * 1000)

    t0 = perf_counter()
    summary = comms_summary(customer, analyst, arbiter, intent)
    timings["comms_duration_ms"] = int((perf_counter() - t0) * 1000)

    llm_fallback_reason = None
    try:
        llm_payload = generate_json("{}", max_tokens=32)
        _ = llm_payload
    except Exception as exc:
        llm_fallback_reason = str(exc)[:140]

    selected = planner.strategies[0]
    approval = Approval(
        id=f"approval-{uuid4().hex[:10]}",
        run_id=run_id,
        customer_id=customer.id,
        action_title=f"Approve {selected.title.lower()}",
        owner=selected.owner,
        priority="Urgent" if customer.risk_level == "Critical" else "High",
        status="pending",
        actor_id_created_by=actor.actor_id,
        rationale=arbiter.rationale,
        estimated_impact=analyst.revenue_at_risk,
        due_label=selected.deliveryWindow,
    )
    run = WorkflowRun(
        id=run_id,
        customer_id=customer.id,
        prompt=payload.prompt,
        workflow_type=payload.workflowType,
        request_summary=payload.prompt,
        summary=summary,
        status="completed",
        request_id=request_id,
        actor_id=actor.actor_id,
        actor_name=actor.actor_name,
        actor_role=actor.actor_role,
        submitted_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
        metadata_json={"stage_timings": timings, "llm_fallback_reason": llm_fallback_reason},
    )
    session.add(run)
    session.flush()
    for index, item in enumerate(evidence, start=1):
        session.add(
            RunEvidence(
                id=f"{run_id}-ev-{index}",
                run_id=run_id,
                source_type=item.sourceType,
                source_id=item.sourceId,
                title=item.title,
                snippet=item.snippet,
                relevance=item.relevance,
            )
        )
    session.add(
        RunDecision(
            id=f"decision-{uuid4().hex[:10]}",
            run_id=run_id,
            planner_summary=planner.summary,
            planner_options=[strategy.model_dump() for strategy in planner.strategies],
            risk_verdict=risk_review.verdict,
            risk_critique=risk_review.critique,
            risk_concerns=risk_review.concerns,
            risk_required_checks=risk_review.requiredChecks,
            arbiter_strategy_id=arbiter.selectedStrategyId,
            arbiter_final_recommendation=arbiter.finalRecommendation,
            arbiter_rationale=arbiter.rationale,
            arbiter_confidence_label=arbiter.confidenceLabel,
        )
    )
    session.add(approval)
    session.add(
        AuditRecord(
            id=f"audit-{uuid4().hex[:10]}",
            run_id=run_id,
            approval_id=approval.id,
            request_id=request_id,
            actor_id=actor.actor_id,
            actor_name=actor.actor_name,
            actor_role=actor.actor_role,
            event_type="workflow_run",
            entity_type="workflow_run",
            entity_id=run_id,
            before_state=None,
            after_state={"status": "completed"},
            actor=actor.actor_name,
            message=f"Workflow completed for {customer.name}",
        )
    )
    session.commit()

    timings["total_duration_ms"] = int((perf_counter() - started_at) * 1000)
    logger.info(
        "workflow_completed",
        extra={
            "request_id": request_id,
            "customer_id": customer.id,
            "run_id": run_id,
            "actor_id": actor.actor_id,
            "role": actor.actor_role,
            "duration_ms": timings["total_duration_ms"],
        },
    )

    approval_schema = _approval_schema(approval, customer)
    return WorkflowResponse(
        requestId=run_id,
        submittedAt=_isoformat(run.submitted_at),
        workflowType=payload.workflowType,
        detectedIntent=intent,
        requestSummary=payload.prompt,
        status="completed",
        correlationId=request_id,
        targetEntity=TargetEntity(id=customer.id, name=customer.name, segment=customer.segment),
        summary=summary,
        evidence=evidence,
        plannerOutput=planner,
        riskReview=risk_review,
        arbiterDecision=arbiter,
        approval=approval_schema,
        actionHistory=[],
        auditRecords=[
            _audit_schema(row)
            for row in session.scalars(select(AuditRecord).where(AuditRecord.run_id == run_id).order_by(desc(AuditRecord.created_at)))
        ],
    )


def get_latest_workflow(session: Session, customer_id: str | None = None) -> WorkflowResponse | None:
    run_query = select(WorkflowRun).order_by(desc(WorkflowRun.submitted_at))
    if customer_id:
        run_query = run_query.where(WorkflowRun.customer_id == customer_id)
    workflow_run = session.scalar(run_query.limit(1))
    if workflow_run is None:
        return None

    customer = session.get(Customer, workflow_run.customer_id)
    if customer is None:
        return None
    approval = session.scalar(select(Approval).where(Approval.run_id == workflow_run.id).order_by(desc(Approval.created_at)).limit(1))
    if approval is None:
        return None
    decision = session.scalar(select(RunDecision).where(RunDecision.run_id == workflow_run.id).limit(1))
    if decision is None:
        return None
    evidence_rows = list(session.scalars(select(RunEvidence).where(RunEvidence.run_id == workflow_run.id)))
    action_rows = list(session.scalars(select(Action).where(Action.approval_id == approval.id).order_by(desc(Action.executed_at))))
    audit_rows = list(session.scalars(select(AuditRecord).where(AuditRecord.run_id == workflow_run.id).order_by(desc(AuditRecord.created_at))))
    intent = classify_intent(workflow_run.prompt).intent

    return WorkflowResponse(
        requestId=workflow_run.id,
        submittedAt=_isoformat(workflow_run.submitted_at),
        workflowType=workflow_run.workflow_type,  # type: ignore[arg-type]
        detectedIntent=intent,
        requestSummary=workflow_run.request_summary,
        status=workflow_run.status,  # type: ignore[arg-type]
        correlationId=workflow_run.request_id,
        targetEntity=TargetEntity(id=customer.id, name=customer.name, segment=customer.segment),
        summary=workflow_run.summary,
        evidence=[
            EvidenceItem(
                id=row.id,
                sourceType=row.source_type,  # type: ignore[arg-type]
                sourceId=row.source_id,
                title=row.title,
                snippet=row.snippet,
                relevance=row.relevance,
            )
            for row in evidence_rows
        ],
        plannerOutput=PlannerOutput(
            summary=decision.planner_summary,
            strategies=decision.planner_options,
        ),
        riskReview=RiskReview(
            verdict=decision.risk_verdict,  # type: ignore[arg-type]
            critique=decision.risk_critique,
            concerns=decision.risk_concerns,
            requiredChecks=decision.risk_required_checks,
        ),
        arbiterDecision=ArbiterDecision(
            selectedStrategyId=decision.arbiter_strategy_id,
            finalRecommendation=decision.arbiter_final_recommendation,
            rationale=decision.arbiter_rationale,
            confidenceLabel=decision.arbiter_confidence_label,
        ),
        approval=_approval_schema(approval, customer),
        actionHistory=[_action_schema(row) for row in action_rows],
        auditRecords=[_audit_schema(row) for row in audit_rows],
    )
