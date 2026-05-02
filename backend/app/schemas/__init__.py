"""
StratIQ Backend — Pydantic Schemas

All request/response models for the API layer.
"""
from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional, Any
from uuid import UUID
from datetime import datetime, date


# ─── Common ───────────────────────────────────────────────────────────────────

class KPIItem(BaseModel):
    name: str
    value: float | str
    unit: Optional[str] = None
    trend: Optional[str] = None  # 'up' | 'down' | 'stable'
    change_pct: Optional[float] = None


class EvidenceItem(BaseModel):
    source_type: str
    source_title: str
    snippet: str
    relevance_score: float
    metadata: dict = {}


class ReasoningStep(BaseModel):
    agent: str
    label: str
    content: str


# ─── Ask ──────────────────────────────────────────────────────────────────────

class AskRequest(BaseModel):
    question: str = Field(..., min_length=5, max_length=1000)
    workflow: str = Field(default="churn", pattern="^(churn|attrition)$")
    filters: dict = {}
    session_id: Optional[UUID] = None


class DecisionCard(BaseModel):
    headline: str
    rationale: str
    key_metrics: list[KPIItem]
    cited_evidence: list[EvidenceItem]
    main_risks: list[str]
    assumptions: list[str]
    action_suggestion: str
    kpis_to_monitor: list[str]


class AskResponse(BaseModel):
    run_id: UUID
    summary: str
    kpis: list[KPIItem]
    evidence: list[EvidenceItem]
    reasoning: list[ReasoningStep]
    decision_card: DecisionCard
    action_id: Optional[UUID] = None
    action_status: Optional[str] = None
    created_at: datetime


# ─── Customers ────────────────────────────────────────────────────────────────

class SubscriptionResponse(BaseModel):
    id: UUID
    plan: str
    mrr: float
    contract_start: date
    contract_end: date
    renewal_probability: float
    status: str


class CustomerListItem(BaseModel):
    id: UUID
    name: str
    industry: Optional[str]
    tier: Optional[str]
    region: Optional[str]
    account_owner: Optional[str]
    subscription_status: Optional[str] = None
    renewal_probability: Optional[float] = None
    mrr: Optional[float] = None
    churn_signal_count: int = 0


class CustomerDetail(CustomerListItem):
    subscription: Optional[SubscriptionResponse] = None
    recent_signals: list[dict] = []
    latest_usage: Optional[dict] = None


# ─── KPIs ─────────────────────────────────────────────────────────────────────

class KPISnapshotResponse(BaseModel):
    snapshot_date: date
    metrics: list[KPIItem]


# ─── Actions ──────────────────────────────────────────────────────────────────

class ActionCreate(BaseModel):
    run_id: Optional[UUID] = None
    action_type: str = Field(..., pattern="^(retention_outreach|strategy_brief|segment_flag|internal_rec)$")
    title: str = Field(..., min_length=3, max_length=200)
    description: Optional[str] = None
    target_entity: dict = {}
    priority: str = Field(default="medium", pattern="^(low|medium|high|critical)$")
    due_date: Optional[date] = None


class ActionResponse(BaseModel):
    id: UUID
    run_id: Optional[UUID]
    action_type: str
    title: str
    description: Optional[str]
    target_entity: dict
    status: str
    priority: str
    due_date: Optional[date]
    created_at: datetime
    updated_at: datetime


class ApprovalCreate(BaseModel):
    decision: str = Field(..., pattern="^(approved|rejected|deferred)$")
    notes: Optional[str] = None


# ─── Feedback ─────────────────────────────────────────────────────────────────

class FeedbackCreate(BaseModel):
    run_id: UUID
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None


# ─── Insights (Run history) ───────────────────────────────────────────────────

class RunSummary(BaseModel):
    id: UUID
    workflow: str
    question: str
    status: str
    summary: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None


# ─── Audit ────────────────────────────────────────────────────────────────────

class AuditLogResponse(BaseModel):
    id: UUID
    event_type: str
    entity_type: Optional[str]
    entity_id: Optional[UUID]
    metadata: dict
    created_at: datetime
