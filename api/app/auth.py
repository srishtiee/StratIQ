from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, status

from .config import settings

VALID_ROLES = {"executive", "approver", "analyst", "admin", "viewer"}


@dataclass(frozen=True)
class Actor:
    actor_id: str
    actor_name: str
    actor_role: str


def get_current_actor(
    x_stratiq_user_id: str | None = Header(default=None),
    x_stratiq_user_name: str | None = Header(default=None),
    x_stratiq_role: str | None = Header(default=None),
) -> Actor:
    if settings.auth_mode == "demo" and not (x_stratiq_user_id and x_stratiq_user_name and x_stratiq_role):
        return Actor(actor_id="demo-exec", actor_name="Demo Executive", actor_role="executive")

    if not (x_stratiq_user_id and x_stratiq_user_name and x_stratiq_role):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing StratIQ auth headers")

    role = x_stratiq_role.lower().strip()
    if role not in VALID_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Invalid role '{x_stratiq_role}'")

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
