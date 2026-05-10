from dataclasses import dataclass
from typing import Any, Protocol


@dataclass
class LLMResult:
    payload: dict[str, Any] | None
    provider_used: str
    used_fallback: bool = False
    fallback_reason: str | None = None


class LLMProvider(Protocol):
    def generate_json(self, prompt: str, max_tokens: int) -> LLMResult: ...
