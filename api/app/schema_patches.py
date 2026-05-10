"""Idempotent column additions for databases created before ORM/schema updates.

SQLAlchemy create_all() only creates missing tables; it does not migrate existing
tables. These patches align legacy Postgres rows with current models.
"""

from sqlalchemy import text
from sqlalchemy.orm import Session

_PATCH_STATEMENTS = [
    # users — password auth
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT",
    # workflow_runs — timestamps + traceability (legacy DBs often omit these)
    "ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW()",
    "ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ",
    "ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS request_id TEXT",
    "ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS actor_id TEXT",
    "ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS actor_name TEXT",
    "ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS actor_role TEXT",
    "ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS metadata_json JSONB",
    "ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS request_summary TEXT DEFAULT ''",
    "ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS summary TEXT DEFAULT ''",
    "ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS workflow_type TEXT DEFAULT 'customer_churn'",
    "ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS prompt TEXT DEFAULT ''",
    "ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed'",
    "CREATE INDEX IF NOT EXISTS ix_workflow_runs_request_id ON workflow_runs (request_id)",
    # approvals — state machine + actor fields
    "ALTER TABLE approvals ADD COLUMN IF NOT EXISTS actor_id_created_by TEXT",
    "ALTER TABLE approvals ADD COLUMN IF NOT EXISTS approved_by TEXT",
    "ALTER TABLE approvals ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ",
    "ALTER TABLE approvals ADD COLUMN IF NOT EXISTS rejected_by TEXT",
    "ALTER TABLE approvals ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ",
    "ALTER TABLE approvals ADD COLUMN IF NOT EXISTS executed_by TEXT",
    "ALTER TABLE approvals ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ",
    "ALTER TABLE approvals ADD COLUMN IF NOT EXISTS rejection_reason TEXT",
    # audit_records — correlation + entity diff
    "ALTER TABLE audit_records ADD COLUMN IF NOT EXISTS request_id TEXT",
    "ALTER TABLE audit_records ADD COLUMN IF NOT EXISTS actor_id TEXT",
    "ALTER TABLE audit_records ADD COLUMN IF NOT EXISTS actor_name TEXT",
    "ALTER TABLE audit_records ADD COLUMN IF NOT EXISTS actor_role TEXT",
    "ALTER TABLE audit_records ADD COLUMN IF NOT EXISTS entity_type TEXT",
    "ALTER TABLE audit_records ADD COLUMN IF NOT EXISTS entity_id TEXT",
    "ALTER TABLE audit_records ADD COLUMN IF NOT EXISTS before_state JSONB",
    "ALTER TABLE audit_records ADD COLUMN IF NOT EXISTS after_state JSONB",
    "CREATE INDEX IF NOT EXISTS ix_audit_records_request_id ON audit_records (request_id)",
]

_DOCUMENT_CHUNKS_EMBEDDING_PATCH = """
DO $$
BEGIN
  IF to_regclass('public.document_chunks') IS NOT NULL THEN
    ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS embedding TEXT;
  END IF;
END
$$;
"""


def apply_schema_patches(session: Session) -> None:
    bind = session.get_bind()
    if bind is None or bind.dialect.name != "postgresql":
        return
    for stmt in _PATCH_STATEMENTS:
        session.execute(text(stmt))
    session.execute(text(_DOCUMENT_CHUNKS_EMBEDDING_PATCH))
