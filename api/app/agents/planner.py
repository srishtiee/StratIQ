"""
StratIQ — Planner Agent
Generates candidate intervention strategies using the shared LLM service.
"""
import json

from ..llm import generate_json


class PlannerAgent:
    async def run(self, question: str, analyst_out: dict, researcher_out: dict, critique_out: dict = None) -> dict:
        prompt = f"""You are a strategic business advisor for a CXO.

USER QUESTION: {question}

STRUCTURED EVIDENCE (KPIs & Metrics):
{json.dumps(analyst_out.get('kpis', []), indent=2)}

At-risk customers: {analyst_out.get('at_risk_count', 0)}
Average at-risk MRR: ${analyst_out.get('avg_at_risk_mrr', 0):.0f}

UNSTRUCTURED EVIDENCE (Customer Feedback & Tickets):
{chr(10).join(f"- {e['snippet']}" for e in researcher_out.get('evidence', [])[:3])}

DYNAMIC DB INSIGHTS (Custom Data specifically related to question):
{analyst_out.get('dynamic_insights', 'None')}

Generate 2-3 concrete intervention strategies to address the question.
"""
        if critique_out:
            prompt += f"\nPREVIOUS CRITIQUE TO ADDRESS:\n{json.dumps(critique_out, indent=2)}\nRevise your previous strategies to explicitly address these weaknesses and missing assumptions.\n"
            
        prompt += """
For each strategy, provide:
- name: strategy name
- description: what to do (2-3 sentences)  
- expected_impact: quantified expected outcome

Respond ONLY with valid JSON:
{{
  "strategies": [
    {{"name": "...", "description": "...", "expected_impact": "..."}}
  ],
  "strategy_summary": "One paragraph explaining the leading recommended approach."
}}"""
        return await generate_json(prompt, max_tokens=800)
