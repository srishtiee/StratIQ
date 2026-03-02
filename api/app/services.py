from datetime import datetime, timezone
from uuid import uuid4

from pydantic import ValidationError
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from .config import settings
from .llm import LLMRequestError, generate_json, llm_is_enabled
from .models import (
    Action,
    Approval,
    AuditRecord,
    Customer,
    Feedback,
    RunDecision,
    RunEvidence,
    SupportTicket,
    UsageMetric,
    WorkflowRun,
)
from .reasoning import analyst_stage, arbiter_stage, comms_summary, planner_stage, researcher_stage, risk_stage
from .schemas import (
    ActionResult,
    ApprovalActionPayload,
    ApprovalRequest,
    ArbiterDecision,
    AuditRecord as AuditRecordSchema,
    CustomerDetail,
    CustomerRiskSummary,
    DashboardInsights,
    FeedbackPayload,
    PlannerOutput,
    RecordFeedbackResponse,
    RiskReview,
    TargetEntity,
    WorkflowRequest,
    WorkflowResponse,
    WorkflowRunSummary,
)


def _serialize_evidence_for_prompt(evidence: list[dict] | list) -> str:
    lines: list[str] = []
    for item in evidence:
        title = getattr(item, "title", None) or item["title"]
        snippet = getattr(item, "snippet", None) or item["snippet"]
        relevance = getattr(item, "relevance", None) or item["relevance"]
        lines.append(f"- {title}: {snippet} ({relevance})")
    return "\n".join(lines)


def _planner_prompt(
    request: WorkflowRequest,
    customer: Customer,
    analyst,
    evidence,
    planner: PlannerOutput,
) -> str:
    strategy_lines = "\n".join(
        [
            (
                f"- id={strategy.id} | title={strategy.title} | owner={strategy.owner} | "
                f"expectedImpact={strategy.expectedImpact} | deliveryWindow={strategy.deliveryWindow}"
            )
            for strategy in planner.strategies
        ]
    )
    return f"""
You are the Planner Agent for StratIQ, an executive decision-support product.
Refine the existing deterministic strategy package for a customer churn workflow.

Return only valid JSON with this shape:
{{
  "summary": "string",
  "strategies": [
    {{
      "id": "must exactly match one of the existing ids",
      "title": "string",
      "description": "string",
      "owner": "string",
      "expectedImpact": "string",
      "deliveryWindow": "string"
    }}
  ]
}}

Rules:
- Keep exactly {len(planner.strategies)} strategies.
- Preserve the exact strategy ids and their order.
- Keep output concise, executive-facing, and grounded in the provided evidence.
- Do not invent new products, integrations, or customer facts.

Workflow prompt: {request.prompt}
Customer: {customer.name} ({customer.segment})
Monthly revenue: {customer.monthly_revenue}
Renewal date: {customer.renewal_date}
Analyst summary: {analyst.summary}
Top drivers:
- {"\n- ".join(analyst.top_drivers)}

Evidence:
{_serialize_evidence_for_prompt(evidence)}

Existing strategies:
{strategy_lines}
""".strip()


def _risk_prompt(customer: Customer, planner: PlannerOutput, risk_review: RiskReview) -> str:
    strategies = "\n".join(
        [f"- {strategy.title}: {strategy.description}" for strategy in planner.strategies]
    )
    return f"""
You are the Risk/Compliance Agent for StratIQ.
Refine the critique for the proposed retention strategies.

Return only valid JSON with this shape:
{{
  "verdict": "pass | caution | block",
  "critique": "string",
  "concerns": ["string"],
  "requiredChecks": ["string"]
}}

Rules:
- Keep the critique concise, operational, and review-oriented.
- Surface only realistic concerns for an enterprise retention workflow.
- If there are no blockers, keep concerns minimal rather than inventing risk.

Customer: {customer.name}
Current strategies:
{strategies}

Deterministic critique:
{risk_review.critique}

Existing concerns:
- {"\n- ".join(risk_review.concerns)}

Existing required checks:
- {"\n- ".join(risk_review.requiredChecks or ["No additional checks recorded."])}
""".strip()


def _comms_prompt(customer: Customer, summary: str, arbiter: ArbiterDecision) -> str:
    return f"""
You are the Comms Agent for StratIQ.
Rewrite the executive summary for a CXO-facing dashboard.

Return only valid JSON with this shape:
{{
  "summary": "string"
}}

Rules:
- Keep it to 2 sentences maximum.
- Make it concise, trustworthy, and operational.
- Mention the customer name and the recommended action.
- Do not exaggerate confidence or invent evidence.

Customer: {customer.name}
Current summary: {summary}
Final recommendation: {arbiter.finalRecommendation}
Rationale: {arbiter.rationale}
""".strip()


def _maybe_llm_planner(
    request: WorkflowRequest,
    customer: Customer,
    analyst,
    evidence,
    planner: PlannerOutput,
) -> PlannerOutput:
    if not llm_is_enabled():
        return planner

    try:
        payload = generate_json(_planner_prompt(request, customer, analyst, evidence, planner))
        candidate = PlannerOutput.model_validate(payload)
        expected_ids = [strategy.id for strategy in planner.strategies]
        actual_ids = [strategy.id for strategy in candidate.strategies]
        if expected_ids != actual_ids:
            return planner
        return candidate
    except (LLMRequestError, ValidationError, ValueError):
        return planner


def _maybe_llm_risk(customer: Customer, planner: PlannerOutput, risk_review: RiskReview) -> RiskReview:
    if not llm_is_enabled():
        return risk_review

    try:
        payload = generate_json(_risk_prompt(customer, planner, risk_review))
        return RiskReview.model_validate(payload)
    except (LLMRequestError, ValidationError, ValueError):
        return risk_review


def _maybe_llm_summary(customer: Customer, summary: str, arbiter: ArbiterDecision) -> str:
    if not llm_is_enabled():
        return summary

    try:
        payload = generate_json(_comms_prompt(customer, summary, arbiter), max_tokens=min(settings.llm_max_tokens, 300))
        candidate = str(payload.get("summary", "")).strip()
        return candidate or summary
    except (LLMRequestError, ValidationError, ValueError, AttributeError):
        return summary


def isoformat(value: datetime | None) -> str:
    if value is None:
        return datetime.now(timezone.utc).isoformat()
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc).isoformat()
    return value.isoformat()


def _latest_usage(session: Session, customer_id: str) -> UsageMetric:
    metric = session.scalar(
        select(UsageMetric)
        .where(UsageMetric.customer_id == customer_id)
        .order_by(desc(UsageMetric.created_at))
        .limit(1)
    )
    if metric is None:
        raise ValueError(f"No usage metric found for customer {customer_id}")
    return metric


def _customer_tickets(session: Session, customer_id: str) -> list[SupportTicket]:
    return list(
        session.scalars(
            select(SupportTicket)
            .where(SupportTicket.customer_id == customer_id)
            .order_by(desc(SupportTicket.created_at))
        )
    )


def _latest_approval(session: Session, customer_id: str) -> Approval | None:
    return session.scalar(
        select(Approval)
        .where(Approval.customer_id == customer_id)
        .order_by(desc(Approval.created_at))
        .limit(1)
    )


def _approval_actions(session: Session, approval_id: str) -> list[Action]:
    return list(
        session.scalars(
            select(Action).where(Action.approval_id == approval_id).order_by(desc(Action.executed_at))
        )
    )


def _recent_runs(session: Session, customer_id: str) -> list[WorkflowRun]:
    return list(
        session.scalars(
            select(WorkflowRun)
            .where(WorkflowRun.customer_id == customer_id)
            .order_by(desc(WorkflowRun.submitted_at))
            .limit(5)
        )
    )


def _run_decision(session: Session, run_id: str) -> RunDecision | None:
    return session.scalar(select(RunDecision).where(RunDecision.run_id == run_id))


def _run_evidence(session: Session, run_id: str) -> list[RunEvidence]:
    return list(session.scalars(select(RunEvidence).where(RunEvidence.run_id == run_id)))


def _approval_for_run(session: Session, run_id: str) -> Approval | None:
    return session.scalar(select(Approval).where(Approval.run_id == run_id).limit(1))


def _to_customer_summary(session: Session, customer: Customer) -> CustomerRiskSummary:
    usage = _latest_usage(session, customer.id)
    tickets = _customer_tickets(session, customer.id)
    approval = _latest_approval(session, customer.id)
    open_tickets = sum(1 for ticket in tickets if ticket.status != "Closed")
    escalated = sum(1 for ticket in tickets if ticket.severity in {"P1", "P2"} and ticket.status != "Closed")

    recommended_action = approval.action_title if approval else "Generate a bounded retention package."

    return CustomerRiskSummary(
        id=customer.id,
        name=customer.name,
        segment=customer.segment,
        plan=customer.plan,
        monthlyRevenue=customer.monthly_revenue,
        riskLevel=customer.risk_level,
        churnProbability=customer.churn_probability,
        healthScore=customer.health_score,
        renewalDate=customer.renewal_date,
        accountOwner=customer.account_owner,
        ticketLoad=f"{open_tickets} open, {escalated} escalated",
        lastActivity=f"Usage changed {usage.usage_change_pct:.0f}% in {usage.period_label}",
        topDrivers=[
            f"Premium adoption at {usage.premium_feature_adoption_pct:.0f}%",
            f"{escalated} escalated tickets remain active",
            f"Renewal window: {customer.renewal_date}",
        ],
        recommendedAction=recommended_action,
    )


def get_dashboard_insights(session: Session) -> DashboardInsights:
    customer_rows = list(session.scalars(select(Customer)))
    summaries = [_to_customer_summary(session, customer) for customer in customer_rows]

    risk_mix = []
    for label, accent in [
        ("Critical", "#c45c56"),
        ("High", "#c9852a"),
        ("Moderate", "#1f6d73"),
        ("Low", "#3d8a62"),
    ]:
        risk_mix.append(
            {
                "label": label,
                "count": sum(1 for summary in summaries if summary.riskLevel == label),
                "accent": accent,
            }
        )

    open_approvals = session.scalar(
        select(func.count()).select_from(Approval).where(Approval.status.in_(["Pending", "Ready", "Approved"]))
    ) or 0
    critical_accounts = [summary for summary in summaries if summary.riskLevel in {"Critical", "High"}]

    highlights = []
    if critical_accounts:
        top_account = sorted(critical_accounts, key=lambda summary: summary.churnProbability, reverse=True)[0]
        highlights.append(
            f"{top_account.name} shows the strongest churn pressure across usage decline, support load, and renewal timing."
        )
    highlights.append(f"{open_approvals} approval-ready interventions are waiting for operating review.")
    highlights.append("The bounded pipeline keeps evidence, critique, and final judgment visible before execution.")

    return DashboardInsights(
        portfolioAtRisk=len(critical_accounts),
        renewalWindow=sum(1 for summary in summaries if summary.riskLevel in {"Critical", "High"}),
        executiveConfidence="78%",
        actionQueue=open_approvals,
        riskMix=risk_mix,
        highlights=highlights,
    )


def list_customers(session: Session) -> list[CustomerRiskSummary]:
    customers = list(session.scalars(select(Customer).order_by(desc(Customer.churn_probability), desc(Customer.monthly_revenue))))
    return [_to_customer_summary(session, customer) for customer in customers]


def list_approvals(session: Session) -> list[ApprovalRequest]:
    approvals = list(session.scalars(select(Approval).order_by(desc(Approval.created_at))))
    customer_names = {customer.id: customer.name for customer in session.scalars(select(Customer))}
    return [
        ApprovalRequest(
            id=approval.id,
            runId=approval.run_id,
            customerId=approval.customer_id,
            customerName=customer_names.get(approval.customer_id, approval.customer_id),
            actionTitle=approval.action_title,
            owner=approval.owner,
            priority=approval.priority,
            status=approval.status,
            rationale=approval.rationale,
            estimatedImpact=approval.estimated_impact,
            dueLabel=approval.due_label,
            createdAt=isoformat(approval.created_at),
        )
        for approval in approvals
    ]


def list_audit_records(session: Session) -> list[AuditRecordSchema]:
    records = list(session.scalars(select(AuditRecord).order_by(desc(AuditRecord.created_at)).limit(25)))
    return [
        AuditRecordSchema(
            id=record.id,
            runId=record.run_id,
            approvalId=record.approval_id,
            eventType=record.event_type,
            actor=record.actor,
            message=record.message,
            createdAt=isoformat(record.created_at),
        )
        for record in records
    ]


def get_customer_detail(session: Session, customer_id: str) -> CustomerDetail | None:
    customer = session.get(Customer, customer_id)
    if customer is None:
        return None

    summary = _to_customer_summary(session, customer)
    runs = _recent_runs(session, customer_id)
    latest_run = runs[0] if runs else None
    evidence_rows = _run_evidence(session, latest_run.id) if latest_run else []

    return CustomerDetail(
        **summary.model_dump(),
        evidence=[
            {
                "id": row.id,
                "sourceType": row.source_type,
                "sourceId": row.source_id,
                "title": row.title,
                "snippet": row.snippet,
                "relevance": row.relevance,
            }
            for row in evidence_rows
        ],
        recentRuns=[
            WorkflowRunSummary(
                id=run.id,
                workflowType=run.workflow_type,
                submittedAt=isoformat(run.submitted_at),
                status=run.status,
                summary=run.summary,
                finalRecommendation=(
                    _run_decision(session, run.id).arbiter_final_recommendation
                    if _run_decision(session, run.id)
                    else "No decision stored"
                ),
            )
            for run in runs
        ],
        latestApproval=next(
            (approval for approval in list_approvals(session) if approval.customerId == customer_id),
            None,
        ),
    )


def get_latest_workflow(session: Session, customer_id: str | None = None) -> WorkflowResponse | None:
    customer = session.get(Customer, customer_id) if customer_id else None
    if customer_id and customer is None:
        return None

    workflow_run = (
        session.scalar(
            select(WorkflowRun)
            .where(WorkflowRun.customer_id == customer_id)
            .order_by(desc(WorkflowRun.submitted_at))
            .limit(1)
        )
        if customer_id
        else session.scalar(select(WorkflowRun).order_by(desc(WorkflowRun.submitted_at)).limit(1))
    )

    if workflow_run is None:
        return None

    if customer is None:
        customer = session.get(Customer, workflow_run.customer_id)
    if customer is None:
        return None

    approval = _approval_for_run(session, workflow_run.id)
    if approval is None:
        return None

    return _workflow_response_from_run(session, workflow_run, customer, approval)


def _target_customer(session: Session, request: WorkflowRequest) -> Customer:
    if request.focusCustomerId:
        customer = session.get(Customer, request.focusCustomerId)
        if customer:
            return customer

    prompt_lower = request.prompt.lower()
    for customer in session.scalars(select(Customer)):
        if customer.name.lower() in prompt_lower:
            return customer

    customer = session.scalars(select(Customer).order_by(desc(Customer.churn_probability))).first()
    if customer is None:
        raise ValueError("No customers are available in the database")
    return customer


def _approval_from_db(approval: Approval, customer: Customer) -> ApprovalRequest:
    return ApprovalRequest(
        id=approval.id,
        runId=approval.run_id,
        customerId=approval.customer_id,
        customerName=customer.name,
        actionTitle=approval.action_title,
        owner=approval.owner,
        priority=approval.priority,
        status=approval.status,
        rationale=approval.rationale,
        estimatedImpact=approval.estimated_impact,
        dueLabel=approval.due_label,
        createdAt=isoformat(approval.created_at),
    )


def _actions_for_approval(session: Session, approval: Approval) -> list[ActionResult]:
    return [
        ActionResult(
            id=action.id,
            approvalId=action.approval_id,
            status=action.status,
            summary=action.summary,
            auditNote=action.audit_note,
            executedAt=isoformat(action.executed_at),
        )
        for action in _approval_actions(session, approval.id)
    ]


def _workflow_response_from_run(
    session: Session,
    workflow_run: WorkflowRun,
    customer: Customer,
    approval: Approval,
) -> WorkflowResponse:
    decision = _run_decision(session, workflow_run.id)
    if decision is None:
        raise ValueError(f"No decision stored for workflow run {workflow_run.id}")

    evidence_rows = _run_evidence(session, workflow_run.id)
    audit_rows = list(
        session.scalars(
            select(AuditRecord)
            .where(AuditRecord.run_id == workflow_run.id)
            .order_by(desc(AuditRecord.created_at))
        )
    )

    return WorkflowResponse(
        requestId=workflow_run.id,
        submittedAt=isoformat(workflow_run.submitted_at),
        workflowType=workflow_run.workflow_type,
        requestSummary=workflow_run.request_summary,
        status=workflow_run.status,
        targetEntity=TargetEntity(id=customer.id, name=customer.name, segment=customer.segment),
        summary=workflow_run.summary,
        evidence=[
            {
                "id": row.id,
                "sourceType": row.source_type,
                "sourceId": row.source_id,
                "title": row.title,
                "snippet": row.snippet,
                "relevance": row.relevance,
            }
            for row in evidence_rows
        ],
        plannerOutput=PlannerOutput(
            summary=decision.planner_summary,
            strategies=decision.planner_options,
        ),
        riskReview=RiskReview(
            verdict=decision.risk_verdict,
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
        approval=_approval_from_db(approval, customer),
        actionHistory=_actions_for_approval(session, approval),
        auditRecords=[
            AuditRecordSchema(
                id=record.id,
                runId=record.run_id,
                approvalId=record.approval_id,
                eventType=record.event_type,
                actor=record.actor,
                message=record.message,
                createdAt=isoformat(record.created_at),
            )
            for record in audit_rows
        ],
    )


def run_bounded_workflow(session: Session, request: WorkflowRequest) -> WorkflowResponse:
    customer = _target_customer(session, request)
    usage = _latest_usage(session, customer.id)
    tickets = _customer_tickets(session, customer.id)

    analyst = analyst_stage(customer, usage, tickets)
    evidence = researcher_stage(customer, usage, tickets)
    planner = planner_stage(customer, analyst)
    planner = _maybe_llm_planner(request, customer, analyst, evidence, planner)
    risk_review = risk_stage(customer, analyst, planner)
    risk_review = _maybe_llm_risk(customer, planner, risk_review)
    arbiter = arbiter_stage(customer, planner, risk_review)
    summary = comms_summary(customer, analyst, arbiter)
    summary = _maybe_llm_summary(customer, summary, arbiter)

    run_id = f"run-{uuid4().hex[:10]}"
    submitted_at = datetime.now(timezone.utc)
    workflow_run = WorkflowRun(
        id=run_id,
        customer_id=customer.id,
        prompt=request.prompt,
        workflow_type=request.workflowType,
        request_summary=request.prompt,
        summary=summary,
        status="completed",
        submitted_at=submitted_at,
    )
    session.add(workflow_run)

    for item in evidence:
        session.add(
            RunEvidence(
                id=f"{run_id}-{item.id}",
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

    selected_strategy = next(
        strategy for strategy in planner.strategies if strategy.id == arbiter.selectedStrategyId
    )
    approval = Approval(
        id=f"approval-{uuid4().hex[:10]}",
        run_id=run_id,
        customer_id=customer.id,
        action_title=f"Approve {selected_strategy.title.lower()}",
        owner=selected_strategy.owner,
        priority="Urgent" if customer.risk_level == "Critical" else "High",
        status="Pending",
        rationale=arbiter.rationale,
        estimated_impact=analyst.revenue_at_risk,
        due_label=selected_strategy.deliveryWindow,
    )
    session.add(approval)
    session.add(
        AuditRecord(
            id=f"audit-{uuid4().hex[:10]}",
            run_id=run_id,
            approval_id=approval.id,
            event_type="workflow_run",
            actor="Comms Agent",
            message=f"Workflow package created for {customer.name} with approval-ready recommendation.",
        )
    )

    session.commit()
    session.refresh(approval)

    action_history = _actions_for_approval(session, approval)
    audit = [
        AuditRecordSchema(
            id=record.id,
            runId=record.run_id,
            approvalId=record.approval_id,
            eventType=record.event_type,
            actor=record.actor,
            message=record.message,
            createdAt=isoformat(record.created_at),
        )
        for record in session.scalars(
            select(AuditRecord).where(AuditRecord.run_id == run_id).order_by(desc(AuditRecord.created_at))
        )
    ]

    return WorkflowResponse(
        requestId=run_id,
        submittedAt=isoformat(submitted_at),
        workflowType=request.workflowType,
        requestSummary=request.prompt,
        status="completed",
        targetEntity=TargetEntity(id=customer.id, name=customer.name, segment=customer.segment),
        summary=summary,
        evidence=evidence,
        plannerOutput=planner,
        riskReview=risk_review,
        arbiterDecision=arbiter,
        approval=_approval_from_db(approval, customer),
        actionHistory=action_history,
        auditRecords=audit,
    )


def record_feedback(session: Session, payload: FeedbackPayload) -> RecordFeedbackResponse:
    workflow_run = session.get(WorkflowRun, payload.requestId)
    if workflow_run is None:
        raise ValueError("Workflow run not found")

    workflow_run.status = "approved" if payload.verdict == "approve" else "needs_review"
    session.add(
        Feedback(
            id=f"feedback-{uuid4().hex[:10]}",
            run_id=workflow_run.id,
            verdict=payload.verdict,
            note=payload.note,
        )
    )
    session.add(
        AuditRecord(
            id=f"audit-{uuid4().hex[:10]}",
            run_id=workflow_run.id,
            event_type="feedback",
            actor="Operator",
            message=f"Feedback recorded with verdict '{payload.verdict}'.",
        )
    )
    session.commit()

    return RecordFeedbackResponse(
        requestId=payload.requestId,
        verdict=payload.verdict,
        note=payload.note,
        recordedAt=isoformat(datetime.now(timezone.utc)),
    )


def apply_action(session: Session, payload: ApprovalActionPayload) -> ActionResult:
    approval = session.get(Approval, payload.approvalId)
    if approval is None:
        raise ValueError("Approval not found")

    status_map = {
        "approve": ("Approved", "approved", "Approval granted and routed for execution."),
        "mark_ready": ("Ready", "queued", "Approval package marked ready for leadership review."),
        "reject": ("Rejected", "rejected", "Approval package rejected pending more evidence."),
        "execute": ("Executed", "executed", "Approved action executed and logged."),
    }
    approval_status, action_status, summary = status_map[payload.decision]
    approval.status = approval_status

    action = Action(
        id=f"action-{uuid4().hex[:10]}",
        approval_id=approval.id,
        status=action_status,
        summary=summary,
        audit_note="Bounded workflow recorded the action state transition for audit visibility.",
    )
    session.add(action)
    session.add(
        AuditRecord(
            id=f"audit-{uuid4().hex[:10]}",
            run_id=approval.run_id,
            approval_id=approval.id,
            event_type="action" if payload.decision == "execute" else "approval",
            actor="Operator",
            message=summary,
        )
    )
    session.commit()
    session.refresh(action)

    return ActionResult(
        id=action.id,
        approvalId=approval.id,
        status=action.status,
        summary=action.summary,
        auditNote=action.audit_note,
        executedAt=isoformat(action.executed_at),
    )
