"""
StratIQ Backend — FastAPI Application Entry Point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings, _cors_origins_list
from app.api.routes import ask, customers, kpis, actions, feedback, insights, audit

app = FastAPI(
    title="StratIQ API",
    description="AI Executive Decision-Support Platform — Backend Orchestrator",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(ask.router,       prefix="/api", tags=["Ask"])
app.include_router(customers.router, prefix="/api", tags=["Customers"])
app.include_router(kpis.router,      prefix="/api", tags=["KPIs"])
app.include_router(actions.router,   prefix="/api", tags=["Actions"])
app.include_router(feedback.router,  prefix="/api", tags=["Feedback"])
app.include_router(insights.router,  prefix="/api", tags=["Insights"])
app.include_router(audit.router,     prefix="/api", tags=["Audit"])


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "service": "stratiq-backend"}
