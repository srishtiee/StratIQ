"""
AI signal extraction for unstructured text.

survey_responses  → job_search_intent, burnout_signals, comp_frustration, etc.
csm_notes         → competitor_mention, budget_pressure, sponsor_change, etc.
"""

import json
import anthropic

from app.core.config import settings

_client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

_SURVEY_PROMPT = """You are analyzing a single employee survey response to extract risk signals.

Survey text:
<text>
{text}
</text>

Return ONLY a valid JSON object with these exact keys:
{{
  "job_search_intent": true | false,
  "manager_frustration": true | false,
  "burnout_signals": ["list of direct quotes or phrases indicating burnout, or empty array"],
  "compensation_frustration": true | false,
  "career_stagnation": true | false,
  "sentiment_label": "positive" | "neutral" | "negative",
  "sentiment_score": 0.0 to 1.0,
  "key_quotes": ["up to 3 most significant quotes from the text"]
}}

No markdown, no explanation. Just the JSON object."""

_CSM_PROMPT = """You are analyzing a CSM call note or meeting transcript to extract churn risk signals.

Note/transcript:
<text>
{text}
</text>

Return ONLY a valid JSON object with these exact keys:
{{
  "competitor_mention": "competitor name or null",
  "budget_pressure": true | false,
  "sponsor_change": {{"departed": "name or null", "incoming": "name or null"}} | null,
  "expansion_interest": true | false,
  "satisfaction_level": "positive" | "neutral" | "negative",
  "key_concerns": ["list of specific concerns mentioned, or empty array"],
  "commitments_made": ["list of commitments/next steps, or empty array"],
  "churn_risk_signals": ["direct quotes or phrases signaling churn risk, or empty array"]
}}

No markdown, no explanation. Just the JSON object."""


_MOCK_SURVEY_SIGNALS = {
    "job_search_intent": False,
    "manager_frustration": False,
    "burnout_signals": ["mock: no real survey uploaded"],
    "compensation_frustration": True,
    "career_stagnation": False,
    "sentiment_label": "neutral",
    "sentiment_score": 0.55,
    "key_quotes": ["mock response — enable real AI by setting MOCK_AI=false"],
}

_MOCK_CSM_SIGNALS = {
    "competitor_mention": None,
    "budget_pressure": False,
    "sponsor_change": None,
    "expansion_interest": False,
    "satisfaction_level": "neutral",
    "key_concerns": ["mock: no real notes uploaded"],
    "commitments_made": [],
    "churn_risk_signals": ["mock response — enable real AI by setting MOCK_AI=false"],
}


async def extract_survey_signals(text: str) -> dict:
    if not text.strip():
        return {}
    if settings.mock_ai:
        return _MOCK_SURVEY_SIGNALS
    response = await _client.messages.create(
        model=settings.analyst_model,
        max_tokens=512,
        messages=[{"role": "user", "content": _SURVEY_PROMPT.format(text=text[:4000])}],
    )
    return _parse_json(response.content[0].text)


async def extract_csm_signals(text: str) -> dict:
    if not text.strip():
        return {}
    if settings.mock_ai:
        return _MOCK_CSM_SIGNALS
    response = await _client.messages.create(
        model=settings.analyst_model,
        max_tokens=512,
        messages=[{"role": "user", "content": _CSM_PROMPT.format(text=text[:4000])}],
    )
    return _parse_json(response.content[0].text)


def _parse_json(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try extracting from a code block
        import re
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except Exception:
                pass
    return {}
