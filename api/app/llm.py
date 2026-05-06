"""
StratIQ — Shared LLM helper with provider fallback.

Anthropic remains supported, but local development now falls back to OpenAI
automatically when the configured Claude model is unavailable.
"""
from __future__ import annotations

import json

from anthropic import AsyncAnthropic
from openai import AsyncOpenAI

from .config import settings


class LLMRequestError(RuntimeError):
    """Raised when every configured LLM provider/model candidate fails."""


def _dedupe(values: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for value in values:
        if value and value not in seen:
            seen.add(value)
            ordered.append(value)
    return ordered


def _extract_json_payload(text: str) -> str:
    cleaned = text.strip()
    if "```json" in cleaned:
        cleaned = cleaned.split("```json", 1)[1].split("```", 1)[0].strip()
    elif "```" in cleaned:
        cleaned = cleaned.split("```", 1)[1].split("```", 1)[0].strip()
    return cleaned


def _parse_json_payload(text: str) -> dict:
    try:
        return json.loads(_extract_json_payload(text))
    except json.JSONDecodeError as exc:
        raise LLMRequestError(f"LLM returned invalid JSON: {exc}") from exc


async def _call_anthropic(prompt: str, max_tokens: int) -> dict:
    if not settings.anthropic_api_key:
        raise LLMRequestError("Anthropic API key is not configured.")

    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    models = _dedupe([
        settings.anthropic_model,
        settings.claude_model,
    ])
    errors: list[str] = []

    for model in models:
        try:
            response = await client.messages.create(
                model=model,
                max_tokens=max_tokens,
                messages=[{"role": "user", "content": prompt}],
            )
            text = "".join(
                block.text for block in response.content if getattr(block, "type", "") == "text"
            )
            return _parse_json_payload(text)
        except Exception as exc:
            errors.append(f"{model}: {exc}")

    raise LLMRequestError("Anthropic request failed. " + " | ".join(errors))


async def _call_openai(prompt: str, max_tokens: int) -> dict:
    if not settings.openai_api_key:
        raise LLMRequestError("OpenAI API key is not configured.")

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    models = _dedupe([
        settings.openai_model,
        "gpt-4o-mini",
        "gpt-4.1-mini",
    ])
    errors: list[str] = []

    for model in models:
        try:
            response = await client.chat.completions.create(
                model=model,
                temperature=0.2,
                max_tokens=max_tokens,
                messages=[
                    {
                        "role": "system",
                        "content": "Return only valid JSON with no markdown fences.",
                    },
                    {"role": "user", "content": prompt},
                ],
            )
            text = response.choices[0].message.content or "{}"
            return _parse_json_payload(text)
        except Exception as exc:
            errors.append(f"{model}: {exc}")

    raise LLMRequestError("OpenAI request failed. " + " | ".join(errors))


def llm_is_enabled() -> bool:
    return settings.llm_enabled and (
        bool(settings.openai_api_key) or bool(settings.anthropic_api_key)
    )


async def generate_json(prompt: str, max_tokens: int = 800) -> dict:
    provider = settings.llm_provider.lower().strip()
    attempts: list[str] = []

    if provider == "anthropic":
        return await _call_anthropic(prompt, max_tokens)
    if provider == "openai":
        return await _call_openai(prompt, max_tokens)

    for name, fn in (("anthropic", _call_anthropic), ("openai", _call_openai)):
        try:
            return await fn(prompt, max_tokens)
        except LLMRequestError as exc:
            attempts.append(f"{name}: {exc}")

    raise LLMRequestError("No LLM provider succeeded. " + " | ".join(attempts))
