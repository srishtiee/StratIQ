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
    return {
        "portfolioAtRisk": 18,
        "renewalWindow": 7,
        "executiveConfidence": "74%",
        "actionQueue": 4,
    }


@app.get("/api/customers")
def customers() -> list[dict]:
    return [
        {
            "id": "c-102",
            "name": "Northstar Fiber",
            "riskLevel": "Critical",
            "churnProbability": 0.82,
        },
        {
            "id": "c-204",
            "name": "Aster Retail Group",
            "riskLevel": "High",
            "churnProbability": 0.67,
        },
    ]


@app.get("/api/customers/{customer_id}")
def customer_detail(customer_id: str) -> dict:
    return {
        "id": customer_id,
        "name": "Northstar Fiber",
        "segment": "Enterprise Telecom",
        "recommendedAction": "Approve save offer and executive outreach.",
    }


@app.post("/api/ask")
def ask(payload: WorkflowRequest) -> dict:
    return {
        "requestId": "wf-live-001",
        "submittedAt": datetime.now(timezone.utc).isoformat(),
        "requestSummary": f"Review retention strategy for: {payload.prompt}",
        "status": "reviewing",
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
