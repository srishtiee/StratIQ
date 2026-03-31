from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from .config import settings
from .database import Base, SessionLocal, engine, get_db
from .schemas import (
    ApprovalActionPayload,
    ActionResult,
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
from .seed_data import seed_database
from .services import (
    apply_action,
    get_customer_detail,
    get_dashboard_insights,
    get_latest_workflow,
    list_approvals,
    list_audit_records,
    list_customers,
    record_feedback,
    run_bounded_workflow,
)


def bootstrap_database() -> None:
    if not settings.auto_init_db:
        return
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as session:
        seed_database(session)


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

@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return HealthResponse(status="ok", database="connected")
    except Exception:
        return HealthResponse(status="degraded", database="unavailable")


@app.get("/api/insights", response_model=DashboardInsights)
def insights(db: Session = Depends(get_db)) -> DashboardInsights:
    return get_dashboard_insights(db)


@app.get("/api/customers", response_model=list[CustomerRiskSummary])
def customers(db: Session = Depends(get_db)) -> list[CustomerRiskSummary]:
    return list_customers(db)


@app.get("/api/customers/{customer_id}", response_model=CustomerDetail)
def customer_detail(customer_id: str, db: Session = Depends(get_db)) -> CustomerDetail:
    detail = get_customer_detail(db, customer_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    return detail


@app.post("/api/ask", response_model=WorkflowResponse)
def ask(payload: WorkflowRequest, db: Session = Depends(get_db)) -> WorkflowResponse:
    try:
        return run_bounded_workflow(db, payload)
    except (ValueError, SQLAlchemyError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/workflows/latest", response_model=WorkflowResponse)
def latest_workflow(customer_id: str | None = None, db: Session = Depends(get_db)) -> WorkflowResponse:
    workflow = get_latest_workflow(db, customer_id)
    if workflow is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflow


@app.post("/api/action", response_model=ActionResult)
def action(payload: ApprovalActionPayload, db: Session = Depends(get_db)) -> ActionResult:
    try:
        return apply_action(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/feedback", response_model=RecordFeedbackResponse)
def feedback(payload: FeedbackPayload, db: Session = Depends(get_db)) -> RecordFeedbackResponse:
    try:
        return record_feedback(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/approvals", response_model=list[ApprovalRequest])
def approvals(db: Session = Depends(get_db)) -> list[ApprovalRequest]:
    return list_approvals(db)


@app.get("/api/audit", response_model=list[AuditRecord])
def audit(db: Session = Depends(get_db)) -> list[AuditRecord]:
    return list_audit_records(db)
