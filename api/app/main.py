from contextlib import asynccontextmanager
from datetime import timedelta
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from .config import settings
from .database import Base, SessionLocal, engine, get_db
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
    PaginatedResponse,
    RecordFeedbackResponse,
    Token,
    UserOut,
    WorkflowRequest,
    WorkflowResponse,
    WorkflowRunSummary,
)
from .auth import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    create_access_token,
    get_current_user,
    require_role,
    verify_password,
)
from .models import User
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
    description="Bounded reasoning API for StratIQ executive churn workflows.",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
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


@app.post("/api/auth/login", response_model=Token)
async def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()], db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role, "name": user.name, "email": user.email},
        expires_delta=access_token_expires,
    )
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/api/auth/me", response_model=UserOut)
async def read_users_me(current_user: Annotated[User, Depends(get_current_user)]):
    return current_user


@app.get("/api/insights", response_model=DashboardInsights)
def insights(
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
) -> DashboardInsights:
    return get_dashboard_insights(db)


@app.get("/api/customers", response_model=list[CustomerRiskSummary])
def customers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> list[CustomerRiskSummary]:
    return list_customers(db)


@app.get("/api/customers/{customer_id}", response_model=CustomerDetail)
def customer_detail(
    customer_id: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> CustomerDetail:
    detail = get_customer_detail(db, customer_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    return detail


@app.post("/api/ask", response_model=WorkflowResponse)
def ask(
    payload: WorkflowRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("approver", "admin")),
) -> WorkflowResponse:
    try:
        return run_bounded_workflow(db, payload)
    except (ValueError, SQLAlchemyError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/ask/stream")
def ask_stream(
    payload: WorkflowRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("approver", "admin")),
):
    from .services import stream_bounded_workflow
    return StreamingResponse(
        stream_bounded_workflow(db, payload),
        media_type="text/event-stream",
    )

@app.get("/api/workflows", response_model=list[WorkflowRunSummary])
def workflows(
    customer_id: str | None = None, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> list[WorkflowRunSummary]:
    from .services import list_workflows
    return list_workflows(db, customer_id)


@app.get("/api/workflows/latest", response_model=WorkflowResponse)
def latest_workflow(
    customer_id: str | None = None, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> WorkflowResponse:
    workflow = get_latest_workflow(db, customer_id)
    if workflow is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflow


@app.post("/api/action", response_model=ActionResult)
def action(
    payload: ApprovalActionPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
) -> ActionResult:
    try:
        return apply_action(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/feedback", response_model=RecordFeedbackResponse)
def feedback(
    payload: FeedbackPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("approver", "admin")),
) -> RecordFeedbackResponse:
    try:
        return record_feedback(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/approvals", response_model=PaginatedResponse[ApprovalRequest])
def approvals(
    page: int = 1,
    page_size: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("approver", "admin")),
) -> PaginatedResponse[ApprovalRequest]:
    return list_approvals(db, page, page_size)


@app.get("/api/audit", response_model=PaginatedResponse[AuditRecord])
def audit(
    page: int = 1,
    page_size: int = 25,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("approver", "admin")),
) -> PaginatedResponse[AuditRecord]:
    return list_audit_records(db, page, page_size)
