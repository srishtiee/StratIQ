from fastapi import APIRouter

from app.api.v1.endpoints import uploads, people, retention, queries, actions, dashboard

api_router = APIRouter()

api_router.include_router(uploads.router, prefix="/uploads", tags=["uploads"])
api_router.include_router(people.router, prefix="/people", tags=["people"])
api_router.include_router(retention.router, prefix="/retention", tags=["retention"])
api_router.include_router(queries.router, prefix="/queries", tags=["queries"])
api_router.include_router(actions.router, prefix="/actions", tags=["actions"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
