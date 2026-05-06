"""StratIQ — Risk/Compliance Agent (Critique)"""
import json

from ..llm import generate_json


class RiskComplianceAgent:
    async def run(self, planner_out: dict, analyst_out: dict) -> dict:
        strategies_text = json.dumps(planner_out.get("strategies", []), indent=2)
        prompt = f"""You are a risk and compliance reviewer for an enterprise AI system.

Review these proposed strategies critically:
{strategies_text}

Identify weaknesses, risks, or compliance concerns. Be specific and evidence-based.

Respond ONLY with valid JSON:
{{
  "weaknesses": ["..."],
  "missing_assumptions": ["..."],
  "policy_concerns": ["..."],
  "critique_summary": "One paragraph summarizing the main risks with the leading strategy."
}}"""
        return await generate_json(prompt, max_tokens=500)
