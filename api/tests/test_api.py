from fastapi.testclient import TestClient
from sqlalchemy import select

from api.app.database import Base, SessionLocal, engine
from api.app.main import app
from api.app.models import Approval, AuditRecord, RunDecision, RunEvidence, WorkflowRun
from api.app.seed_data import DEMO_LOGIN_PASSWORD, seed_database


def _headers(role: str = "executive") -> dict[str, str]:
    return {
        "X-StratIQ-User-ID": f"user-{role}",
        "X-StratIQ-User-Name": f"{role.title()} User",
        "X-StratIQ-Role": role,
    }


def setup_module():
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as session:
        seed_database(session)


def test_auth_login_seeded_user():
    client = TestClient(app)
    response = client.post(
        "/api/auth/login",
        json={"email": "exec@stratiq.demo", "password": DEMO_LOGIN_PASSWORD},
    )
    assert response.status_code == 200
    body = response.json()
    assert body.get("accessToken")
    assert body["user"]["role"] == "executive"


def test_admin_can_update_user_role():
    client = TestClient(app)
    admin_login = client.post(
        "/api/auth/login",
        json={"email": "admin@stratiq.demo", "password": DEMO_LOGIN_PASSWORD},
    )
    assert admin_login.status_code == 200
    token = admin_login.json()["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}

    users = client.get("/api/auth/users", headers=headers)
    assert users.status_code == 200
    viewer = next((user for user in users.json() if user["email"] == "viewer@stratiq.demo"), None)
    assert viewer is not None

    patch = client.patch(
        f"/api/auth/users/{viewer['id']}/role",
        json={"role": "analyst"},
        headers=headers,
    )
    assert patch.status_code == 200
    assert patch.json()["user"]["role"] == "analyst"

    # restore demo seed role for deterministic subsequent runs
    reset = client.patch(
        f"/api/auth/users/{viewer['id']}/role",
        json={"role": "viewer"},
        headers=headers,
    )
    assert reset.status_code == 200
    assert reset.json()["user"]["role"] == "viewer"


def test_health():
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] in {"ok", "degraded"}
    assert response.json()["requestId"]


def test_ask_creates_records():
    client = TestClient(app)
    response = client.post("/api/ask", json={"prompt": "Why is Northstar Fiber at risk?"}, headers=_headers())
    assert response.status_code == 200
    run_id = response.json()["requestId"]
    with SessionLocal() as session:
        assert session.get(WorkflowRun, run_id) is not None
        assert session.scalar(select(RunEvidence).where(RunEvidence.run_id == run_id).limit(1)) is not None
        assert session.scalar(select(RunDecision).where(RunDecision.run_id == run_id).limit(1)) is not None
        assert session.scalar(select(Approval).where(Approval.run_id == run_id).limit(1)) is not None
        assert session.scalar(select(AuditRecord).where(AuditRecord.run_id == run_id).limit(1)) is not None


def test_ask_invalid_prompt():
    client = TestClient(app)
    response = client.post("/api/ask", json={"prompt": "   "}, headers=_headers())
    assert response.status_code == 400


def test_approvals_list_and_transitions():
    client = TestClient(app)
    ask = client.post("/api/ask", json={"prompt": "What should we approve first?"}, headers=_headers())
    approval_id = ask.json()["approval"]["id"]

    approvals = client.get("/api/approvals", headers=_headers("viewer"))
    assert approvals.status_code == 200
    assert any(a["id"] == approval_id for a in approvals.json())

    approve = client.post(f"/api/approvals/{approval_id}/approve", headers=_headers("approver"))
    assert approve.status_code == 200

    reapprove = client.post(f"/api/approvals/{approval_id}/approve", headers=_headers("approver"))
    assert reapprove.status_code == 409

    reject_after_approve = client.post(
        f"/api/approvals/{approval_id}/reject",
        json={"approvalId": approval_id, "decision": "reject", "reason": "late"},
        headers=_headers("approver"),
    )
    assert reject_after_approve.status_code == 409

    execute = client.post(
        "/api/action",
        json={"approvalId": approval_id, "decision": "execute"},
        headers=_headers("executive"),
    )
    assert execute.status_code == 200


def test_viewer_cannot_approve():
    client = TestClient(app)
    ask = client.post("/api/ask", json={"prompt": "Need approval package"}, headers=_headers())
    approval_id = ask.json()["approval"]["id"]
    response = client.post(f"/api/approvals/{approval_id}/approve", headers=_headers("viewer"))
    assert response.status_code == 403


def test_feedback_creates_audit():
    client = TestClient(app)
    ask = client.post("/api/ask", json={"prompt": "Need summary"}, headers=_headers())
    run_id = ask.json()["requestId"]
    response = client.post(
        "/api/feedback",
        json={"requestId": run_id, "verdict": "approve", "note": "Looks good"},
        headers=_headers("analyst"),
    )
    assert response.status_code == 200


def test_llm_fallback_stable():
    client = TestClient(app)
    response = client.post("/api/ask", json={"prompt": "Check fallback mode"}, headers=_headers())
    assert response.status_code == 200
