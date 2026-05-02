"""StratIQ — /api/kpis route"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.session import get_db
from app.schemas import KPISnapshotResponse, KPIItem

router = APIRouter()


@router.get("/kpis", response_model=list[KPISnapshotResponse])
async def get_kpis(
    months: int = Query(default=12, le=24, description="Number of months of history"),
    db: AsyncSession = Depends(get_db),
):
    """Latest KPI snapshots for the churn dashboard charts."""
    sql = text("""
        SELECT snapshot_date, metric_name, metric_value, metadata
        FROM kpi_snapshots
        WHERE workflow = 'churn'
          AND snapshot_date >= CURRENT_DATE - INTERVAL '1 month' * :months
        ORDER BY snapshot_date ASC
    """)
    result = await db.execute(sql, {"months": months})
    rows = result.mappings().all()

    # Group by date
    by_date: dict = {}
    for r in rows:
        d = str(r["snapshot_date"])
        if d not in by_date:
            by_date[d] = []
        meta = r["metadata"] or {}
        by_date[d].append(KPIItem(
            name=r["metric_name"],
            value=r["metric_value"],
            unit=meta.get("unit"),
        ))

    return [
        KPISnapshotResponse(snapshot_date=d, metrics=items)
        for d, items in sorted(by_date.items())
    ]
