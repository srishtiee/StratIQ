from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    supabase_url: str
    supabase_service_role_key: str
    supabase_anon_key: str

    anthropic_api_key: str
    openai_api_key: str

    resend_api_key: str = ""

    # Demo / testing — when set, every outbound email's recipient list is
    # overridden with this address (the original recipients are noted in the
    # body so we know what would have happened in production). Resend's free
    # sandbox can ONLY deliver to the email registered with the account, so
    # this is also how we ship demo emails without a verified domain.
    email_test_recipient: str = ""

    mock_ai: bool = False

    environment: str = "development"
    log_level: str = "INFO"

    # Model config
    intent_model: str = "claude-haiku-4-5-20251001"
    analyst_model: str = "claude-sonnet-4-6"
    critic_model: str = "claude-haiku-4-5-20251001"
    refiner_model: str = "claude-sonnet-4-6"
    embedding_model: str = "text-embedding-3-small"
    embedding_dimensions: int = 1536

    # RAG
    rag_top_k: int = 12
    chunk_size: int = 512
    chunk_overlap: int = 64


settings = Settings()
