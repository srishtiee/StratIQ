from .config import settings
from .llm.providers import generate_llm_json


class LLMRequestError(RuntimeError):
    pass


def llm_is_enabled() -> bool:
    return settings.llm_mode in {"openai", "grok"}


def generate_json(prompt: str, max_tokens: int | None = None) -> dict:
    result = generate_llm_json(prompt, max_tokens or settings.llm_max_tokens)
    if result.payload is None:
        raise LLMRequestError(result.fallback_reason or "deterministic mode")
    return result.payload
