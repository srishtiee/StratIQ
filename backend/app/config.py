"""
StratIQ Backend — Application Settings
"""
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve .env from the project root (two levels up from this file: app/ → backend/ → root)
_ROOT = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(_ROOT / ".env"), extra="ignore")

    # Database
    database_url: str = "postgresql+asyncpg://stratiq:stratiq@localhost:5432/stratiq"

    # AI
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    llm_provider: str = "auto"
    anthropic_model: str = ""
    openai_model: str = "gpt-4o-mini"

    # Server
    backend_port: int = 8000
    cors_origins: str = "http://localhost:3000"

    # Supabase (optional for local dev)
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    # Agent config
    claude_model: str = "claude-3-5-sonnet-20241022"
    embedding_model: str = "text-embedding-3-small"
    rag_top_k: int = 5


settings = Settings()

# Parse cors_origins into list for use by middleware
_cors_origins_list: list[str] = [
    o.strip() for o in settings.cors_origins.split(",") if o.strip()
]
