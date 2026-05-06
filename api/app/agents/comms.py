"""StratIQ — Comms Agent (Decision Card Formatter)"""
import json
from ..schemas import DecisionCard, KPIItem, EvidenceItem


class CommsAgent:
    async def run(
        self,
        question: str,
        arbiter_out: dict,
        analyst_out: dict,
        researcher_out: dict,
    ) -> DecisionCard:
        """
        Formats arbiter output + evidence into a structured DecisionCard.
        No additional LLM call needed — pure formatting from structured outputs.
        """
        rec = arbiter_out.get("recommended_strategy", {})
        kpis = [KPIItem(**k) for k in analyst_out.get("kpis", [])]
        
        raw_evidence = researcher_out.get("evidence", [])
        evidence = []
        for e in raw_evidence:
            # Map old schema fields to new schema fields
            evidence.append(EvidenceItem(
                id=e.get("id", "ev-" + str(hash(e.get("snippet", "")))),
                sourceType="account_note", # Defaulting for agent-derived evidence
                sourceId=e.get("source_id", "0"),
                title=e.get("source_title", e.get("title", "Evidence")),
                snippet=e.get("snippet", ""),
                relevance=str(e.get("relevance_score", e.get("relevance", "High")))
            ))

        return DecisionCard(
            headline=rec.get("name", "Strategic Recommendation"),
            rationale=arbiter_out.get("rationale", rec.get("description", "")),
            key_metrics=kpis[:4],
            cited_evidence=evidence[:3],
            main_risks=arbiter_out.get("main_risks", []),
            assumptions=arbiter_out.get("assumptions", []),
            action_suggestion=arbiter_out.get("action_suggestion", ""),
            kpis_to_monitor=arbiter_out.get("kpis_to_monitor", []),
        )
