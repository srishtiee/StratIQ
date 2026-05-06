from dataclasses import dataclass
from datetime import datetime

from .models import Customer, SupportTicket, UsageMetric
from .schemas import ArbiterDecision, EvidenceItem, PlannerOutput, RiskReview, StrategyOption


@dataclass
class AnalystSnapshot:
    summary: str
    top_drivers: list[str]
    revenue_at_risk: str
    open_escalations: int
    usage_change_pct: float
    adoption_pct: float


def format_currency(value: float) -> str:
    return f"${value:,.0f}"


def analyst_stage(customer: Customer, usage: UsageMetric, tickets: list[SupportTicket]) -> AnalystSnapshot:
    open_escalations = sum(1 for ticket in tickets if ticket.severity in {"P1", "P2"} and ticket.status != "Closed")
    top_drivers = [
        f"Usage changed {usage.usage_change_pct:.0f}% in the latest reporting window.",
        f"Premium feature adoption is at {usage.premium_feature_adoption_pct:.0f}%.",
        f"{open_escalations} escalated tickets remain active before renewal.",
    ]
    summary = (
        f"{customer.name} shows churn pressure across declining usage, support escalation load, "
        f"and renewal timing. Revenue at risk is approximately {format_currency(customer.monthly_revenue * 3)} "
        f"across the active renewal horizon."
    )
    return AnalystSnapshot(
        summary=summary,
        top_drivers=top_drivers,
        revenue_at_risk=format_currency(customer.monthly_revenue * 3),
        open_escalations=open_escalations,
        usage_change_pct=usage.usage_change_pct,
        adoption_pct=usage.premium_feature_adoption_pct,
    )


def researcher_stage(customer: Customer, usage: UsageMetric, tickets: list[SupportTicket]) -> list[EvidenceItem]:
    evidence = [
        EvidenceItem(
            id=f"ev-{usage.id}",
            sourceType="usage_metric",
            sourceId=usage.id,
            title=f"Weekly usage shifted {usage.usage_change_pct:.0f}%",
            snippet=(
                f"{customer.name} logged {usage.weekly_active_users} weekly active users with "
                f"{usage.premium_feature_adoption_pct:.0f}% premium feature adoption in {usage.period_label}."
            ),
            relevance="Shows the structured decline behind the churn signal.",
        )
    ]

    for ticket in tickets[:2]:
        evidence.append(
            EvidenceItem(
                id=f"ev-{ticket.id}",
                sourceType="support_ticket",
                sourceId=ticket.id,
                title=ticket.title,
                snippet=ticket.snippet,
                relevance="Captures unstructured context from support and account operations.",
            )
        )

    evidence.append(
        EvidenceItem(
            id=f"ev-renewal-{customer.id}",
            sourceType="renewal_signal",
            sourceId=f"renewal-{customer.id}",
            title="Active renewal window",
            snippet=f"{customer.name} enters renewal review on {customer.renewal_date}.",
            relevance="Explains why the decision package should be approval-ready now.",
        )
    )
    return evidence


def planner_stage(customer: Customer, analysis: AnalystSnapshot) -> PlannerOutput:
    strategies = [
        StrategyOption(
            id="strategy-sponsor-recovery",
            title="Sponsor recovery motion",
            description=(
                "Schedule sponsor-level outreach, review the remediation path, and assign a named recovery owner "
                "before the commercial meeting."
            ),
            owner="Customer Success Director",
            expectedImpact="Rebuilds trust before procurement finalizes renewal direction.",
            deliveryWindow="24 hours",
        ),
        StrategyOption(
            id="strategy-commercial-save",
            title="Commercial save package",
            description=(
                "Prepare a retention package tied to usage recovery milestones and service governance checkpoints."
            ),
            owner="RevOps Director",
            expectedImpact="Protects revenue while holding the customer to a measurable adoption recovery plan.",
            deliveryWindow="48 hours",
        ),
    ]

    if analysis.usage_change_pct > -10 and analysis.open_escalations == 0:
        strategies[0], strategies[1] = strategies[1], strategies[0]

    return PlannerOutput(
        summary=(
            "The planner recommends one primary recovery path and one secondary commercial fallback "
            "so leadership can approve a bounded course of action immediately."
        ),
        strategies=strategies,
    )


def risk_stage(customer: Customer, analysis: AnalystSnapshot, planner: PlannerOutput) -> RiskReview:
    concerns = []
    required_checks = []
    verdict = "pass"

    if analysis.open_escalations >= 2:
        verdict = "caution"
        concerns.append("Sponsor trust is at risk because multiple escalations remain unresolved.")
        required_checks.append("Confirm the remediation owner before the sponsor call.")

    if analysis.adoption_pct < 45:
        verdict = "caution"
        concerns.append("Commercial intervention alone may not reverse low feature depth.")
        required_checks.append("Tie the approved action to an adoption milestone review.")

    critique = (
        "The strategy is viable, but it should not be framed as a pure pricing response. "
        "Any approved plan needs named ownership, a follow-up checkpoint, and evidence-backed remediation commitments."
    )

    if not concerns:
        concerns.append("No material compliance blockers surfaced from the available evidence.")

    return RiskReview(
        verdict=verdict,
        critique=critique,
        concerns=concerns,
        requiredChecks=required_checks,
    )


def arbiter_stage(customer: Customer, planner: PlannerOutput, risk_review: RiskReview) -> ArbiterDecision:
    selected = planner.strategies[0]
    if risk_review.verdict == "block" and len(planner.strategies) > 1:
        selected = planner.strategies[1]

    rationale = (
        f"{customer.name} needs a recommendation that leadership can defend quickly. "
        f"The selected path aligns best with the current evidence and preserves execution accountability."
    )

    return ArbiterDecision(
        selectedStrategyId=selected.id,
        finalRecommendation=(
            f"Approve {selected.title.lower()} first, and keep the alternate strategy available "
            "only if the next checkpoint exposes commercial resistance."
        ),
        rationale=rationale,
        confidenceLabel="High confidence" if risk_review.verdict != "block" else "Moderate confidence",
    )


def comms_summary(customer: Customer, analysis: AnalystSnapshot, arbiter: ArbiterDecision) -> str:
    return (
        f"{customer.name} shows converging churn risk across usage decline, escalation load, and renewal timing. "
        f"Recommended action: {arbiter.finalRecommendation}"
    )
