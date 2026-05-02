"""
StratIQ — Bounded Multi-Agent Orchestrator

Workflow:
  STATE 1: Parallel Retrieval  (Analyst + Researcher run concurrently)
  STATE 2: Strategy Generation (Planner)
  STATE 3: Critique            (Risk/Compliance Agent)
  STATE 4: Ruling              (Arbiter)
  STATE 5: Formatting          (Comms Agent → DecisionCard)
"""
import asyncio
import json
from uuid import uuid4
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.schemas import AskRequest, AskResponse, ReasoningStep
from app.agents.analyst import AnalystAgent
from app.agents.researcher import ResearcherAgent
from app.agents.planner import PlannerAgent
from app.agents.risk_compliance import RiskComplianceAgent
from app.agents.arbiter import ArbiterAgent
from app.agents.comms import CommsAgent


def _json_default(value):
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


async def run_workflow_stream(request: AskRequest, db: AsyncSession) -> AsyncGenerator[str, None]:
    run_id = str(uuid4())
    action_id = str(uuid4())
    started_at = datetime.utcnow()

    # ── Persist run start ──────────────────────────────────────────────────────
    await db.execute(text("""
        INSERT INTO runs (id, workflow, question, filters, status, created_at)
        VALUES (:id, :workflow, :question, CAST(:filters AS jsonb), 'running', :now)
    """), {
        "id": run_id, "workflow": request.workflow,
        "question": request.question,
        "filters": json.dumps(request.filters, default=_json_default),
        "now": started_at,
    })
    await db.commit()
    
    def yield_event(event_name: str, data: dict):
        payload = {"event": event_name, "data": data}
        return json.dumps(payload, default=_json_default) + "\n"

    try:
        # STATE 1: Retrieval
        yield yield_event("step_start", {"step": 0, "agent": "analyst"})
        analyst_out = await AnalystAgent(db).run(request)
        yield yield_event("step_done", {"step": 0, "agent": "analyst", "summary": analyst_out.get("summary", "")})
        
        yield yield_event("step_start", {"step": 1, "agent": "researcher"})
        researcher_out = await ResearcherAgent(db).run(request)
        yield yield_event("step_done", {"step": 1, "agent": "researcher", "summary": researcher_out.get("summary", "")})

        # STATE 2: Debate Loop (Planner vs Risk)
        planner_agent = PlannerAgent()
        risk_agent = RiskComplianceAgent()
        
        yield yield_event("step_start", {"step": 2, "agent": "planner"})
        planner_out = await planner_agent.run(request.question, analyst_out, researcher_out)
        yield yield_event("step_done", {"step": 2, "agent": "planner", "summary": planner_out.get("strategy_summary", "")})

        critique_out = {}
        for iteration in range(2):
            yield yield_event("step_start", {"step": 3, "agent": "risk", "iteration": iteration})
            critique_out = await risk_agent.run(planner_out, analyst_out)
            yield yield_event("step_done", {"step": 3, "agent": "risk", "summary": critique_out.get("critique_summary", "")})
            
            weaknesses = critique_out.get("weaknesses", [])
            assumptions = critique_out.get("missing_assumptions", [])
            if not weaknesses and not assumptions:
                break # Critique passed
                
            if iteration < 1: # Only run planner again if it's not the last iteration
                yield yield_event("step_start", {"step": 2, "agent": "planner", "iteration": iteration+1})
                planner_out = await planner_agent.run(request.question, analyst_out, researcher_out, critique_out)
                yield yield_event("step_done", {"step": 2, "agent": "planner", "summary": planner_out.get("strategy_summary", "")})

        # STATE 4: Ruling
        yield yield_event("step_start", {"step": 4, "agent": "arbiter"})
        arbiter_out = await ArbiterAgent().run(planner_out, critique_out)
        yield yield_event("step_done", {"step": 4, "agent": "arbiter", "summary": arbiter_out.get("ruling_summary", "")})

        # STATE 5: Formatting
        decision_card = await CommsAgent().run(
            request.question, arbiter_out, analyst_out, researcher_out
        )

        # ── Persist completed run ──────────────────────────────────────────────
        await db.execute(text("""
            UPDATE runs SET
                status            = 'complete',
                analyst_output    = CAST(:analyst AS jsonb),
                researcher_output = CAST(:researcher AS jsonb),
                planner_output    = CAST(:planner AS jsonb),
                critique_output   = CAST(:critique AS jsonb),
                arbiter_output    = CAST(:arbiter AS jsonb),
                comms_output      = CAST(:comms AS jsonb),
                decision_card     = CAST(:decision_card AS jsonb),
                completed_at      = NOW()
            WHERE id = :id
        """), {
            "id": run_id,
            "analyst": json.dumps(analyst_out, default=_json_default),
            "researcher": json.dumps(researcher_out, default=_json_default),
            "planner": json.dumps(planner_out, default=_json_default),
            "critique": json.dumps(critique_out, default=_json_default),
            "arbiter": json.dumps(arbiter_out, default=_json_default),
            "comms": json.dumps({"summary": decision_card.rationale}, default=_json_default),
            "decision_card": decision_card.model_dump_json(),
        })

        await db.execute(text("""
            INSERT INTO actions
              (id, run_id, action_type, title, description,
               target_entity, priority, status, created_at, updated_at)
            VALUES
              (:id, :run_id, 'strategy_brief', :title, :description,
               CAST(:target_entity AS jsonb), 'high', 'pending', NOW(), NOW())
        """), {
            "id": action_id,
            "run_id": run_id,
            "title": decision_card.headline[:200] or "Executive strategy brief",
            "description": (
                f"{decision_card.rationale}\n\nRecommended next step: "
                f"{decision_card.action_suggestion}"
            )[:4000],
            "target_entity": json.dumps({
                "type": "run",
                "run_id": run_id,
                "workflow": request.workflow,
                "question": request.question,
            }, default=_json_default),
        })
        await db.commit()

        reasoning = [
            ReasoningStep(agent="analyst",    label="Structured Data Retrieval",  content=analyst_out.get("summary", "")),
            ReasoningStep(agent="researcher", label="Evidence Retrieval",          content=researcher_out.get("summary", "")),
            ReasoningStep(agent="planner",    label="Strategy Generation",         content=planner_out.get("strategy_summary", "")),
            ReasoningStep(agent="risk",       label="Risk & Compliance Critique",  content=critique_out.get("critique_summary", "")),
            ReasoningStep(agent="arbiter",    label="Final Ruling",                content=arbiter_out.get("ruling_summary", "")),
        ]

        final_response = AskResponse(
            run_id=run_id,
            summary=decision_card.rationale,
            kpis=analyst_out.get("kpis", []),
            evidence=researcher_out.get("evidence", []),
            reasoning=reasoning,
            decision_card=decision_card,
            action_id=action_id,
            action_status="pending",
            created_at=started_at,
        )
        
        yield yield_event("complete", final_response.model_dump())

    except Exception as e:
        await db.execute(text("""
            UPDATE runs SET status = 'failed', error_message = :err WHERE id = :id
        """), {"err": str(e), "id": run_id})
        await db.commit()
        yield yield_event("error", {"message": str(e)})
