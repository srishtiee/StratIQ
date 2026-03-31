from dataclasses import dataclass
import os
from pathlib import Path

from dotenv import load_dotenv

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
    llm_enabled: bool = _to_bool(os.getenv("STRATIQ_LLM_ENABLED"), False)
    llm_provider: str = os.getenv("STRATIQ_LLM_PROVIDER", "auto")
    llm_max_tokens: int = int(os.getenv("STRATIQ_LLM_MAX_TOKENS", "900"))
    groq_api_key: str | None = os.getenv("GROQ_API_KEY")
    openai_api_key: str | None = os.getenv("OPENAI_API_KEY")
    anthropic_api_key: str | None = os.getenv("ANTHROPIC_API_KEY")
    groq_model: str = os.getenv("STRATIQ_GROQ_MODEL", "llama-3.3-70b-versatile")
    openai_model: str = os.getenv("STRATIQ_OPENAI_MODEL", "gpt-4o")
    anthropic_model: str = os.getenv("STRATIQ_ANTHROPIC_MODEL", "claude-3-5-sonnet-latest")


settings = Settings()
