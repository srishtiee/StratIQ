from contextlib import asynccontextmanager
from time import perf_counter
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from .auth import Actor, require_roles
from .auth_routes import router as auth_router
from .config import settings
from .database import Base, SessionLocal, engine, get_db
from .logging_config import logger
from .schemas import (
    ActionResult,
    ApprovalActionPayload,
    ApprovalRequest,
    AuditRecord,
    CustomerDetail,
    CustomerRiskSummary,
    DashboardInsights,
    FeedbackPayload,
    HealthResponse,
    RecordFeedbackResponse,
    WorkflowRequest,
    WorkflowResponse,
)
from .schema_patches import apply_schema_patches
from .seed_data import seed_database
from .services.approval_service import list_approvals, transition_approval
from .services.audit_service import list_audit_records
from .services.customer_service import get_customer_detail, list_customers
from .services.dashboard_service import get_dashboard_insights
from .services.feedback_service import record_feedback
from .services.workflow_service import get_latest_workflow, run_workflow


def bootstrap_database() -> None:
    if not settings.auto_init_db:
        return
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as session:
        apply_schema_patches(session)
        session.commit()
        seed_database(session)
        session.execute(text("UPDATE approvals SET status = lower(status)"))
        session.execute(text("UPDATE approvals SET status = 'approved' WHERE status = 'ready'"))
        session.execute(text("UPDATE actions SET status = lower(status)"))
        session.execute(text("UPDATE workflow_runs SET status = lower(status)"))
        session.commit()


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        bootstrap_database()
    except Exception as exc:  # pragma: no cover - best effort during startup
        print(f"StratIQ startup warning: database bootstrap failed: {exc}")
    yield


app = FastAPI(
    title=settings.app_name,
    description="Intent-aware decision API for StratIQ executive churn workflows.",
    version="0.2.0",
    lifespan=lifespan,
)

app.include_router(auth_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_context_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid4())
    request.state.request_id = request_id
    start = perf_counter()
    response = await call_next(request)
    duration_ms = int((perf_counter() - start) * 1000)
    response.headers["X-Request-ID"] = request_id
    logger.info(
        "request_completed",
        extra={
            "request_id": request_id,
            "path": request.url.path,
            "method": request.method,
            "status_code": response.status_code,
            "duration_ms": duration_ms,
        },
    )
    return response


def get_request_id(request: Request) -> str:
    return request.state.request_id


@app.get("/health", response_model=HealthResponse)
def health(request_id: str = Depends(get_request_id)) -> HealthResponse:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return HealthResponse(status="ok", database="connected", requestId=request_id)
    except Exception:
        return HealthResponse(status="degraded", database="unavailable", requestId=request_id)


@app.get("/api/insights", response_model=DashboardInsights)
def insights(
    db: Session = Depends(get_db),
    _: Actor = Depends(require_roles("executive", "approver", "analyst", "admin", "viewer")),
) -> DashboardInsights:
    return get_dashboard_insights(db)


@app.get("/api/customers", response_model=list[CustomerRiskSummary])
def customers(
    db: Session = Depends(get_db),
    _: Actor = Depends(require_roles("executive", "approver", "analyst", "admin", "viewer")),
) -> list[CustomerRiskSummary]:
    return list_customers(db)


@app.get("/api/customers/{customer_id}", response_model=CustomerDetail)
def customer_detail(
    customer_id: str,
    db: Session = Depends(get_db),
    _: Actor = Depends(require_roles("executive", "approver", "analyst", "admin", "viewer")),
) -> CustomerDetail:
    detail = get_customer_detail(db, customer_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    return detail


@app.post("/api/ask", response_model=WorkflowResponse)
def ask(
    payload: WorkflowRequest,
    db: Session = Depends(get_db),
    actor: Actor = Depends(require_roles("executive", "analyst", "admin")),
    request_id: str = Depends(get_request_id),
) -> WorkflowResponse:
    return run_workflow(db, payload, actor, request_id)


@app.get("/api/workflows/latest", response_model=WorkflowResponse)
def latest_workflow(
    customer_id: str | None = None,
    db: Session = Depends(get_db),
    _: Actor = Depends(require_roles("executive", "approver", "analyst", "admin", "viewer")),
) -> WorkflowResponse:
    workflow = get_latest_workflow(db, customer_id)
    if workflow is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflow


@app.post("/api/action", response_model=ActionResult)
def action(
    payload: ApprovalActionPayload,
    db: Session = Depends(get_db),
    actor: Actor = Depends(require_roles("approver", "executive", "admin")),
    request_id: str = Depends(get_request_id),
) -> ActionResult:
    return transition_approval(db, payload, actor, request_id)


@app.post("/api/approvals/{approval_id}/approve", response_model=ActionResult)
def approve(
    approval_id: str,
    db: Session = Depends(get_db),
    actor: Actor = Depends(require_roles("approver", "executive", "admin")),
    request_id: str = Depends(get_request_id),
) -> ActionResult:
    return transition_approval(db, ApprovalActionPayload(approvalId=approval_id, decision="approve"), actor, request_id)


@app.post("/api/approvals/{approval_id}/reject", response_model=ActionResult)
def reject(
    approval_id: str,
    payload: ApprovalActionPayload,
    db: Session = Depends(get_db),
    actor: Actor = Depends(require_roles("approver", "executive", "admin")),
    request_id: str = Depends(get_request_id),
) -> ActionResult:
    return transition_approval(
        db,
        ApprovalActionPayload(approvalId=approval_id, decision="reject", reason=payload.reason),
        actor,
        request_id,
    )


@app.post("/api/feedback", response_model=RecordFeedbackResponse)
def feedback(
    payload: FeedbackPayload,
    db: Session = Depends(get_db),
    actor: Actor = Depends(require_roles("executive", "analyst", "approver", "admin", "viewer")),
    request_id: str = Depends(get_request_id),
) -> RecordFeedbackResponse:
    return record_feedback(db, payload, actor, request_id)


@app.get("/api/approvals", response_model=list[ApprovalRequest])
def approvals(
    db: Session = Depends(get_db),
    _: Actor = Depends(require_roles("executive", "approver", "analyst", "admin", "viewer")),
) -> list[ApprovalRequest]:
    return list_approvals(db)


@app.get("/api/audit", response_model=list[AuditRecord])
def audit(
    db: Session = Depends(get_db),
    _: Actor = Depends(require_roles("executive", "approver", "analyst", "admin")),
) -> list[AuditRecord]:
    return list_audit_records(db)
