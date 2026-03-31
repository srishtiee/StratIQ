from __future__ import annotations

import json
from typing import Any

import requests

try:
    from anthropic import Anthropic
except ImportError:
    Anthropic = None

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None

from .config import settings


class LLMRequestError(RuntimeError):
    pass


def llm_is_enabled() -> bool:
    if not settings.llm_enabled:
        return False

    return bool(
        settings.openai_api_key
        or settings.anthropic_api_key
        or getattr(settings, "groq_api_key", None)
    )


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
                    {"role": "system", "content": "Return only valid JSON."},
                    {"role": "user", "content": prompt},
                ],
            )
            text = response.choices[0].message.content or "{}"
            return _parse_json_payload(text)
        except Exception as exc:
            errors.append(f"{model}: {exc}")

    raise LLMRequestError("OpenAI request failed. " + " | ".join(errors))


def _call_anthropic(prompt: str, max_tokens: int) -> dict[str, Any]:
    if not settings.anthropic_api_key:
        raise LLMRequestError("Anthropic API key is not configured.")
    if Anthropic is None:
        raise LLMRequestError("Anthropic client library is not installed.")

    client = Anthropic(api_key=settings.anthropic_api_key)

    try:
        response = client.messages.create(
            model=settings.anthropic_model,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
        text = "".join(
            block.text for block in response.content if getattr(block, "type", "") == "text"
        )
        return _parse_json_payload(text)
    except Exception as exc:
        raise LLMRequestError(f"Anthropic request failed: {exc}") from exc


def _call_groq(prompt: str, max_tokens: int) -> dict[str, Any]:
    if not getattr(settings, "groq_api_key", None):
        raise LLMRequestError("Groq API key is not configured.")

    url = "https://api.groq.com/openai/v1/chat/completions"

    headers = {
        "Authorization": f"Bearer {settings.groq_api_key}",
        "Content-Type": "application/json",
    }

    data = {
        "model": getattr(settings, "groq_model", "llama-3.3-70b-versatile"),
        "messages": [
            {"role": "system", "content": "Return only valid JSON."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.3,
        "max_tokens": max_tokens,
    }

    try:
        response = requests.post(url, headers=headers, json=data)
        response.raise_for_status()
        text = response.json()["choices"][0]["message"]["content"]
        return _parse_json_payload(text)
    except Exception as exc:
        raise LLMRequestError(f"Groq request failed: {exc}") from exc


def generate_json(prompt: str, max_tokens: int | None = None) -> dict[str, Any]:
    if not llm_is_enabled():
        raise LLMRequestError("LLM is disabled.")

    token_budget = max_tokens or settings.llm_max_tokens
    provider = settings.llm_provider.lower().strip()

    # PRIORITY FLOW

    # 1. If explicitly OpenAI → fallback to Groq
    if provider == "openai":
        try:
            return _call_openai(prompt, token_budget)
        except LLMRequestError as e:
            print(f"OpenAI failed → fallback to Groq: {e}")
            try:
                return _call_groq(prompt, token_budget)
            except LLMRequestError as e2:
                print(f"Groq failed: {e2}")
                raise

    # 2. If explicitly Groq
    if provider == "groq":
        return _call_groq(prompt, token_budget)

    # 3. If explicitly Anthropic
    if provider == "anthropic":
        try:
            return _call_anthropic(prompt, token_budget)
        except LLMRequestError as e:
            print(f"Anthropic failed → fallback to Groq: {e}")
            return _call_groq(prompt, token_budget)

    # 4. AUTO FALLBACK CHAIN
    for fn in (_call_openai, _call_groq, _call_anthropic):
        try:
            return fn(prompt, token_budget)
        except LLMRequestError:
            continue

    raise LLMRequestError("All providers failed.")
