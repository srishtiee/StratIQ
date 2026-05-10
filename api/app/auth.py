from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from .auth_tokens import decode_access_token
from .config import settings
from .database import get_db
from .models import User

VALID_ROLES = {"executive", "approver", "analyst", "admin", "viewer"}


@dataclass(frozen=True)
class Actor:
    actor_id: str
    actor_name: str
    actor_role: str


def _actor_from_bearer(token: str, db: Session) -> Actor:
    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        if not user_id or not isinstance(user_id, str):
            raise ValueError("missing sub")
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    role = user.role.lower().strip()
    if role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account role is not configured for StratIQ access",
        )
    return Actor(actor_id=user.id, actor_name=user.name, actor_role=role)


def get_current_actor(
    authorization: str | None = Header(default=None),
    x_stratiq_user_id: str | None = Header(default=None),
    x_stratiq_user_name: str | None = Header(default=None),
    x_stratiq_role: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Actor:
    if authorization and authorization.lower().startswith("bearer "):
        raw = authorization.split(" ", 1)[1].strip()
        if raw:
            return _actor_from_bearer(raw, db)

    if settings.auth_mode == "jwt":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    if settings.auth_mode == "demo" and not (x_stratiq_user_id and x_stratiq_user_name and x_stratiq_role):
        return Actor(actor_id="demo-exec", actor_name="Demo Executive", actor_role="executive")

    if not (x_stratiq_user_id and x_stratiq_user_name and x_stratiq_role):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing StratIQ auth headers")

    role = x_stratiq_role.lower().strip()
    if role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Invalid role '{x_stratiq_role}'",
        )

    return Actor(actor_id=x_stratiq_user_id, actor_name=x_stratiq_user_name, actor_role=role)


def require_roles(*allowed_roles: str):
    allowed = {role.lower().strip() for role in allowed_roles}

    def _checker(actor: Actor = Depends(get_current_actor)) -> Actor:
        if actor.actor_role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{actor.actor_role}' is not permitted for this endpoint",
            )
        return actor

    return _checker
