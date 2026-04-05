from __future__ import annotations

import re
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from .models import Customer, DocumentChunk, SupportTicket, UsageMetric
from .schemas import EvidenceItem


def _tokens(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", text.lower()))


def retrieve_evidence(session: Session, customer: Customer, query: str, limit: int = 5) -> list[EvidenceItem]:
    query_terms = _tokens(query)
    usage = session.scalar(
        select(UsageMetric).where(UsageMetric.customer_id == customer.id).order_by(desc(UsageMetric.created_at)).limit(1)
    )
    evidence: list[tuple[float, EvidenceItem]] = []
    if usage is not None:
        evidence.append(
            (
                1.0,
                EvidenceItem(
                    id=f"ev-{usage.id}",
                    sourceType="usage_metric",
                    sourceId=usage.id,
                    title=f"Usage trend {usage.period_label}",
                    snippet=f"WAU {usage.weekly_active_users}, usage {usage.usage_change_pct:.0f}%, premium adoption {usage.premium_feature_adoption_pct:.0f}%",
                    relevance="Structured churn signal from product telemetry.",
                ),
            )
        )

    tickets = list(
        session.scalars(select(SupportTicket).where(SupportTicket.customer_id == customer.id).order_by(desc(SupportTicket.created_at)))
    )
    for ticket in tickets:
        text = f"{ticket.title} {ticket.snippet}".lower()
        overlap = len(query_terms.intersection(_tokens(text)))
        score = overlap * 2 + (2 if ticket.severity in {"P1", "P2"} else 0) + (1 if ticket.status != "Closed" else 0)
        if score == 0:
            continue
        evidence.append(
            (
                float(score + 2),
                EvidenceItem(
                    id=f"ev-{ticket.id}",
                    sourceType="support_ticket",
                    sourceId=ticket.id,
                    title=ticket.title,
                    snippet=ticket.snippet[:220],
                    relevance=f"Keyword overlap score {score} for customer-specific support context.",
                ),
            )
        )

    chunks = list(
        session.scalars(select(DocumentChunk).where((DocumentChunk.customer_id == customer.id) | (DocumentChunk.customer_id.is_(None))))
    )
    for chunk in chunks:
        overlap = len(query_terms.intersection(_tokens(chunk.content)))
        if overlap <= 0:
            continue
        evidence.append(
            (
                float(overlap + (2 if chunk.customer_id == customer.id else 0)),
                EvidenceItem(
                    id=f"ev-{chunk.id}",
                    sourceType="account_note",
                    sourceId=chunk.source_id,
                    title=chunk.title,
                    snippet=chunk.content[:220],
                    relevance=f"Document chunk match score {overlap}; vector lookup optional.",
                ),
            )
        )

    evidence.sort(key=lambda item: item[0], reverse=True)
    return [item for _, item in evidence[:limit]]
