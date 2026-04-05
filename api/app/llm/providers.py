from __future__ import annotations

import json
from typing import Any

import requests

from ..config import settings
from ..logging_config import logger
from .base import LLMResult

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover
    OpenAI = None


def _extract_json_payload(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if "```json" in cleaned:
        cleaned = cleaned.split("```json", 1)[1].split("```", 1)[0].strip()
    elif "```" in cleaned:
        cleaned = cleaned.split("```", 1)[1].split("```", 1)[0].strip()
    return json.loads(cleaned)


def deterministic_provider() -> LLMResult:
    return LLMResult(payload=None, provider_used="deterministic")


def openai_provider(prompt: str, max_tokens: int) -> LLMResult:
    if not settings.openai_api_key or OpenAI is None:
        return LLMResult(
            payload=None,
            provider_used="deterministic",
            used_fallback=True,
            fallback_reason="openai_unavailable",
        )
    try:
        client = OpenAI(api_key=settings.openai_api_key, timeout=settings.llm_timeout_seconds)
        response = client.chat.completions.create(
            model=settings.openai_model,
            temperature=0.2,
            max_tokens=max_tokens,
            messages=[
                {"role": "system", "content": "Return only valid JSON."},
                {"role": "user", "content": prompt},
            ],
        )
        return LLMResult(payload=_extract_json_payload(response.choices[0].message.content or "{}"), provider_used="openai")
    except Exception as exc:
        logger.warning("openai_failed", extra={"fallback_reason": str(exc)[:180]})
        return LLMResult(
            payload=None,
            provider_used="deterministic",
            used_fallback=True,
            fallback_reason=f"openai_failed:{type(exc).__name__}",
        )


def grok_provider(prompt: str, max_tokens: int) -> LLMResult:
    if not settings.grok_api_key:
        return LLMResult(
            payload=None,
            provider_used="deterministic",
            used_fallback=True,
            fallback_reason="grok_key_missing",
        )
    try:
        response = requests.post(
            "https://api.x.ai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.grok_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.grok_model,
                "messages": [
                    {"role": "system", "content": "Return only valid JSON."},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.2,
                "max_tokens": max_tokens,
            },
            timeout=settings.llm_timeout_seconds,
        )
        response.raise_for_status()
        text = response.json()["choices"][0]["message"]["content"]
        return LLMResult(payload=_extract_json_payload(text), provider_used="grok")
    except Exception as exc:
        logger.warning("grok_failed", extra={"fallback_reason": str(exc)[:180]})
        return LLMResult(
            payload=None,
            provider_used="deterministic",
            used_fallback=True,
            fallback_reason=f"grok_failed:{type(exc).__name__}",
        )


def generate_llm_json(prompt: str, max_tokens: int) -> LLMResult:
    mode = settings.llm_mode
    if mode == "openai":
        result = openai_provider(prompt, max_tokens)
        return result if result.payload is not None else deterministic_provider()
    if mode == "grok":
        result = grok_provider(prompt, max_tokens)
        return result if result.payload is not None else deterministic_provider()
    return deterministic_provider()
