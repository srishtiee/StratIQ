from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class EvidenceItem(BaseModel):
    id: str
    sourceType: Literal["usage_metric", "support_ticket", "renewal_signal", "account_note"]
    sourceId: str
    title: str
    snippet: str
    relevance: str


class StrategyOption(BaseModel):
    id: str
    title: str
    description: str
    owner: str
    expectedImpact: str
    deliveryWindow: str


class PlannerOutput(BaseModel):
    agent: Literal["Planner Agent"] = "Planner Agent"
    summary: str
    strategies: list[StrategyOption]


class RiskReview(BaseModel):
    agent: Literal["Risk/Compliance Agent"] = "Risk/Compliance Agent"
    verdict: Literal["pass", "caution", "block"]
    critique: str
    concerns: list[str]
    requiredChecks: list[str]


class ArbiterDecision(BaseModel):
    agent: Literal["Arbiter Agent"] = "Arbiter Agent"
    selectedStrategyId: str
    finalRecommendation: str
    rationale: str
    confidenceLabel: str


class ApprovalRequest(BaseModel):
    id: str
    runId: str
    customerId: str
    customerName: str
    actionTitle: str
    owner: str
    priority: Literal["Normal", "High", "Urgent"]
    status: Literal["Pending", "Ready", "Approved", "Rejected", "Executed"]
    rationale: str
    estimatedImpact: str
    dueLabel: str
    createdAt: str


class ActionResult(BaseModel):
    id: str
    approvalId: str
    status: Literal["queued", "approved", "rejected", "executed"]
    summary: str
    auditNote: str
    executedAt: str | None = None


class WorkflowRunSummary(BaseModel):
    id: str
    workflowType: Literal["customer_churn", "employee_attrition"]
    submittedAt: str
    status: Literal["pending", "completed", "needs_review", "approved"]
    summary: str
    finalRecommendation: str


class AuditRecord(BaseModel):
    id: str
    runId: str | None = None
    approvalId: str | None = None
    eventType: Literal["workflow_run", "feedback", "approval", "action"]
    actor: str
    message: str
    createdAt: str


class WorkflowRequest(BaseModel):
    prompt: str
    focusCustomerId: str | None = None
    workflowType: Literal["customer_churn", "employee_attrition"] = "customer_churn"


class FeedbackPayload(BaseModel):
    requestId: str
    verdict: Literal["approve", "revise"]
    note: str


class ApprovalActionPayload(BaseModel):
    approvalId: str
    decision: Literal["approve", "mark_ready", "reject", "execute"] = "approve"


class TargetEntity(BaseModel):
    id: str
    name: str
    segment: str


class WorkflowResponse(BaseModel):
    requestId: str
    submittedAt: str
    workflowType: Literal["customer_churn", "employee_attrition"]
    requestSummary: str
    status: Literal["pending", "completed", "needs_review", "approved"]
    targetEntity: TargetEntity
    summary: str
    evidence: list[EvidenceItem]
    plannerOutput: PlannerOutput
    riskReview: RiskReview
    arbiterDecision: ArbiterDecision
    approval: ApprovalRequest
    actionHistory: list[ActionResult]
    auditRecords: list[AuditRecord]


class CustomerRiskSummary(BaseModel):
    id: str
    name: str
    segment: str
    plan: str
    monthlyRevenue: float
    riskLevel: Literal["Low", "Moderate", "High", "Critical"]
    churnProbability: float
    healthScore: int
    renewalDate: str
    accountOwner: str
    ticketLoad: str
    lastActivity: str
    topDrivers: list[str]
    recommendedAction: str


class CustomerDetail(CustomerRiskSummary):
    evidence: list[EvidenceItem]
    recentRuns: list[WorkflowRunSummary]
    latestApproval: ApprovalRequest | None = None


class DashboardInsights(BaseModel):
    portfolioAtRisk: int
    renewalWindow: int
    executiveConfidence: str
    actionQueue: int
    riskMix: list[dict]
    highlights: list[str]


class HealthResponse(BaseModel):
    status: str
    database: str


class RecordFeedbackResponse(BaseModel):
    requestId: str
    verdict: Literal["approve", "revise"]
    note: str
    recordedAt: str


class BaseOrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)
