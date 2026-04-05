from datetime import datetime
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import (
    Action,
    Approval,
    AuditRecord,
    Customer,
    DocumentChunk,
    Feedback,
    RunDecision,
    RunEvidence,
    SupportTicket,
    UsageMetric,
    User,
    WorkflowRun,
)


CUSTOMER_SEED = [
    {
        "id": "c-102",
        "name": "Northstar Fiber",
        "segment": "Enterprise Telecom",
        "plan": "Strategic 360",
        "monthly_revenue": 124000,
        "risk_level": "Critical",
        "churn_probability": 0.82,
        "health_score": 38,
        "renewal_date": "2026-05-17",
        "account_owner": "Khushi Patel",
    },
    {
        "id": "c-204",
        "name": "Aster Retail Group",
        "segment": "Retail Analytics",
        "plan": "Growth Ops",
        "monthly_revenue": 86000,
        "risk_level": "High",
        "churn_probability": 0.67,
        "health_score": 51,
        "renewal_date": "2026-06-02",
        "account_owner": "Srishti Bankar",
    },
    {
        "id": "c-319",
        "name": "Lattice Health",
        "segment": "Healthcare Platforms",
        "plan": "Compliance Plus",
        "monthly_revenue": 93000,
        "risk_level": "Moderate",
        "churn_probability": 0.43,
        "health_score": 66,
        "renewal_date": "2026-06-14",
        "account_owner": "Kashish Desai",
    },
    {
        "id": "c-411",
        "name": "BlueHarbor Logistics",
        "segment": "Supply Chain",
        "plan": "Forecast Pro",
        "monthly_revenue": 71000,
        "risk_level": "High",
        "churn_probability": 0.62,
        "health_score": 54,
        "renewal_date": "2026-05-29",
        "account_owner": "Khushi Patel",
    },
    {
        "id": "c-522",
        "name": "Crestline Energy",
        "segment": "Utilities",
        "plan": "Field Ops Core",
        "monthly_revenue": 64000,
        "risk_level": "Moderate",
        "churn_probability": 0.41,
        "health_score": 69,
        "renewal_date": "2026-06-21",
        "account_owner": "Srishti Bankar",
    },
    {
        "id": "c-633",
        "name": "Orion Capital Services",
        "segment": "Financial Services",
        "plan": "Risk Command",
        "monthly_revenue": 118000,
        "risk_level": "Critical",
        "churn_probability": 0.79,
        "health_score": 42,
        "renewal_date": "2026-05-12",
        "account_owner": "Kashish Desai",
    },
    {
        "id": "c-744",
        "name": "Summit Grove Insurance",
        "segment": "Insurance Operations",
        "plan": "Claims Intelligence",
        "monthly_revenue": 97000,
        "risk_level": "High",
        "churn_probability": 0.71,
        "health_score": 49,
        "renewal_date": "2026-05-24",
        "account_owner": "Khushi Patel",
    },
    {
        "id": "c-855",
        "name": "Meridian CloudWorks",
        "segment": "Cloud Infrastructure",
        "plan": "Reliability Command",
        "monthly_revenue": 142000,
        "risk_level": "High",
        "churn_probability": 0.69,
        "health_score": 47,
        "renewal_date": "2026-06-05",
        "account_owner": "Srishti Bankar",
    },
    {
        "id": "c-966",
        "name": "Harborline Manufacturing",
        "segment": "Industrial Manufacturing",
        "plan": "Factory Ops Pro",
        "monthly_revenue": 76000,
        "risk_level": "High",
        "churn_probability": 0.64,
        "health_score": 52,
        "renewal_date": "2026-06-09",
        "account_owner": "Kashish Desai",
    },
    {
        "id": "c-107",
        "name": "Atlas University Network",
        "segment": "Higher Education",
        "plan": "Engagement Core",
        "monthly_revenue": 52000,
        "risk_level": "Moderate",
        "churn_probability": 0.36,
        "health_score": 72,
        "renewal_date": "2026-07-08",
        "account_owner": "Khushi Patel",
    },
    {
        "id": "c-218",
        "name": "Noble Foods Cooperative",
        "segment": "Food Distribution",
        "plan": "Supply Pulse",
        "monthly_revenue": 68000,
        "risk_level": "Moderate",
        "churn_probability": 0.46,
        "health_score": 63,
        "renewal_date": "2026-06-28",
        "account_owner": "Srishti Bankar",
    },
    {
        "id": "c-429",
        "name": "Pioneer Civic Labs",
        "segment": "Public Sector",
        "plan": "Citizen Ops",
        "monthly_revenue": 59000,
        "risk_level": "Low",
        "churn_probability": 0.18,
        "health_score": 84,
        "renewal_date": "2026-08-18",
        "account_owner": "Kashish Desai",
    },
    {
        "id": "c-530",
        "name": "Evergreen Robotics",
        "segment": "Advanced Manufacturing",
        "plan": "Automation Growth",
        "monthly_revenue": 104000,
        "risk_level": "Low",
        "churn_probability": 0.16,
        "health_score": 88,
        "renewal_date": "2026-09-02",
        "account_owner": "Khushi Patel",
    },
    {
        "id": "c-641",
        "name": "Redwood Media Group",
        "segment": "Media Analytics",
        "plan": "Audience 360",
        "monthly_revenue": 73000,
        "risk_level": "Moderate",
        "churn_probability": 0.39,
        "health_score": 68,
        "renewal_date": "2026-07-15",
        "account_owner": "Srishti Bankar",
    },
]

USAGE_SEED = [
    ("um-001", "c-102", "2026-W17", 94, -29.0, 41.0, 1180),
    ("um-002", "c-204", "2026-W17", 121, -16.0, 53.0, 1324),
    ("um-003", "c-319", "2026-W17", 88, -4.0, 57.0, 991),
    ("um-004", "c-411", "2026-W17", 102, -18.0, 44.0, 1104),
    ("um-005", "c-522", "2026-W17", 109, -7.0, 49.0, 1275),
    ("um-006", "c-633", "2026-W17", 97, -23.0, 38.0, 1058),
    ("um-007", "c-744", "2026-W17", 114, -11.0, 61.0, 1490),
    ("um-008", "c-855", "2026-W17", 82, -24.0, 35.0, 940),
    ("um-009", "c-966", "2026-W17", 76, -19.0, 32.0, 865),
    ("um-010", "c-107", "2026-W17", 132, 4.0, 64.0, 1522),
    ("um-011", "c-218", "2026-W17", 101, -9.0, 46.0, 1096),
    ("um-012", "c-429", "2026-W17", 141, 8.0, 72.0, 1718),
    ("um-013", "c-530", "2026-W17", 156, 12.0, 79.0, 1884),
    ("um-014", "c-641", "2026-W17", 118, -6.0, 55.0, 1261),
]

TICKET_SEED = [
    ("st-001", "c-102", "Reliability escalation on automation service", "P1", "Open",
     "Two executive-visible incidents remain open and the customer has asked for sponsor-level communication."),
    ("st-002", "c-102", "Premium module adoption blocked by workflow failure", "P2", "Open",
     "Customer success notes show repeated friction in premium automation onboarding."),
    ("st-009", "c-102", "Sponsor asks for remediation calendar", "P1", "Open",
     "The executive sponsor requested a dated reliability plan before renewing the strategic automation workstream."),
    ("st-010", "c-102", "Procurement paused expansion order", "P2", "Open",
     "Procurement paused the expansion order until confidence in service reliability improves."),
    ("st-003", "c-204", "Competitor trial referenced during QBR prep", "P2", "Open",
     "Account team notes indicate competitor benchmarking is active during commercial review."),
    ("st-004", "c-204", "Stakeholder transition slowed decision cadence", "P3", "Open",
     "New sponsor has not attended the last two adoption checkpoints."),
    ("st-011", "c-204", "Store analytics usage concentrated in one region", "P3", "Open",
     "Only the west region is using the replenishment dashboards, leaving enterprise adoption below plan."),
    ("st-012", "c-204", "Pricing committee requested competitor comparison", "P2", "Open",
     "The buying committee asked for a side-by-side benchmark against a lower-priced analytics vendor."),
    ("st-005", "c-319", "Reporting export dependency", "P3", "Open",
     "Champion is waiting for roadmap confirmation before expanding the deployment."),
    ("st-013", "c-319", "HIPAA workflow attestation requested", "P2", "Open",
     "Security review asked for proof that upcoming reporting exports preserve auditability and access controls."),
    ("st-014", "c-319", "Clinical operations expansion pending roadmap", "P3", "Open",
     "Expansion to clinical operations is blocked until roadmap dates are confirmed for compliance reporting."),
    ("st-006", "c-411", "Dispatch analytics latency concern", "P2", "Open",
     "Operations leader flagged export latency during weekly review."),
    ("st-015", "c-411", "Non-discount recovery path requested", "P3", "Open",
     "The account owner asked whether workflow tuning and dispatch enablement could prevent a pricing concession."),
    ("st-016", "c-411", "Carrier scorecards delayed", "P2", "Open",
     "Carrier scorecards are arriving one day late, weakening confidence in operational planning."),
    ("st-007", "c-522", "Mobile workflow training gap", "P3", "Open",
     "Field teams have not adopted the latest mobile workflow update."),
    ("st-017", "c-522", "Regional managers missed training cohort", "P3", "Open",
     "Two field regions missed the latest mobile workflow training and are still using manual workarounds."),
    ("st-018", "c-522", "Field adoption champion reassigned", "P3", "Closed",
     "The original enablement champion moved teams, leaving adoption ownership unclear for the next rollout."),
    ("st-008", "c-633", "Analytics refresh delay caused trust concern", "P1", "Open",
     "Leadership questioned dashboard timeliness during renewal planning."),
    ("st-019", "c-633", "Risk model freshness questioned by audit team", "P1", "Open",
     "Internal audit flagged that stale risk scores could undermine board reporting confidence."),
    ("st-020", "c-633", "Compliance committee requested evidence trail", "P2", "Open",
     "The compliance committee asked for stronger evidence lineage before expanding executive analytics access."),
    ("st-021", "c-744", "Claims director sponsor transition", "P2", "Open",
     "The claims director sponsoring the rollout left the company, and the replacement has not accepted the success plan."),
    ("st-022", "c-744", "Renewal committee asked for business case refresh", "P3", "Open",
     "Finance requested a refreshed retention value case after sponsor turnover slowed the claims analytics rollout."),
    ("st-023", "c-744", "Regional adoption uneven after reorg", "P3", "Open",
     "Three claims regions continue to use legacy dashboards after the operating model reorganization."),
    ("st-024", "c-855", "Reliability dashboard misses infrastructure events", "P1", "Open",
     "The infrastructure team reported that incident health dashboards missed two high-severity events."),
    ("st-025", "c-855", "Engineering leader requests trust review", "P2", "Open",
     "The engineering sponsor asked for a reliability trust review before expanding platform usage."),
    ("st-026", "c-855", "On-call analytics workflow underused", "P3", "Open",
     "On-call managers still export incident summaries manually instead of using premium workflow automation."),
    ("st-027", "c-966", "Factory onboarding stalled after pilot", "P2", "Open",
     "Three plants completed pilot training but never moved supervisors into the live workflow."),
    ("st-028", "c-966", "Implementation owner changed twice", "P2", "Open",
     "The implementation owner changed twice in six weeks, leaving factory rollout milestones unclear."),
    ("st-029", "c-966", "Operators cite training gap", "P3", "Open",
     "Line supervisors say the current training path does not fit shift handoff routines."),
    ("st-030", "c-107", "Student engagement reporting stable", "P4", "Closed",
     "The university analytics office confirmed weekly reporting is stable and expansion planning is on track."),
    ("st-031", "c-218", "Cold-chain exception workflow lightly adopted", "P3", "Open",
     "Cold-chain managers are using alerts but have not adopted the premium exception workflow."),
    ("st-032", "c-218", "Distributor margin pressure discussed", "P3", "Open",
     "Finance mentioned margin pressure but has not requested pricing concessions."),
    ("st-033", "c-429", "Quarterly service review completed", "P4", "Closed",
     "The civic analytics team completed quarterly review with no material blockers."),
    ("st-034", "c-530", "Automation expansion approved", "P4", "Closed",
     "The robotics team approved expansion to two additional manufacturing lines after strong adoption."),
    ("st-035", "c-641", "Campaign attribution roadmap requested", "P3", "Open",
     "Marketing operations wants clearer roadmap dates before expanding audience analytics usage."),
]

DOCUMENT_CHUNK_SEED = [
    ("dc-001", "c-102", "customer_note", "note-001", "Executive sponsor concern", "Sponsor asked for a dated reliability plan and accountable owner before renewal."),
    ("dc-002", "c-204", "customer_note", "note-002", "Commercial committee context", "Buying committee requested competitor benchmark and value proof before concessions."),
    ("dc-003", None, "playbook", "playbook-001", "Risk review baseline", "When evidence depth is low, recommendations should be flagged provisional and approval criteria tightened."),
]


def _append_demo_history(session: Session) -> None:
    workflow_run = WorkflowRun(
        id="run-002",
        customer_id="c-204",
        prompt="Assess retention risk for Aster Retail Group ahead of sponsor review.",
        workflow_type="customer_churn",
        request_summary="Assess retention risk for Aster Retail Group ahead of sponsor review.",
        summary="Aster Retail Group shows elevated churn risk driven by declining usage and sponsor transition.",
        status="approved",
        submitted_at=datetime.fromisoformat("2026-04-29T16:05:00+00:00"),
    )
    session.add(workflow_run)
    session.flush()

    session.add_all(
        [
            RunEvidence(
                id="re-201",
                run_id="run-002",
                source_type="usage_metric",
                source_id="um-002",
                title="Weekly active usage contracted 16%",
                snippet="Usage contraction is concentrated in premium analytics cohorts.",
                relevance="Signals weaker product stickiness before renewal planning.",
            ),
            RunEvidence(
                id="re-202",
                run_id="run-002",
                source_type="support_ticket",
                source_id="st-003",
                title="Competitive pressure referenced in notes",
                snippet="Account team notes reference competitor benchmarking during the latest review cycle.",
                relevance="Raises urgency for an adoption and sponsor-alignment response.",
            ),
        ]
    )

    session.add(
        RunDecision(
            id="rd-002",
            run_id="run-002",
            planner_summary="Primary path is adoption reset with sponsor mapping and pricing held as a secondary support lever.",
            planner_options=[
                {
                    "id": "strategy-201",
                    "title": "Adoption reset package",
                    "description": "Run targeted enablement and sponsor mapping before pricing discussion.",
                    "owner": "RevOps Director",
                    "expectedImpact": "Improve sponsor confidence and feature depth within 30 days.",
                    "deliveryWindow": "72 hours",
                }
            ],
            risk_verdict="pass",
            risk_critique="No major compliance blockers. Ensure sponsor change risk is addressed before commercial negotiation.",
            risk_concerns=["Sponsor engagement is currently weak."],
            risk_required_checks=["Confirm sponsor attendance for enablement checkpoint."],
            arbiter_strategy_id="strategy-201",
            arbiter_final_recommendation="Approve the adoption reset and sponsor mapping package.",
            arbiter_rationale="This route addresses the root cause before pricing is used as the first lever.",
            arbiter_confidence_label="Moderate confidence",
        )
    )

    session.add(
        Approval(
            id="approval-002",
            run_id="run-002",
            customer_id="c-204",
            action_title="Approve adoption reset and sponsor mapping package",
            owner="RevOps Director",
            priority="High",
            status="approved",
            rationale="Usage recovery is still plausible if account ownership and adoption blockers are addressed quickly.",
            estimated_impact="Improves expansion likelihood and reduces churn probability for a $1M account segment.",
            due_label="Review this week",
            created_at=datetime.fromisoformat("2026-04-29T16:10:00+00:00"),
        )
    )
    session.flush()
    session.add(
        Action(
            id="action-001",
            approval_id="approval-002",
            status="approved",
            summary="Approval recorded and routed to the retention operating queue.",
            audit_note="Owner routing confirmed for RevOps Director and Customer Success Director.",
            executed_at=datetime.fromisoformat("2026-04-29T16:20:00+00:00"),
        )
    )
    session.add(
        AuditRecord(
            id="audit-001",
            run_id="run-002",
            approval_id="approval-002",
            event_type="workflow_run",
            actor="StratIQ",
            message="Aster Retail Group package created and surfaced for review.",
            created_at=datetime.fromisoformat("2026-04-29T16:12:00+00:00"),
        )
    )
    session.add(
        AuditRecord(
            id="audit-002",
            approval_id="approval-002",
            event_type="approval",
            actor="Customer Success Director",
            message="Aster Retail Group package moved to Approved status.",
            created_at=datetime.fromisoformat("2026-04-29T16:20:00+00:00"),
        )
    )


def seed_database(session: Session) -> None:
    for user in [
        User(id="user-001", name="Khushi Patel", email="khushi@stratiq.local", role="CXO Product Lead"),
        User(id="user-002", name="Srishti Bankar", email="srishti@stratiq.local", role="Customer Success Lead"),
        User(id="user-003", name="Kashish Desai", email="kashish@stratiq.local", role="RevOps Director"),
    ]:
        session.merge(user)

    for payload in CUSTOMER_SEED:
        session.merge(Customer(**payload))

    for metric_id, customer_id, period_label, weekly_active_users, usage_change_pct, premium_feature_adoption_pct, login_volume in USAGE_SEED:
        session.merge(
            UsageMetric(
                id=metric_id,
                customer_id=customer_id,
                period_label=period_label,
                weekly_active_users=weekly_active_users,
                usage_change_pct=usage_change_pct,
                premium_feature_adoption_pct=premium_feature_adoption_pct,
                login_volume=login_volume,
            )
        )

    for ticket_id, customer_id, title, severity, status, snippet in TICKET_SEED:
        session.merge(
            SupportTicket(
                id=ticket_id,
                customer_id=customer_id,
                title=title,
                severity=severity,
                status=status,
                snippet=snippet,
            )
        )

    for chunk_id, customer_id, source_type, source_id, title, content in DOCUMENT_CHUNK_SEED:
        session.merge(
            DocumentChunk(
                id=chunk_id,
                customer_id=customer_id,
                source_type=source_type,
                source_id=source_id,
                title=title,
                content=content,
            )
        )

    if session.get(WorkflowRun, "run-002") is None:
        _append_demo_history(session)
    session.commit()
