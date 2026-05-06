"""StratIQ — Arbiter Agent (Final Ruling)"""
import json

from ..llm import generate_json


class ArbiterAgent:
    async def run(self, planner_out: dict, critique_out: dict) -> dict:
        prompt = f"""You are the final decision arbiter for an executive AI system.

PROPOSED STRATEGIES:
{json.dumps(planner_out.get('strategies', []), indent=2)}

RISK CRITIQUE:
{json.dumps(critique_out, indent=2)}

Select and refine the most defensible strategy, accounting for the critiques.

Respond ONLY with valid JSON:
{{
  "recommended_strategy": {{
    "name": "...",
    "description": "...",
    "expected_impact": "..."
  }},
  "rationale": "Why this strategy is preferred over alternatives.",
  "mitigations": ["How to address each identified risk"],
  "main_risks": ["residual risks that remain"],
  "assumptions": ["key assumptions this recommendation depends on"],
  "kpis_to_monitor": ["metric1", "metric2"],
  "action_suggestion": "Specific next action the CXO should take.",
  "ruling_summary": "One paragraph final ruling."
}}"""
        return await generate_json(prompt, max_tokens=800)
