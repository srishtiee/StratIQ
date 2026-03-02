from __future__ import annotations

import json
from typing import Any

try:
    from anthropic import Anthropic
except ImportError:  # pragma: no cover - optional dependency until installed
    Anthropic = None

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover - optional dependency until installed
    OpenAI = None

from .config import settings


class LLMRequestError(RuntimeError):
    """Raised when no configured LLM provider can return a usable JSON payload."""


def llm_is_enabled() -> bool:
    if not settings.llm_enabled:
        return False

    provider = settings.llm_provider.lower().strip()
    if provider == "openai":
        return bool(settings.openai_api_key)
    if provider == "anthropic":
        return bool(settings.anthropic_api_key)
    return bool(settings.openai_api_key or settings.anthropic_api_key)


def _dedupe(values: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for value in values:
        cleaned = value.strip()
        if cleaned and cleaned not in seen:
            seen.add(cleaned)
            ordered.append(cleaned)
    return ordered


def _extract_json_payload(text: str) -> str:
    cleaned = text.strip()
    if "```json" in cleaned:
        cleaned = cleaned.split("```json", 1)[1].split("```", 1)[0].strip()
    elif "```" in cleaned:
        cleaned = cleaned.split("```", 1)[1].split("```", 1)[0].strip()
    return cleaned


def _parse_json_payload(text: str) -> dict[str, Any]:
    try:
        return json.loads(_extract_json_payload(text))
    except json.JSONDecodeError as exc:
        raise LLMRequestError(f"LLM returned invalid JSON: {exc}") from exc


def _call_openai(prompt: str, max_tokens: int) -> dict[str, Any]:
    if not settings.openai_api_key:
        raise LLMRequestError("OpenAI API key is not configured.")
    if OpenAI is None:
        raise LLMRequestError("OpenAI client library is not installed.")

    client = OpenAI(api_key=settings.openai_api_key)
    models = _dedupe([settings.openai_model, "gpt-4o-mini"])
    errors: list[str] = []

    for model in models:
        try:
            response = client.chat.completions.create(
                model=model,
                temperature=0.2,
                max_tokens=max_tokens,
                messages=[
                    {
                        "role": "system",
                        "content": "Return only valid JSON with no markdown fences or commentary.",
                    },
                    {"role": "user", "content": prompt},
                ],
            )
            text = response.choices[0].message.content or "{}"
            return _parse_json_payload(text)
        except Exception as exc:  # pragma: no cover - network/provider behavior
            errors.append(f"{model}: {exc}")

    raise LLMRequestError("OpenAI request failed. " + " | ".join(errors))


def _call_anthropic(prompt: str, max_tokens: int) -> dict[str, Any]:
    if not settings.anthropic_api_key:
        raise LLMRequestError("Anthropic API key is not configured.")
    if Anthropic is None:
        raise LLMRequestError("Anthropic client library is not installed.")

    client = Anthropic(api_key=settings.anthropic_api_key)
    models = _dedupe([settings.anthropic_model])
    errors: list[str] = []

    for model in models:
        try:
            response = client.messages.create(
                model=model,
                max_tokens=max_tokens,
                messages=[{"role": "user", "content": prompt}],
            )
            text = "".join(
                block.text for block in response.content if getattr(block, "type", "") == "text"
            )
            return _parse_json_payload(text)
        except Exception as exc:  # pragma: no cover - network/provider behavior
            errors.append(f"{model}: {exc}")

    raise LLMRequestError("Anthropic request failed. " + " | ".join(errors))


def generate_json(prompt: str, max_tokens: int | None = None) -> dict[str, Any]:
    if not llm_is_enabled():
        raise LLMRequestError("LLM enhancement is disabled or no provider key is configured.")

    token_budget = max_tokens or settings.llm_max_tokens
    provider = settings.llm_provider.lower().strip()
    attempts: list[str] = []

    if provider == "openai":
        return _call_openai(prompt, token_budget)
    if provider == "anthropic":
        return _call_anthropic(prompt, token_budget)

    for name, fn in (("openai", _call_openai), ("anthropic", _call_anthropic)):
        try:
            return fn(prompt, token_budget)
        except LLMRequestError as exc:
            attempts.append(f"{name}: {exc}")

    raise LLMRequestError("No LLM provider succeeded. " + " | ".join(attempts))
