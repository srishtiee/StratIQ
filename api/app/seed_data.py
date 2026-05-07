from datetime import datetime
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

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
]

USAGE_SEED = [
    ("um-001", "c-102", "2026-W17", 94, -29.0, 41.0, 1180),
    ("um-002", "c-204", "2026-W17", 121, -16.0, 53.0, 1324),
    ("um-003", "c-319", "2026-W17", 88, -4.0, 57.0, 991),
    ("um-004", "c-411", "2026-W17", 102, -18.0, 44.0, 1104),
    ("um-005", "c-522", "2026-W17", 109, -7.0, 49.0, 1275),
    ("um-006", "c-633", "2026-W17", 97, -23.0, 38.0, 1058),
]

TICKET_SEED = [
    ("st-001", "c-102", "Reliability escalation on automation service", "P1", "Open",
     "Two executive-visible incidents remain open and the customer has asked for sponsor-level communication."),
    ("st-002", "c-102", "Premium module adoption blocked by workflow failure", "P2", "Open",
     "Customer success notes show repeated friction in premium automation onboarding."),
    ("st-003", "c-204", "Competitor trial referenced during QBR prep", "P2", "Open",
     "Account team notes indicate competitor benchmarking is active during commercial review."),
    ("st-004", "c-204", "Stakeholder transition slowed decision cadence", "P3", "Open",
     "New sponsor has not attended the last two adoption checkpoints."),
    ("st-005", "c-319", "Reporting export dependency", "P3", "Open",
     "Champion is waiting for roadmap confirmation before expanding the deployment."),
    ("st-006", "c-411", "Dispatch analytics latency concern", "P2", "Open",
     "Operations leader flagged export latency during weekly review."),
    ("st-007", "c-522", "Mobile workflow training gap", "P3", "Open",
     "Field teams have not adopted the latest mobile workflow update."),
    ("st-008", "c-633", "Analytics refresh delay caused trust concern", "P1", "Open",
     "Leadership questioned dashboard timeliness during renewal planning."),
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
            status="Approved",
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
            actor="Comms Agent",
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
    existing_customer = session.scalar(select(Customer.id).limit(1))
    if existing_customer:
        return

    # Passwords: all three use "password123"
    # Roles: admin > approver > viewer
    # Demo: log in as each to see different nav/permissions
    session.add_all(
        [
            User(
                id="user-001",
                username="admin",
                hashed_password="$2b$12$N1LFnkfcHq2SxtPxjpBM6ufY8MuTKDzFPrF/XzdX7xyWS31.gAD3a",
                name="Admin User",
                email="admin@stratiq.local",
                role="admin",
            ),
            User(
                id="user-002",
                username="analyst",
                hashed_password="$2b$12$N1LFnkfcHq2SxtPxjpBM6ufY8MuTKDzFPrF/XzdX7xyWS31.gAD3a",
                name="Analyst User",
                email="analyst@stratiq.local",
                role="approver",
            ),
            User(
                id="user-003",
                username="viewer",
                hashed_password="$2b$12$N1LFnkfcHq2SxtPxjpBM6ufY8MuTKDzFPrF/XzdX7xyWS31.gAD3a",
                name="Viewer User",
                email="viewer@stratiq.local",
                role="viewer",
            ),
        ]
    )

    session.add_all(Customer(**payload) for payload in CUSTOMER_SEED)
    session.add_all(
        UsageMetric(
            id=metric_id,
            customer_id=customer_id,
            period_label=period_label,
            weekly_active_users=weekly_active_users,
            usage_change_pct=usage_change_pct,
            premium_feature_adoption_pct=premium_feature_adoption_pct,
            login_volume=login_volume,
        )
        for metric_id, customer_id, period_label, weekly_active_users, usage_change_pct, premium_feature_adoption_pct, login_volume in USAGE_SEED
    )
    session.add_all(
        SupportTicket(
            id=ticket_id,
            customer_id=customer_id,
            title=title,
            severity=severity,
            status=status,
            snippet=snippet,
        )
        for ticket_id, customer_id, title, severity, status, snippet in TICKET_SEED
    )

    _append_demo_history(session)
    session.commit()
