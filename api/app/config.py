from dataclasses import dataclass
import os
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - optional local dependency
    def load_dotenv(*_args, **_kwargs):
        return False

ROOT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(ROOT_DIR / ".env.local")


def _to_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    app_name: str = "StratIQ API"
    app_env: str = os.getenv("STRATIQ_ENV", "development")
    database_url: str = os.getenv(
        "DATABASE_URL",
        os.getenv(
            "SUPABASE_DB_URL",
            "postgresql+psycopg://stratiq:stratiq@localhost:5432/stratiq",
        ),
    )
    auto_init_db: bool = _to_bool(os.getenv("STRATIQ_AUTO_INIT_DB"), True)
    auth_mode: str = os.getenv("STRATIQ_AUTH_MODE", "demo").lower()
    llm_mode: str = os.getenv("STRATIQ_LLM_MODE", "deterministic").lower()
    llm_timeout_seconds: int = int(os.getenv("STRATIQ_LLM_TIMEOUT_SECONDS", "20"))
    llm_max_tokens: int = int(os.getenv("STRATIQ_LLM_MAX_TOKENS", "900"))
    grok_api_key: str | None = os.getenv("GROK_API_KEY")
    openai_api_key: str | None = os.getenv("OPENAI_API_KEY")
    grok_model: str = os.getenv("GROK_MODEL", "grok-2-latest")
    openai_model: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")


settings = Settings()
