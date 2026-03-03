from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from difflib import SequenceMatcher
import json
import re
from uuid import uuid4

from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from .config import settings
from .intent import IntentType, classify_intent, classify_intent_fallback, intent_label
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
    EvidenceItem,
    FeedbackPayload,
    PlannerOutput,
    RecordFeedbackResponse,
    RiskReview,
    TargetEntity,
    WorkflowRequest,
    WorkflowResponse,
    WorkflowRunSummary,
)


class LLMEvidenceItem(BaseModel):
    sourceType: str
    sourceId: str
    title: str
    snippet: str
    relevance: str


class LLMAnalystOutput(BaseModel):
    summary: str
    topDrivers: list[str] = Field(default_factory=list)
    kpis: list[str] = Field(default_factory=list)


class LLMResearcherOutput(BaseModel):
    summary: str = ""
    evidence: list[LLMEvidenceItem] = Field(default_factory=list)


class LLMApprovalOutput(BaseModel):
    actionTitle: str
    owner: str
    priority: str = "High"
    rationale: str
    estimatedImpact: str
    dueLabel: str


class LLMWorkflowOutput(BaseModel):
    intent: IntentType
    analyst: LLMAnalystOutput
    researcher: LLMResearcherOutput
    planner: PlannerOutput
    riskReview: RiskReview
    arbiter: ArbiterDecision
    summary: str
    approval: LLMApprovalOutput


@dataclass
class WorkflowDraft:
    summary: str
    evidence: list[EvidenceItem]
    planner: PlannerOutput
    risk_review: RiskReview
    arbiter: ArbiterDecision
    approval: LLMApprovalOutput
    analysis_summary: str
    source: str


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


def _normalize(value: str) -> str:
    return " ".join(re.findall(r"[a-z0-9]+", value.lower()))


def _compact(value: str) -> str:
    return _normalize(value).replace(" ", "")


def _customer_name_score(prompt: str, customer: Customer) -> float:
    prompt_norm = _normalize(prompt)
    name_norm = _normalize(customer.name)
    if not prompt_norm or not name_norm:
        return 0.0

    if name_norm in prompt_norm:
        return 1.0

    name_tokens = name_norm.split()
    if name_tokens and any(token in prompt_norm.split() for token in name_tokens):
        overlap = sum(1 for token in name_tokens if token in prompt_norm.split())
        return 0.72 + (overlap / len(name_tokens)) * 0.2

    return SequenceMatcher(None, _compact(prompt), _compact(customer.name)).ratio()


def _open_escalation_count(tickets: list[SupportTicket]) -> int:
    return sum(1 for ticket in tickets if ticket.status != "Closed" and ticket.severity in {"P1", "P2"})


def _pricing_ticket_count(tickets: list[SupportTicket]) -> int:
    keywords = ("price", "pricing", "discount", "competitor", "benchmark", "commercial")
    return sum(1 for ticket in tickets if any(keyword in ticket.snippet.lower() for keyword in keywords))


def _approval_priority_score(session: Session, customer: Customer) -> float:
    latest_approval = _latest_approval(session, customer.id)
    approval_bonus = 0.25 if latest_approval and latest_approval.status in {"Pending", "Ready"} else 0
    return customer.churn_probability + approval_bonus + (customer.monthly_revenue / 1_000_000)


def _target_customer(session: Session, request: WorkflowRequest, intent: IntentType) -> Customer:
    customers = list(session.scalars(select(Customer)))
    if not customers:
        raise ValueError("No customers are available in the database")

    if request.focusCustomerId:
        customer = session.get(Customer, request.focusCustomerId)
        if customer:
            return customer

    scored = sorted(
        ((_customer_name_score(request.prompt, customer), customer) for customer in customers),
        key=lambda item: item[0],
        reverse=True,
    )
    if scored and scored[0][0] >= 0.78:
        return scored[0][1]

    if "highest risk" in request.prompt.lower() or intent == "general_churn":
        return max(customers, key=lambda customer: customer.churn_probability)

    if intent == "approval_priority":
        return max(customers, key=lambda customer: _approval_priority_score(session, customer))

    if intent == "support_risk":
        return max(customers, key=lambda customer: _open_escalation_count(_customer_tickets(session, customer.id)))

    if intent in {"usage_decline", "adoption_risk"}:
        return min(customers, key=lambda customer: _latest_usage(session, customer.id).usage_change_pct)

    if intent == "commercial_risk":
        return max(customers, key=lambda customer: _pricing_ticket_count(_customer_tickets(session, customer.id)))

    if intent == "renewal_risk":
        return max(
            customers,
            key=lambda customer: (
                customer.churn_probability,
                -len(customer.renewal_date),
                customer.renewal_date,
            ),
        )

    return max(customers, key=lambda customer: customer.churn_probability)


def _to_customer_summary(session: Session, customer: Customer) -> CustomerRiskSummary:
    usage = _latest_usage(session, customer.id)
    tickets = _customer_tickets(session, customer.id)
    approval = _latest_approval(session, customer.id)
    open_tickets = sum(1 for ticket in tickets if ticket.status != "Closed")
    escalated = _open_escalation_count(tickets)

    if approval:
        recommended_action = approval.action_title
    elif customer.risk_level in {"Critical", "High"}:
        recommended_action = "Create an approval-ready retention recommendation."
    else:
        recommended_action = "Monitor account health and refresh evidence."

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
            f"Usage change {usage.usage_change_pct:.0f}% with {usage.premium_feature_adoption_pct:.0f}% premium adoption",
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

    highlights: list[str] = []
    if critical_accounts:
        top_account = sorted(critical_accounts, key=lambda summary: summary.churnProbability, reverse=True)[0]
        highlights.append(
            f"{top_account.name} has the strongest churn pressure, with evidence ready for leadership review."
        )
    highlights.append(f"{open_approvals} retention actions are waiting for operating review.")
    highlights.append("Evidence, critique, and final judgment stay visible before execution.")

    return DashboardInsights(
        portfolioAtRisk=len(critical_accounts),
        renewalWindow=sum(1 for summary in summaries if summary.riskLevel in {"Critical", "High"}),
        executiveConfidence="78%",
        actionQueue=open_approvals,
        riskMix=risk_mix,
        highlights=highlights,
    )


def list_customers(session: Session) -> list[CustomerRiskSummary]:
    customers = list(
        session.scalars(select(Customer).order_by(desc(Customer.churn_probability), desc(Customer.monthly_revenue)))
    )
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
            EvidenceItem(
                id=row.id,
                sourceType=row.source_type,
                sourceId=row.source_id,
                title=row.title,
                snippet=row.snippet,
                relevance=row.relevance,
            )
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
    detected_intent = classify_intent_fallback(workflow_run.prompt).intent

    return WorkflowResponse(
        requestId=workflow_run.id,
        submittedAt=isoformat(workflow_run.submitted_at),
        workflowType=workflow_run.workflow_type,
        detectedIntent=detected_intent,
        requestSummary=workflow_run.request_summary,
        status=workflow_run.status,
        targetEntity=TargetEntity(id=customer.id, name=customer.name, segment=customer.segment),
        summary=workflow_run.summary,
        evidence=[
            EvidenceItem(
                id=row.id,
                sourceType=row.source_type,
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


def _context_payload(
    customer: Customer,
    usage: UsageMetric,
    tickets: list[SupportTicket],
    approvals: list[Approval],
    runs: list[WorkflowRun],
) -> dict:
    return {
        "customer": {
            "id": customer.id,
            "name": customer.name,
            "segment": customer.segment,
            "plan": customer.plan,
            "monthlyRevenue": customer.monthly_revenue,
            "riskLevel": customer.risk_level,
            "churnProbability": customer.churn_probability,
            "healthScore": customer.health_score,
            "renewalDate": customer.renewal_date,
            "accountOwner": customer.account_owner,
        },
        "usage": {
            "periodLabel": usage.period_label,
            "weeklyActiveUsers": usage.weekly_active_users,
            "usageChangePct": usage.usage_change_pct,
            "premiumFeatureAdoptionPct": usage.premium_feature_adoption_pct,
            "loginVolume": usage.login_volume,
        },
        "supportTickets": [
            {
                "id": ticket.id,
                "title": ticket.title,
                "severity": ticket.severity,
                "status": ticket.status,
                "snippet": ticket.snippet,
                "createdAt": isoformat(ticket.created_at),
            }
            for ticket in tickets
        ],
        "recentApprovals": [
            {
                "id": approval.id,
                "status": approval.status,
                "actionTitle": approval.action_title,
                "owner": approval.owner,
                "priority": approval.priority,
                "rationale": approval.rationale,
                "estimatedImpact": approval.estimated_impact,
            }
            for approval in approvals[:3]
        ],
        "recentRuns": [
            {
                "id": run.id,
                "prompt": run.prompt,
                "summary": run.summary,
                "status": run.status,
                "submittedAt": isoformat(run.submitted_at),
            }
            for run in runs[:3]
        ],
    }


def _deterministic_draft(
    request: WorkflowRequest,
    customer: Customer,
    usage: UsageMetric,
    tickets: list[SupportTicket],
    intent: IntentType,
) -> WorkflowDraft:
    analysis = analyst_stage(customer, usage, tickets, intent)
    evidence = researcher_stage(customer, usage, tickets, intent)
    planner = planner_stage(customer, analysis, intent)
    risk_review = risk_stage(customer, analysis, planner, intent)
    arbiter = arbiter_stage(customer, planner, risk_review, intent)
    summary = comms_summary(customer, analysis, arbiter, intent)
    selected_strategy = next(
        (strategy for strategy in planner.strategies if strategy.id == arbiter.selectedStrategyId),
        planner.strategies[0],
    )
    approval = LLMApprovalOutput(
        actionTitle=f"Approve {selected_strategy.title.lower()}",
        owner=selected_strategy.owner,
        priority="Urgent" if customer.risk_level == "Critical" else "High",
        rationale=arbiter.rationale,
        estimatedImpact=analysis.revenue_at_risk,
        dueLabel=selected_strategy.deliveryWindow,
    )
    return WorkflowDraft(
        summary=summary,
        evidence=evidence,
        planner=planner,
        risk_review=risk_review,
        arbiter=arbiter,
        approval=approval,
        analysis_summary=analysis.summary,
        source="deterministic",
    )


def _llm_prompt(
    request: WorkflowRequest,
    customer: Customer,
    intent: IntentType,
    context: dict,
    fallback: WorkflowDraft,
) -> str:
    return f"""
You are StratIQ, an executive decision-support workflow for customer churn and retention.

Use the provided customer data only. Do not invent facts, systems, dates, tickets, or metrics.
The answer must change based on the user's question intent and the selected customer.
Use concise executive language. Return valid JSON only.

Detected intent: {intent} ({intent_label(intent)})
User question: {request.prompt}

Customer context JSON:
{json.dumps(context, indent=2)}

Fallback draft for shape reference only:
summary: {fallback.summary}
planner strategy ids: {[strategy.id for strategy in fallback.planner.strategies]}
available evidence source ids: {[ticket["id"] for ticket in context["supportTickets"]]} plus usage metric id {context["usage"]["periodLabel"]}

Return JSON with this exact shape:
{{
  "intent": "{intent}",
  "analyst": {{
    "summary": "customer-specific diagnosis",
    "topDrivers": ["driver 1", "driver 2", "driver 3"],
    "kpis": ["KPI phrase"]
  }},
  "researcher": {{
    "summary": "how the evidence supports the recommendation",
    "evidence": [
      {{
        "sourceType": "usage_metric|support_ticket|renewal_signal|account_note",
        "sourceId": "must match a provided ticket id, usage metric label, or customer id",
        "title": "short evidence title",
        "snippet": "evidence grounded in provided data",
        "relevance": "why this matters for the user's question"
      }}
    ]
  }},
  "planner": {{
    "summary": "strategy summary tuned to the intent",
    "strategies": [
      {{
        "id": "strategy-1",
        "title": "short strategy name",
        "description": "what leadership should do",
        "owner": "business owner",
        "expectedImpact": "measurable account impact",
        "deliveryWindow": "timing"
      }}
    ]
  }},
  "riskReview": {{
    "verdict": "pass|caution|block",
    "critique": "what could make the strategy fail",
    "concerns": ["specific concern"],
    "requiredChecks": ["specific check before approval"]
  }},
  "arbiter": {{
    "selectedStrategyId": "one planner strategy id",
    "finalRecommendation": "final recommendation",
    "rationale": "why this is the best first move",
    "confidenceLabel": "High confidence|Moderate confidence|Caution"
  }},
  "summary": "2 sentence executive summary",
  "approval": {{
    "actionTitle": "approval card title",
    "owner": "named business owner",
    "priority": "Normal|High|Urgent",
    "rationale": "approval rationale",
    "estimatedImpact": "business impact",
    "dueLabel": "review timing"
  }}
}}
""".strip()


def _coerce_evidence(
    output: LLMWorkflowOutput,
    fallback: WorkflowDraft,
    usage: UsageMetric,
    tickets: list[SupportTicket],
    customer: Customer,
) -> list[EvidenceItem]:
    allowed_ticket_ids = {ticket.id for ticket in tickets}
    allowed_source_ids = allowed_ticket_ids | {usage.period_label, customer.id}
    evidence: list[EvidenceItem] = []

    for index, item in enumerate(output.researcher.evidence[:4], start=1):
        source_id = item.sourceId if item.sourceId in allowed_source_ids else usage.period_label
        source_type = item.sourceType
        if source_type not in {"usage_metric", "support_ticket", "renewal_signal", "account_note"}:
            source_type = "support_ticket" if source_id in allowed_ticket_ids else "usage_metric"
        evidence.append(
            EvidenceItem(
                id=f"llm-evidence-{index}",
                sourceType=source_type,
                sourceId=source_id,
                title=item.title.strip()[:180] or fallback.evidence[0].title,
                snippet=item.snippet.strip() or fallback.evidence[0].snippet,
                relevance=item.relevance.strip() or fallback.evidence[0].relevance,
            )
        )

    return evidence or fallback.evidence


def _coerce_priority(priority: str, customer: Customer) -> str:
    normalized = priority.strip().title()
    if normalized in {"Normal", "High", "Urgent"}:
        return normalized
    return "Urgent" if customer.risk_level == "Critical" else "High"


def _validate_llm_draft(
    payload: dict,
    fallback: WorkflowDraft,
    customer: Customer,
    usage: UsageMetric,
    tickets: list[SupportTicket],
) -> WorkflowDraft:
    output = LLMWorkflowOutput.model_validate(payload)
    if not output.planner.strategies:
        raise ValueError("LLM output did not include any strategy options.")

    strategy_ids = {strategy.id for strategy in output.planner.strategies}
    if output.arbiter.selectedStrategyId not in strategy_ids:
        output.arbiter.selectedStrategyId = output.planner.strategies[0].id

    evidence = _coerce_evidence(output, fallback, usage, tickets, customer)
    approval = output.approval
    approval.priority = _coerce_priority(approval.priority, customer)

    return WorkflowDraft(
        summary=output.summary.strip() or fallback.summary,
        evidence=evidence,
        planner=output.planner,
        risk_review=output.riskReview,
        arbiter=output.arbiter,
        approval=approval,
        analysis_summary=output.analyst.summary or fallback.analysis_summary,
        source="llm",
    )


def _run_llm_reasoning(
    request: WorkflowRequest,
    customer: Customer,
    intent: IntentType,
    context: dict,
    usage: UsageMetric,
    tickets: list[SupportTicket],
    fallback: WorkflowDraft,
) -> WorkflowDraft:
    if not llm_is_enabled():
        print("StratIQ LLM disabled or missing provider key; using deterministic reasoning fallback.")
        return fallback

    try:
        payload = generate_json(
            _llm_prompt(request, customer, intent, context, fallback),
            max_tokens=settings.llm_max_tokens,
        )
        return _validate_llm_draft(payload, fallback, customer, usage, tickets)
    except (LLMRequestError, ValidationError, ValueError) as exc:
        print(f"StratIQ LLM reasoning fallback activated: {exc}")
        return fallback


def _persist_workflow(
    session: Session,
    request: WorkflowRequest,
    customer: Customer,
    intent: IntentType,
    draft: WorkflowDraft,
) -> WorkflowResponse:
    run_id = f"run-{uuid4().hex[:10]}"
    submitted_at = datetime.now(timezone.utc)
    workflow_run = WorkflowRun(
        id=run_id,
        customer_id=customer.id,
        prompt=request.prompt,
        workflow_type=request.workflowType,
        request_summary=request.prompt,
        summary=draft.summary,
        status="completed",
        submitted_at=submitted_at,
    )
    session.add(workflow_run)

    for index, item in enumerate(draft.evidence, start=1):
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
            planner_summary=draft.planner.summary,
            planner_options=[strategy.model_dump() for strategy in draft.planner.strategies],
            risk_verdict=draft.risk_review.verdict,
            risk_critique=draft.risk_review.critique,
            risk_concerns=draft.risk_review.concerns,
            risk_required_checks=draft.risk_review.requiredChecks,
            arbiter_strategy_id=draft.arbiter.selectedStrategyId,
            arbiter_final_recommendation=draft.arbiter.finalRecommendation,
            arbiter_rationale=draft.arbiter.rationale,
            arbiter_confidence_label=draft.arbiter.confidenceLabel,
        )
    )

    approval = Approval(
        id=f"approval-{uuid4().hex[:10]}",
        run_id=run_id,
        customer_id=customer.id,
        action_title=draft.approval.actionTitle,
        owner=draft.approval.owner,
        priority=draft.approval.priority,
        status="Pending",
        rationale=draft.approval.rationale,
        estimated_impact=draft.approval.estimatedImpact,
        due_label=draft.approval.dueLabel,
    )
    session.add(approval)
    session.add(
        AuditRecord(
            id=f"audit-{uuid4().hex[:10]}",
            run_id=run_id,
            approval_id=approval.id,
            event_type="workflow_run",
            actor="StratIQ",
            message=f"{customer.name} recommendation created for {intent_label(intent).lower()} review.",
        )
    )

    session.commit()
    session.refresh(approval)

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
        detectedIntent=intent,
        requestSummary=request.prompt,
        status="completed",
        targetEntity=TargetEntity(id=customer.id, name=customer.name, segment=customer.segment),
        summary=draft.summary,
        evidence=draft.evidence,
        plannerOutput=draft.planner,
        riskReview=draft.risk_review,
        arbiterDecision=draft.arbiter,
        approval=_approval_from_db(approval, customer),
        actionHistory=_actions_for_approval(session, approval),
        auditRecords=audit,
    )


def run_bounded_workflow(session: Session, request: WorkflowRequest) -> WorkflowResponse:
    intent_result = classify_intent(request.prompt)
    intent = intent_result.intent
    customer = _target_customer(session, request, intent)
    usage = _latest_usage(session, customer.id)
    tickets = _customer_tickets(session, customer.id)
    recent_approvals = list(
        session.scalars(
            select(Approval)
            .where(Approval.customer_id == customer.id)
            .order_by(desc(Approval.created_at))
            .limit(5)
        )
    )
    recent_runs = _recent_runs(session, customer.id)
    context = _context_payload(customer, usage, tickets, recent_approvals, recent_runs)
    fallback = _deterministic_draft(request, customer, usage, tickets, intent)
    draft = _run_llm_reasoning(request, customer, intent, context, usage, tickets, fallback)
    return _persist_workflow(session, request, customer, intent, draft)


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
        audit_note="Decision state transition recorded for audit visibility.",
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
