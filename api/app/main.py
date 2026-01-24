from datetime import datetime, timezone
from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel


class WorkflowRequest(BaseModel):
    prompt: str
    focusCustomerId: str | None = None


class FeedbackPayload(BaseModel):
    requestId: str
    verdict: Literal["approve", "revise"]
    note: str


class ActionPayload(BaseModel):
    approvalId: str


INSIGHTS = {
    "portfolioAtRisk": 18,
    "renewalWindow": 7,
    "executiveConfidence": "74%",
    "actionQueue": 4,
    "riskMix": [
        {"label": "Critical", "count": 4, "accent": "#c45c56"},
        {"label": "High", "count": 7, "accent": "#c9852a"},
        {"label": "Moderate", "count": 5, "accent": "#1f6d73"},
        {"label": "Low", "count": 2, "accent": "#3d8a62"},
    ],
    "highlights": [
        "Northstar Fiber shows sharp usage decay and rising escalation volume in the last 21 days.",
        "Four strategic accounts enter a renewal window this week with unresolved executive concerns.",
        "Save-offer readiness is strongest where billing friction and support load appear together.",
    ],
}

CUSTOMERS = [
    {
        "id": "c-102",
        "name": "Northstar Fiber",
        "segment": "Enterprise Telecom",
        "plan": "Strategic 360",
        "monthlyRevenue": 124000,
        "riskLevel": "Critical",
        "churnProbability": 0.82,
        "healthScore": 38,
        "renewalDate": "Apr 14",
        "ticketLoad": "12 open, 3 escalated",
        "lastActivity": "Usage down 29% WoW",
        "topDrivers": [
            "Repeated network support escalations",
            "Low product adoption in premium modules",
            "Contract renewal within 17 days",
        ],
        "recommendedAction": "Approve save package with executive outreach",
        "accountOwner": "Khushi Patel",
    },
    {
        "id": "c-204",
        "name": "Aster Retail Group",
        "segment": "Retail Analytics",
        "plan": "Growth Ops",
        "monthlyRevenue": 86000,
        "riskLevel": "High",
        "churnProbability": 0.67,
        "healthScore": 51,
        "renewalDate": "Apr 27",
        "ticketLoad": "5 open, 1 escalated",
        "lastActivity": "Stakeholder inactivity for 11 days",
        "topDrivers": [
            "Reduced weekly active usage",
            "Executive sponsor changed recently",
            "Competing vendor trial mentioned in ticket notes",
        ],
        "recommendedAction": "Trigger adoption recovery plan with sponsor mapping",
        "accountOwner": "Srishti Bankar",
    },
    {
        "id": "c-319",
        "name": "Lattice Health",
        "segment": "Healthcare Platforms",
        "plan": "Compliance Plus",
        "monthlyRevenue": 93000,
        "riskLevel": "Moderate",
        "churnProbability": 0.43,
        "healthScore": 66,
        "renewalDate": "May 9",
        "ticketLoad": "3 open, 0 escalated",
        "lastActivity": "Stable login volume, low feature depth",
        "topDrivers": [
            "Limited workflow expansion after onboarding",
            "Champion engagement limited to one team",
            "Open roadmap dependency on reporting exports",
        ],
        "recommendedAction": "Recommend targeted enablement sprint",
        "accountOwner": "Kashish Desai",
    },
]

APPROVAL = {
    "id": "ap-441",
    "customerId": "c-102",
    "customerName": "Northstar Fiber",
    "action": "Approve tailored save package and exec sponsor call",
    "owner": "RevOps Director",
    "priority": "Urgent",
    "status": "Pending",
    "rationale": "Highest revenue risk account with converging support, renewal, and usage decay signals.",
    "estimatedImpact": "Potentially protects $372k annualized revenue",
    "dueLabel": "Needs sign-off in 24 hours",
}

EVIDENCE = [
    {
        "id": "ev-1",
        "title": "Usage trend anomaly",
        "source": "Product telemetry",
        "snippet": "Premium workflow adoption fell 29% week-over-week across the last three reporting windows.",
    },
    {
        "id": "ev-2",
        "title": "Escalation concentration",
        "source": "Support desk",
        "snippet": "Three executive-visible tickets are still open and two reference service reliability concerns.",
    },
    {
        "id": "ev-3",
        "title": "Commercial timing",
        "source": "Renewal calendar",
        "snippet": "Renewal decision date is 17 days away with no confirmed sponsor alignment call on record.",
    },
]

MESSAGES = [
    {
        "id": "ag-1",
        "agent": "Analyst Agent",
        "tone": "Structured risk synthesis",
        "summary": "Northstar Fiber sits in the highest churn cohort because support strain and low adoption now overlap with the renewal window.",
        "recommendation": "Do not wait for another telemetry cycle. Treat the account as intervention-ready.",
        "confidence": 0.86,
        "status": "complete",
        "evidenceIds": ["ev-1", "ev-2", "ev-3"],
    },
    {
        "id": "ag-2",
        "agent": "Researcher Agent",
        "tone": "Ticket and account context",
        "summary": "Recent account notes reference competitor benchmarking and dissatisfaction with time-to-resolution.",
        "recommendation": "Anchor the plan around trust recovery and an executive relationship reset, not only discounting.",
        "confidence": 0.77,
        "status": "watch",
        "evidenceIds": ["ev-2", "ev-3"],
    },
    {
        "id": "ag-3",
        "agent": "Planner Agent",
        "tone": "Decision proposal",
        "summary": "The highest-probability save path combines a short-term commercial offer with a sponsor-level remediation call and a 14-day onboarding reset.",
        "recommendation": "Route to approval with one named owner, due within 24 hours, and log the action in the audit trail.",
        "confidence": 0.81,
        "status": "complete",
        "evidenceIds": ["ev-1", "ev-2", "ev-3"],
    },
]


app = FastAPI(
    title="StratIQ API Stub",
    description="Phase 1 contract-aligned API for the StratIQ frontend prototype.",
    version="0.1.0",
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/insights")
def insights() -> dict:
    return INSIGHTS


@app.get("/api/customers")
def customers() -> list[dict]:
    return CUSTOMERS


@app.get("/api/customers/{customer_id}")
def customer_detail(customer_id: str) -> dict:
    return next((customer for customer in CUSTOMERS if customer["id"] == customer_id), CUSTOMERS[0])


@app.post("/api/ask")
def ask(payload: WorkflowRequest) -> dict:
    target_customer = next(
        (customer for customer in CUSTOMERS if customer["id"] == payload.focusCustomerId),
        CUSTOMERS[0],
    )

    return {
        "requestId": "wf-live-001",
        "submittedAt": datetime.now(timezone.utc).isoformat(),
        "requestSummary": payload.prompt or f"Review retention strategy for: {target_customer['name']}",
        "status": "reviewing",
        "evidence": EVIDENCE,
        "messages": MESSAGES,
        "approval": {**APPROVAL, "customerId": target_customer["id"], "customerName": target_customer["name"]},
    }


@app.post("/api/action")
def action(payload: ActionPayload) -> dict:
    return {
        "id": payload.approvalId,
        "status": "queued",
        "summary": "Approval captured and handed to the execution layer.",
        "auditNote": "Phase 1 stub recorded the request without side effects.",
    }


@app.post("/api/feedback")
def feedback(payload: FeedbackPayload) -> dict:
    return {
        "requestId": payload.requestId,
        "verdict": payload.verdict,
        "note": payload.note,
        "recordedAt": datetime.now(timezone.utc).isoformat(),
    }
