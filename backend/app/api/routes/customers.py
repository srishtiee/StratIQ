"""
StratIQ — /api/customers routes
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.session import get_db
from app.schemas import CustomerListItem, CustomerDetail

router = APIRouter()


@router.get("/customers", response_model=list[CustomerListItem])
async def list_customers(
    status: str | None = Query(default=None, description="Filter by subscription status"),
    tier:   str | None = Query(default=None, description="Filter by tier"),
    limit:  int = Query(default=20, le=100),
    offset: int = Query(default=0),
    db: AsyncSession = Depends(get_db),
):
    """
    List customers with their subscription status and churn risk.
    Optionally filter by subscription status (active / at_risk / churned) or tier.
    """
    where_clauses = []
    params: dict = {"limit": limit, "offset": offset}

    if status:
        where_clauses.append("s.status = :status")
        params["status"] = status
    if tier:
        where_clauses.append("c.tier = :tier")
        params["tier"] = tier

    where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    sql = text(f"""
        SELECT
            c.id, c.name, c.industry, c.tier, c.region, c.account_owner,
            s.status          AS subscription_status,
            s.renewal_probability,
            s.mrr,
            COUNT(cs.id)      AS churn_signal_count
        FROM customers c
        LEFT JOIN subscriptions  s  ON s.customer_id = c.id
        LEFT JOIN churn_signals  cs ON cs.customer_id = c.id AND cs.resolved_at IS NULL
        {where_sql}
        GROUP BY c.id, c.name, c.industry, c.tier, c.region, c.account_owner,
                 s.status, s.renewal_probability, s.mrr
        ORDER BY s.renewal_probability ASC NULLS LAST
        LIMIT :limit OFFSET :offset
    """)

    result = await db.execute(sql, params)
    rows = result.mappings().all()
    return [CustomerListItem(**dict(r)) for r in rows]


@router.get("/customers/{customer_id}", response_model=CustomerDetail)
async def get_customer(customer_id: str, db: AsyncSession = Depends(get_db)):
    """
    Get full customer detail: subscription, churn signals, latest usage metrics.
    """
    # Base customer + subscription
    sql = text("""
        SELECT
            c.id, c.name, c.industry, c.tier, c.region, c.account_owner,
            s.status AS subscription_status, s.renewal_probability, s.mrr,
            s.id AS sub_id, s.plan, s.contract_start, s.contract_end
        FROM customers c
        LEFT JOIN subscriptions s ON s.customer_id = c.id
        WHERE c.id = :cid
    """)
    result = await db.execute(sql, {"cid": customer_id})
    row = result.mappings().first()
    if not row:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Customer not found")

    # Signals
    sig_sql = text("""
        SELECT signal_type, severity, detected_at, notes
        FROM churn_signals
        WHERE customer_id = :cid AND resolved_at IS NULL
        ORDER BY detected_at DESC LIMIT 10
    """)
    sigs = (await db.execute(sig_sql, {"cid": customer_id})).mappings().all()

    # Latest usage
    usage_sql = text("""
        SELECT logins_count, api_calls, support_tickets, nps_score, period_start, period_end
        FROM usage_metrics
        WHERE customer_id = :cid
        ORDER BY period_start DESC LIMIT 1
    """)
    usage = (await db.execute(usage_sql, {"cid": customer_id})).mappings().first()

    data = dict(row)
    return CustomerDetail(
        id=data["id"],
        name=data["name"],
        industry=data.get("industry"),
        tier=data.get("tier"),
        region=data.get("region"),
        account_owner=data.get("account_owner"),
        subscription_status=data.get("subscription_status"),
        renewal_probability=data.get("renewal_probability"),
        mrr=data.get("mrr"),
        churn_signal_count=len(sigs),
        subscription={
            "id": data["sub_id"],
            "plan": data["plan"],
            "mrr": data["mrr"],
            "contract_start": data["contract_start"],
            "contract_end": data["contract_end"],
            "renewal_probability": data["renewal_probability"],
            "status": data["subscription_status"],
        } if data.get("sub_id") else None,
        recent_signals=[dict(s) for s in sigs],
        latest_usage=dict(usage) if usage else None,
    )
