from datetime import datetime, timezone

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from ..models import Approval, Customer, RunDecision, RunEvidence, SupportTicket, UsageMetric, WorkflowRun
from ..schemas import ApprovalRequest, CustomerDetail, CustomerRiskSummary, EvidenceItem, WorkflowRunSummary


def _isoformat(value: datetime | None) -> str:
    if value is None:
        return datetime.now(timezone.utc).isoformat()
    return value.isoformat()


def _summary(customer: Customer, usage: UsageMetric | None, tickets: list[SupportTicket]) -> CustomerRiskSummary:
    open_tickets = sum(1 for t in tickets if t.status != "Closed")
    usage_change = usage.usage_change_pct if usage else 0
    return CustomerRiskSummary(
        id=customer.id,
        name=customer.name,
        segment=customer.segment,
        plan=customer.plan,
        monthlyRevenue=customer.monthly_revenue,
        riskLevel=customer.risk_level,  # type: ignore[arg-type]
        churnProbability=customer.churn_probability,
        healthScore=customer.health_score,
        renewalDate=customer.renewal_date,
        accountOwner=customer.account_owner,
        ticketLoad=f"{open_tickets} open",
        lastActivity=f"Usage changed {usage_change:.0f}%",
        topDrivers=["Usage trend", "Ticket load", "Renewal window"],
        recommendedAction="Review latest approval package.",
    )


def list_customers(session: Session) -> list[CustomerRiskSummary]:
    customers = list(session.scalars(select(Customer).order_by(desc(Customer.churn_probability))))
    output = []
    for customer in customers:
        usage = session.scalar(select(UsageMetric).where(UsageMetric.customer_id == customer.id).order_by(desc(UsageMetric.created_at)).limit(1))
        tickets = list(session.scalars(select(SupportTicket).where(SupportTicket.customer_id == customer.id)))
        output.append(_summary(customer, usage, tickets))
    return output


def get_customer_detail(session: Session, customer_id: str) -> CustomerDetail | None:
    customer = session.get(Customer, customer_id)
    if customer is None:
        return None
    usage = session.scalar(select(UsageMetric).where(UsageMetric.customer_id == customer.id).order_by(desc(UsageMetric.created_at)).limit(1))
    tickets = list(session.scalars(select(SupportTicket).where(SupportTicket.customer_id == customer.id).order_by(desc(SupportTicket.created_at)).limit(5)))
    summary = _summary(customer, usage, tickets)
    latest_run = session.scalar(select(WorkflowRun).where(WorkflowRun.customer_id == customer.id).order_by(desc(WorkflowRun.submitted_at)).limit(1))
    evidence_rows = list(session.scalars(select(RunEvidence).where(RunEvidence.run_id == latest_run.id))) if latest_run else []
    runs = list(session.scalars(select(WorkflowRun).where(WorkflowRun.customer_id == customer.id).order_by(desc(WorkflowRun.submitted_at)).limit(5)))
    latest_approval = session.scalar(select(Approval).where(Approval.customer_id == customer.id).order_by(desc(Approval.created_at)).limit(1))
    run_decisions = {
        decision.run_id: decision
        for decision in session.scalars(select(RunDecision).where(RunDecision.run_id.in_([run.id for run in runs]))).all()
    } if runs else {}
    approval_schema = (
        ApprovalRequest(
            id=latest_approval.id,
            runId=latest_approval.run_id,
            customerId=latest_approval.customer_id,
            customerName=customer.name,
            actionTitle=latest_approval.action_title,
            owner=latest_approval.owner,
            priority=latest_approval.priority,  # type: ignore[arg-type]
            status=latest_approval.status,  # type: ignore[arg-type]
            rationale=latest_approval.rationale,
            estimatedImpact=latest_approval.estimated_impact,
            dueLabel=latest_approval.due_label,
            createdAt=_isoformat(latest_approval.created_at),
            actorIdCreatedBy=latest_approval.actor_id_created_by,
            approvedBy=latest_approval.approved_by,
            approvedAt=_isoformat(latest_approval.approved_at) if latest_approval.approved_at else None,
            rejectedBy=latest_approval.rejected_by,
            rejectedAt=_isoformat(latest_approval.rejected_at) if latest_approval.rejected_at else None,
            executedBy=latest_approval.executed_by,
            executedAt=_isoformat(latest_approval.executed_at) if latest_approval.executed_at else None,
            rejectionReason=latest_approval.rejection_reason,
        )
        if latest_approval
        else None
    )
    return CustomerDetail(
        **summary.model_dump(),
        evidence=[EvidenceItem(id=e.id, sourceType=e.source_type, sourceId=e.source_id, title=e.title, snippet=e.snippet, relevance=e.relevance) for e in evidence_rows],  # type: ignore[arg-type]
        recentRuns=[
            WorkflowRunSummary(
                id=run.id,
                workflowType=run.workflow_type,  # type: ignore[arg-type]
                submittedAt=_isoformat(run.submitted_at),
                status=run.status,  # type: ignore[arg-type]
                summary=run.summary,
                finalRecommendation=run_decisions[run.id].arbiter_final_recommendation if run.id in run_decisions else "n/a",
            )
            for run in runs
        ],
        latestApproval=approval_schema,
    )
