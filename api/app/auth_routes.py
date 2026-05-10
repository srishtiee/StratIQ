from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .auth import Actor, get_current_actor
from .auth_password import hash_password, verify_password
from .auth_tokens import create_access_token
from .config import settings
from .database import get_db
from .models import AuditRecord, User
from .schemas import (
    AuthLoginRequest,
    AuthRegisterRequest,
    AuthTokenResponse,
    AuthUserPublic,
    GoogleSignInRequest,
    UserRoleUpdateRequest,
    UserRoleUpdateResponse,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

MIN_PASSWORD_LEN = 8


def _user_public(user: User) -> AuthUserPublic:
    return AuthUserPublic(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role.lower().strip(),
    )


def _validate_email(email: str) -> str:
    normalized = email.strip().lower()
    local, _, domain = normalized.partition("@")
    if len(normalized) < 3 or not local or not domain or "@" not in normalized:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid email address")
    return normalized


def _require_admin(actor: Actor) -> None:
    if actor.actor_role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")


@router.post("/register", response_model=AuthTokenResponse)
def register(payload: AuthRegisterRequest, db: Session = Depends(get_db)) -> AuthTokenResponse:
    email = _validate_email(payload.email)
    if len(payload.password) < MIN_PASSWORD_LEN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Password must be at least {MIN_PASSWORD_LEN} characters",
        )
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists")
    name = payload.name.strip() or email.split("@")[0]
    user = User(
        id=f"user-{uuid4().hex[:12]}",
        email=email,
        name=name,
        role="viewer",
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(user.id)
    return AuthTokenResponse(accessToken=token, user=_user_public(user))


@router.post("/login", response_model=AuthTokenResponse)
def login(payload: AuthLoginRequest, db: Session = Depends(get_db)) -> AuthTokenResponse:
    email = _validate_email(payload.email)
    user = db.scalar(select(User).where(User.email == email))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    token = create_access_token(user.id)
    return AuthTokenResponse(accessToken=token, user=_user_public(user))


@router.post("/google", response_model=AuthTokenResponse)
def google_signin(payload: GoogleSignInRequest, db: Session = Depends(get_db)) -> AuthTokenResponse:
    if not settings.google_client_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google sign-in is not configured on this server",
        )
    try:
        info = google_id_token.verify_oauth2_token(
            payload.credential,
            google_requests.Request(),
            settings.google_client_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google credential") from exc

    email = (info.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google did not return an email address")
    name = (info.get("name") or email.split("@")[0]).strip()
    user = db.scalar(select(User).where(User.email == email))
    if not user:
        user = User(
            id=f"user-{uuid4().hex[:12]}",
            email=email,
            name=name,
            role="viewer",
            password_hash=None,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    token = create_access_token(user.id)
    return AuthTokenResponse(accessToken=token, user=_user_public(user))


@router.get("/me", response_model=AuthUserPublic)
def me(actor: Actor = Depends(get_current_actor), db: Session = Depends(get_db)) -> AuthUserPublic:
    user = db.get(User, actor.actor_id)
    if user:
        return _user_public(user)
    return AuthUserPublic(
        id=actor.actor_id,
        email="",
        name=actor.actor_name,
        role=actor.actor_role,
    )


@router.get("/users", response_model=list[AuthUserPublic])
def list_users(actor: Actor = Depends(get_current_actor), db: Session = Depends(get_db)) -> list[AuthUserPublic]:
    _require_admin(actor)
    users = db.scalars(select(User).order_by(User.email.asc())).all()
    return [_user_public(user) for user in users]


@router.patch("/users/{user_id}/role", response_model=UserRoleUpdateResponse)
def update_user_role(
    user_id: str,
    payload: UserRoleUpdateRequest,
    actor: Actor = Depends(get_current_actor),
    db: Session = Depends(get_db),
) -> UserRoleUpdateResponse:
    _require_admin(actor)
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    previous_role = user.role.lower().strip()
    next_role = payload.role.lower().strip()
    if previous_role == "admin" and next_role != "admin":
        admin_count = db.scalar(select(func.count()).select_from(User).where(func.lower(User.role) == "admin"))
        if admin_count is None:
            admin_count = 0
        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="At least one admin must remain. Create or promote another admin first.",
            )

    user.role = next_role
    db.add(user)
    db.add(
        AuditRecord(
            id=f"audit-role-{uuid4().hex[:10]}",
            request_id=None,
            actor_id=actor.actor_id,
            actor_name=actor.actor_name,
            actor_role=actor.actor_role,
            run_id=None,
            approval_id=None,
            event_type="approval",
            entity_type="user",
            entity_id=user.id,
            before_state={"role": previous_role},
            after_state={"role": next_role},
            actor=actor.actor_name,
            message=f"Role changed for {user.email} from {previous_role} to {next_role}.",
            created_at=datetime.now(timezone.utc),
        )
    )
    db.commit()
    db.refresh(user)
    return UserRoleUpdateResponse(user=_user_public(user))
