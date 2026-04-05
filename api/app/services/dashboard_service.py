from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import Approval, Customer
from ..schemas import DashboardInsights


def get_dashboard_insights(session: Session) -> DashboardInsights:
    customers = list(session.scalars(select(Customer)))
    critical = [c for c in customers if c.risk_level in {"Critical", "High"}]
    open_approvals = session.scalar(select(func.count()).select_from(Approval).where(Approval.status.in_(["pending", "approved"]))) or 0
    return DashboardInsights(
        portfolioAtRisk=len(critical),
        renewalWindow=len(critical),
        executiveConfidence="Prototype",
        actionQueue=open_approvals,
        riskMix=[
            {"label": "Critical", "count": sum(1 for c in customers if c.risk_level == "Critical"), "accent": "#c45c56"},
            {"label": "High", "count": sum(1 for c in customers if c.risk_level == "High"), "accent": "#c9852a"},
            {"label": "Moderate", "count": sum(1 for c in customers if c.risk_level == "Moderate"), "accent": "#1f6d73"},
            {"label": "Low", "count": sum(1 for c in customers if c.risk_level == "Low"), "accent": "#3d8a62"},
        ],
        highlights=[
            "Customer churn workflow is active for executive review.",
            "Evidence, critique, and approval are persisted with request IDs.",
        ],
    )
