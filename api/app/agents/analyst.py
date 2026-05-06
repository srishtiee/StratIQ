"""
StratIQ — Analyst Agent
Retrieves structured KPI evidence from the database.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from ..schemas import AskRequest, KPIItem
from ..llm import generate_json
import json


class AnalystAgent:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def run(self, request: AskRequest) -> dict:
        """
        Query KPI snapshots, at-risk customers, usage metrics.
        Returns structured evidence dict consumed by the Planner.
        """
        # Latest KPIs
        kpi_result = await self.db.execute(text("""
            SELECT metric_name, metric_value, metadata
            FROM kpi_snapshots
            WHERE workflow = 'churn'
              AND snapshot_date = (SELECT MAX(snapshot_date) FROM kpi_snapshots WHERE workflow='churn')
        """))
        kpi_rows = kpi_result.mappings().all()

        kpis = [
            KPIItem(
                name=r["metric_name"],
                value=r["metric_value"],
                unit=(r["metadata"] or {}).get("unit"),
            )
            for r in kpi_rows
        ]

        # At-risk customer summary
        at_risk_result = await self.db.execute(text("""
            SELECT COUNT(*) AS cnt, AVG(s.mrr) AS avg_mrr
            FROM subscriptions s
            WHERE s.status = 'at_risk'
        """))
        at_risk = at_risk_result.mappings().first()

        # Top churned customers by MRR
        churned_result = await self.db.execute(text("""
            SELECT c.name, s.mrr, s.renewal_probability
            FROM customers c
            JOIN subscriptions s ON s.customer_id = c.id
            WHERE s.status IN ('churned', 'at_risk')
            ORDER BY s.mrr DESC LIMIT 5
        """))
        top_churned = churned_result.mappings().all()

        # Signal distribution
        signal_result = await self.db.execute(text("""
            SELECT signal_type, severity, COUNT(*) AS cnt
            FROM churn_signals
            WHERE resolved_at IS NULL
            GROUP BY signal_type, severity
            ORDER BY cnt DESC
        """))
        signals = signal_result.mappings().all()

        summary = (
            f"Current churn rate: {next((k.value for k in kpis if k.name=='churn_rate'), 'N/A')}%. "
            f"MRR at risk: ${next((k.value for k in kpis if k.name=='mrr_at_risk'), 'N/A')}k. "
            f"{at_risk['cnt'] or 0} customers are at risk with avg MRR ${round(float(at_risk['avg_mrr'] or 0), 0)}. "
            f"Top signals: {', '.join(set(s['signal_type'] for s in signals[:3]))}."
        )

        # Dynamic LLM Query Generation
        dynamic_context = "No custom query executed."
        try:
            sql_prompt = f"""You are an expert SQL data analyst. You have access to a PostgreSQL database with these tables:
- kpi_snapshots (snapshot_date DATE, metric_name VARCHAR, metric_value NUMERIC)
- subscriptions (id UUID, customer_id UUID, mrr NUMERIC, status VARCHAR, renewal_probability NUMERIC)
- customers (id UUID, name VARCHAR, region VARCHAR, tier VARCHAR)
- churn_signals (id UUID, customer_id UUID, signal_type VARCHAR, severity VARCHAR, created_at TIMESTAMP)

Based on the user's question: "{request.question}"
Write a single, safe PostgreSQL SELECT query that extracts specific insights to answer this question.
Ensure table aliases are used correctly. Limit results to 5 rows.
Respond ONLY with a JSON object: {{"sql_query": "SELECT ..."}}"""
            
            llm_res = await generate_json(sql_prompt, max_tokens=300)
            custom_sql = llm_res.get("sql_query", "")
            
            if custom_sql and custom_sql.strip().upper().startswith("SELECT"):
                # Safe execution wrapper
                custom_result = await self.db.execute(text(custom_sql))
                rows = custom_result.mappings().fetchmany(5)
                dynamic_context = json.dumps([dict(r) for r in rows], default=str)
                summary += f" Custom DB Insight: Found {len(rows)} targeted records."
        except Exception as e:
            dynamic_context = f"Custom query failed: {str(e)}"

        return {
            "kpis": [k.model_dump() for k in kpis],
            "at_risk_count": int(at_risk["cnt"] or 0),
            "avg_at_risk_mrr": float(at_risk["avg_mrr"] or 0),
            "top_churned": [dict(r) for r in top_churned],
            "signal_distribution": [dict(s) for s in signals],
            "dynamic_insights": dynamic_context,
            "summary": summary,
        }
