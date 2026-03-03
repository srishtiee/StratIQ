from dataclasses import dataclass

from .intent import IntentType
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
    archetype: str
    primary_cause: str


def format_currency(value: float) -> str:
    return f"${value:,.0f}"


def _ticket_text(tickets: list[SupportTicket]) -> str:
    return " ".join([f"{ticket.title} {ticket.snippet}" for ticket in tickets]).lower()


def _open_escalations(tickets: list[SupportTicket]) -> int:
    return sum(1 for ticket in tickets if ticket.severity in {"P1", "P2"} and ticket.status != "Closed")


def infer_archetype(customer: Customer, usage: UsageMetric, tickets: list[SupportTicket], intent: IntentType) -> str:
    text = _ticket_text(tickets)
    if intent == "commercial_risk" or any(term in text for term in ["pricing", "discount", "competitor", "benchmark"]):
        return "competitor/pricing pressure"
    if intent == "support_risk" or any(term in text for term in ["reliability", "incident", "sla", "escalation"]):
        return "support escalation risk"
    if any(term in text for term in ["compliance", "audit", "hipaa", "trust", "freshness"]):
        return "compliance or trust concern"
    if any(term in text for term in ["sponsor", "stakeholder", "committee", "reorg", "replacement"]):
        return "sponsor change risk"
    if intent == "adoption_risk" or usage.premium_feature_adoption_pct < 45:
        return "product adoption decline"
    if any(term in text for term in ["onboarding", "training", "implementation", "pilot"]):
        return "implementation/onboarding failure"
    if usage.usage_change_pct >= 0 and customer.churn_probability < 0.25:
        return "low-risk stable customer"
    return "general churn risk"


def _cause_for_archetype(archetype: str) -> str:
    return {
        "support escalation risk": "unresolved reliability escalations and sponsor trust pressure",
        "product adoption decline": "low premium feature depth and weakening workflow adoption",
        "sponsor change risk": "sponsor transition and unclear operating ownership",
        "competitor/pricing pressure": "competitive benchmarking and commercial pressure",
        "implementation/onboarding failure": "stalled rollout ownership and training gaps",
        "compliance or trust concern": "evidence lineage, freshness, and compliance confidence",
        "low-risk stable customer": "stable usage with no material escalation pattern",
    }.get(archetype, "mixed churn indicators")


def analyst_stage(
    customer: Customer,
    usage: UsageMetric,
    tickets: list[SupportTicket],
    intent: IntentType = "general_churn",
) -> AnalystSnapshot:
    open_escalations = _open_escalations(tickets)
    archetype = infer_archetype(customer, usage, tickets, intent)
    primary_cause = _cause_for_archetype(archetype)

    top_drivers = [
        f"Risk pattern: {archetype}.",
        f"Usage changed {usage.usage_change_pct:.0f}% with premium adoption at {usage.premium_feature_adoption_pct:.0f}%.",
        f"{open_escalations} P1/P2 tickets remain open before the {customer.renewal_date} renewal review.",
    ]

    if intent == "approval_priority":
        summary = (
            f"{customer.name} needs an approval-ready path because {primary_cause} is already affecting the renewal motion. "
            f"The decision should prioritize owner clarity, timing, and revenue protection."
        )
    elif intent == "evidence_review":
        summary = (
            f"{customer.name}'s recommendation is supported by {primary_cause}, measured usage movement, "
            f"and {open_escalations} active escalations in the account record."
        )
    elif intent == "commercial_risk":
        summary = (
            f"{customer.name} should not be treated as a pricing-only case. The commercial question is tied to "
            f"{primary_cause} and whether value can be restored before concessions are discussed."
        )
    elif archetype == "low-risk stable customer":
        summary = (
            f"{customer.name} is currently stable: usage is growing, support risk is contained, and renewal pressure is low."
        )
    else:
        summary = f"{customer.name} is at risk primarily because of {primary_cause}."

    return AnalystSnapshot(
        summary=summary,
        top_drivers=top_drivers,
        revenue_at_risk=format_currency(customer.monthly_revenue * 3),
        open_escalations=open_escalations,
        usage_change_pct=usage.usage_change_pct,
        adoption_pct=usage.premium_feature_adoption_pct,
        archetype=archetype,
        primary_cause=primary_cause,
    )


def _ticket_score(ticket: SupportTicket, intent: IntentType) -> int:
    text = f"{ticket.title} {ticket.snippet}".lower()
    score = {"P1": 40, "P2": 30, "P3": 15, "P4": 5}.get(ticket.severity, 10)
    if ticket.status == "Closed":
        score -= 15

    keyword_boosts = {
        "support_risk": ("reliability", "incident", "escalation", "sla", "support"),
        "commercial_risk": ("pricing", "discount", "competitor", "benchmark", "finance"),
        "adoption_risk": ("adoption", "feature", "training", "workflow", "enablement"),
        "usage_decline": ("usage", "workflow", "dashboard", "login", "adoption"),
        "renewal_risk": ("renewal", "procurement", "committee", "contract"),
        "evidence_review": ("audit", "evidence", "notes", "review", "asked"),
        "approval_priority": ("sponsor", "owner", "approval", "committee", "procurement"),
    }
    for keyword in keyword_boosts.get(intent, ()):
        if keyword in text:
            score += 18
    return score


def researcher_stage(
    customer: Customer,
    usage: UsageMetric,
    tickets: list[SupportTicket],
    intent: IntentType = "general_churn",
) -> list[EvidenceItem]:
    evidence = [
        EvidenceItem(
            id=f"ev-{usage.id}",
            sourceType="usage_metric",
            sourceId=usage.id,
            title=f"Usage changed {usage.usage_change_pct:.0f}% in {usage.period_label}",
            snippet=(
                f"{customer.name} logged {usage.weekly_active_users} weekly active users, "
                f"{usage.login_volume} logins, and {usage.premium_feature_adoption_pct:.0f}% premium adoption."
            ),
            relevance=(
                "Prioritized because the question focuses on usage trend."
                if intent == "usage_decline"
                else "Shows the structured account signal behind the risk score."
            ),
        )
    ]

    ranked_tickets = sorted(tickets, key=lambda ticket: _ticket_score(ticket, intent), reverse=True)
    for ticket in ranked_tickets[:3]:
        evidence.append(
            EvidenceItem(
                id=f"ev-{ticket.id}",
                sourceType="support_ticket",
                sourceId=ticket.id,
                title=ticket.title,
                snippet=ticket.snippet,
                relevance=(
                    f"Relevant to {intent.replace('_', ' ')} because it captures account-specific operating context."
                ),
            )
        )

    evidence.append(
        EvidenceItem(
            id=f"ev-renewal-{customer.id}",
            sourceType="renewal_signal",
            sourceId=f"renewal-{customer.id}",
            title=f"Renewal review date: {customer.renewal_date}",
            snippet=f"{customer.name} has {customer.risk_level.lower()} risk and {format_currency(customer.monthly_revenue * 3)} in near-term revenue exposure.",
            relevance="Connects the recommendation to timing, owner urgency, and revenue impact.",
        )
    )
    return evidence


def planner_stage(
    customer: Customer,
    analysis: AnalystSnapshot,
    intent: IntentType = "general_churn",
) -> PlannerOutput:
    archetype = analysis.archetype
    if intent == "commercial_risk" or archetype == "competitor/pricing pressure":
        strategies = [
            StrategyOption(
                id="strategy-value-defense",
                title="Value defense package",
                description="Hold pricing steady while presenting adoption proof, competitive differentiation, and an executive value case.",
                owner="RevOps Director",
                expectedImpact="Protects margin while addressing pricing objections with evidence.",
                deliveryWindow="48 hours",
            ),
            StrategyOption(
                id="strategy-conditional-save",
                title="Conditional save lever",
                description="Prepare a limited concession only if sponsor recovery and value proof do not remove commercial resistance.",
                owner="Finance Partner",
                expectedImpact="Preserves renewal flexibility without leading with discounting.",
                deliveryWindow="72 hours",
            ),
        ]
    elif intent == "support_risk" or archetype == "support escalation risk":
        strategies = [
            StrategyOption(
                id="strategy-reliability-recovery",
                title="Reliability recovery motion",
                description="Escalate a dated remediation plan, name the recovery owner, and schedule sponsor-level reliability review.",
                owner="Customer Success Director",
                expectedImpact="Rebuilds trust before procurement finalizes renewal direction.",
                deliveryWindow="24 hours",
            ),
            StrategyOption(
                id="strategy-service-governance",
                title="Service governance checkpoint",
                description="Create a weekly service checkpoint until open P1/P2 issues are resolved and confidence stabilizes.",
                owner="Support Director",
                expectedImpact="Reduces renewal risk tied to unresolved support backlog.",
                deliveryWindow="48 hours",
            ),
        ]
    elif intent == "adoption_risk" or archetype in {"product adoption decline", "implementation/onboarding failure"}:
        strategies = [
            StrategyOption(
                id="strategy-adoption-reset",
                title="Adoption reset sprint",
                description="Run a targeted enablement sprint with usage milestones, workflow owners, and sponsor-visible progress reporting.",
                owner="RevOps Director",
                expectedImpact="Restores product depth before commercial review.",
                deliveryWindow="72 hours",
            ),
            StrategyOption(
                id="strategy-onboarding-rescue",
                title="Onboarding rescue plan",
                description="Reassign implementation ownership and map blocked teams to training cohorts and completion checkpoints.",
                owner="Implementation Lead",
                expectedImpact="Unblocks stalled rollout value without starting with pricing pressure.",
                deliveryWindow="5 business days",
            ),
        ]
    elif archetype == "compliance or trust concern":
        strategies = [
            StrategyOption(
                id="strategy-trust-evidence",
                title="Trust evidence package",
                description="Provide evidence lineage, data freshness commitments, and governance review before expansion approval.",
                owner="Compliance Lead",
                expectedImpact="Restores confidence for executive and audit stakeholders.",
                deliveryWindow="48 hours",
            ),
            StrategyOption(
                id="strategy-exec-assurance",
                title="Executive assurance review",
                description="Schedule a sponsor review focused on analytics reliability, controls, and renewal readiness.",
                owner="Customer Success Director",
                expectedImpact="Reduces trust objections before renewal committee review.",
                deliveryWindow="72 hours",
            ),
        ]
    else:
        strategies = [
            StrategyOption(
                id="strategy-sponsor-alignment",
                title="Sponsor alignment motion",
                description="Confirm executive sponsor priorities, name the operating owner, and align the next decision checkpoint.",
                owner="Customer Success Director",
                expectedImpact="Clarifies ownership before risk hardens into renewal resistance.",
                deliveryWindow="48 hours",
            ),
            StrategyOption(
                id="strategy-monitor",
                title="Targeted monitoring plan",
                description="Keep the account under weekly review while tracking usage depth, support friction, and renewal signals.",
                owner="Account Owner",
                expectedImpact="Maintains visibility without overreacting to moderate risk.",
                deliveryWindow="1 week",
            ),
        ]

    if intent == "approval_priority":
        summary = "Prioritize the strategy that can be approved fastest with a named owner, due window, and measurable impact."
    elif intent == "evidence_review":
        summary = "Strategies are ranked by how directly the available evidence supports them."
    else:
        summary = f"The recommended paths target {analysis.primary_cause}."

    return PlannerOutput(summary=summary, strategies=strategies)


def risk_stage(
    customer: Customer,
    analysis: AnalystSnapshot,
    planner: PlannerOutput,
    intent: IntentType = "general_churn",
) -> RiskReview:
    concerns: list[str] = []
    required_checks: list[str] = []
    verdict = "pass"

    if analysis.open_escalations >= 2:
        verdict = "caution"
        concerns.append("Open P1/P2 issues could weaken sponsor confidence if ownership is vague.")
        required_checks.append("Confirm remediation owner and due date before approval.")
    if analysis.adoption_pct < 45:
        verdict = "caution"
        concerns.append("Low premium adoption may limit the impact of a commercial-only response.")
        required_checks.append("Tie the action to a usage recovery checkpoint.")
    if intent == "commercial_risk":
        concerns.append("Leading with discounting may protect the renewal while weakening value perception.")
        required_checks.append("Document non-discount recovery options before any concession.")
    if analysis.archetype == "compliance or trust concern":
        verdict = "caution"
        concerns.append("Trust or compliance concerns require evidence lineage before expansion is defensible.")
        required_checks.append("Confirm data freshness and control evidence for the sponsor review.")

    if not concerns:
        concerns.append("No material blocker surfaced, but the owner and next checkpoint should remain explicit.")

    critique = (
        f"The plan is viable for {customer.name}, but approval should account for {analysis.primary_cause}. "
        "The strongest path is the one with a clear owner, near-term checkpoint, and evidence-backed rationale."
    )

    return RiskReview(
        verdict=verdict,
        critique=critique,
        concerns=concerns,
        requiredChecks=required_checks,
    )


def arbiter_stage(
    customer: Customer,
    planner: PlannerOutput,
    risk_review: RiskReview,
    intent: IntentType = "general_churn",
) -> ArbiterDecision:
    selected = planner.strategies[0]
    if intent == "commercial_risk" and len(planner.strategies) > 1:
        selected = planner.strategies[0]
    elif risk_review.verdict == "block" and len(planner.strategies) > 1:
        selected = planner.strategies[1]

    rationale = (
        f"{selected.title} is the most defensible next move for {customer.name} because it matches the question focus "
        "and keeps execution ownership visible."
    )

    return ArbiterDecision(
        selectedStrategyId=selected.id,
        finalRecommendation=f"Approve {selected.title.lower()} first.",
        rationale=rationale,
        confidenceLabel="High confidence" if risk_review.verdict != "block" else "Moderate confidence",
    )


def comms_summary(customer: Customer, analysis: AnalystSnapshot, arbiter: ArbiterDecision, intent: IntentType = "general_churn") -> str:
    if intent == "evidence_review":
        return f"{customer.name}'s recommendation is supported by account evidence around {analysis.primary_cause}. {arbiter.finalRecommendation}"
    if intent == "approval_priority":
        return f"{customer.name} needs a decision on the action most ready for owner assignment and near-term execution. {arbiter.finalRecommendation}"
    if intent == "commercial_risk":
        return f"{customer.name}'s risk should be handled as {analysis.primary_cause}, not as a pricing-only issue. {arbiter.finalRecommendation}"
    if analysis.archetype == "low-risk stable customer":
        return f"{customer.name} appears stable, with no urgent retention action required beyond monitoring."
    return f"{customer.name} is at risk because of {analysis.primary_cause}. {arbiter.finalRecommendation}"
