from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, ValidationError

from .llm import LLMRequestError, generate_json, llm_is_enabled


IntentType = Literal[
    "churn_root_cause",
    "retention_action",
    "evidence_review",
    "approval_priority",
    "commercial_risk",
    "support_risk",
    "usage_decline",
    "adoption_risk",
    "renewal_risk",
    "general_churn",
]


INTENT_LABELS: dict[str, str] = {
    "churn_root_cause": "Root cause",
    "retention_action": "Retention action",
    "evidence_review": "Evidence review",
    "approval_priority": "Approval priority",
    "commercial_risk": "Commercial risk",
    "support_risk": "Support risk",
    "usage_decline": "Usage decline",
    "adoption_risk": "Adoption risk",
    "renewal_risk": "Renewal risk",
    "general_churn": "Churn review",
}


class IntentResult(BaseModel):
    intent: IntentType
    confidence: str = "medium"
    rationale: str = ""


KEYWORD_RULES: list[tuple[IntentType, tuple[str, ...]]] = [
    ("evidence_review", ("evidence", "supporting", "prove", "proof", "why should we believe", "citations")),
    ("approval_priority", ("approve first", "approval", "priority", "what should we approve", "approve next")),
    ("commercial_risk", ("pricing", "discount", "commercial", "price", "avoid discount", "concession")),
    ("support_risk", ("support", "ticket", "escalation", "p1", "p2", "reliability", "sla")),
    ("usage_decline", ("usage", "decline", "drop", "falling", "active users", "login")),
    ("adoption_risk", ("adoption", "onboarding", "enablement", "feature", "training", "workflow depth")),
    ("renewal_risk", ("renewal", "renew", "contract", "procurement", "decision window")),
    ("retention_action", ("what should", "action", "next step", "recommend", "retain", "save")),
    ("churn_root_cause", ("why", "root cause", "at risk", "risk driver", "churn increase")),
]


def classify_intent_fallback(prompt: str) -> IntentResult:
    normalized = prompt.lower()
    for intent, keywords in KEYWORD_RULES:
        if any(_keyword_matches(normalized, keyword) for keyword in keywords):
            return IntentResult(
                intent=intent,
                confidence="medium",
                rationale=f"Matched intent keywords for {INTENT_LABELS[intent].lower()}.",
            )
    return IntentResult(intent="general_churn", confidence="low", rationale="No specific intent keyword matched.")


def _keyword_matches(prompt: str, keyword: str) -> bool:
    if " " in keyword:
        return keyword in prompt
    return re.search(rf"\b{re.escape(keyword)}\b", prompt) is not None


def classify_intent(prompt: str) -> IntentResult:
    fallback = classify_intent_fallback(prompt)
    if not llm_is_enabled():
        return fallback

    try:
        payload = generate_json(
            f"""
Classify the executive request for StratIQ.

Return only valid JSON:
{{
  "intent": "one of: churn_root_cause, retention_action, evidence_review, approval_priority, commercial_risk, support_risk, usage_decline, adoption_risk, renewal_risk, general_churn",
  "confidence": "low|medium|high",
  "rationale": "short reason"
}}

Request: {prompt}
""".strip(),
            max_tokens=220,
        )
        return IntentResult.model_validate(payload)
    except (LLMRequestError, ValidationError, ValueError):
        return fallback


def intent_label(intent: str) -> str:
    return INTENT_LABELS.get(intent, "Churn review")
