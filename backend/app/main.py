"""ThulasiConnect FastAPI Application Entrypoint."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.core.rbac import ensure_roles_and_permissions_seeded
from app.routers import (
    auth,
    calls,
    customers,
    dashboard,
    followups,
    integrations,
    notifications,
    organization,
    reports,
    requests,
    system_health,
    transcription,
    users,
)
from app.routers.calls import ensure_call_outcomes_seeded
from app.services.scheduler import escalation_scheduler
from app.services.shopaid_adapter import ensure_shopaid_config
from app.services.telephony_adapter import ensure_telephony_config

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Ensure baseline reference metadata (roles, permissions, outcomes, integration stubs) exists
    db = SessionLocal()
    try:
        ensure_roles_and_permissions_seeded(db)
        ensure_call_outcomes_seeded(db)
        ensure_shopaid_config(db)
        ensure_telephony_config(db)
        db.commit()
    finally:
        db.close()
    escalation_scheduler.start()
    try:
        yield
    finally:
        await escalation_scheduler.stop()


app = FastAPI(
    title="ThulasiConnect API",
    description=(
        "Enterprise Multi-Branch Pharmacy Call Management, In-Memory Speech Transcription, "
        "Customer Medicine Request Tracking, and Hierarchical Supervision Platform."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all modular routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(organization.router)
app.include_router(customers.router)
app.include_router(calls.router)
app.include_router(transcription.router)
app.include_router(requests.router)
app.include_router(followups.router)
app.include_router(dashboard.router)
app.include_router(notifications.router)
app.include_router(reports.router)
app.include_router(integrations.router)
app.include_router(system_health.router)


@app.get("/api/health", tags=["System"])
def health_check() -> dict[str, object]:
    db_ok = False
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False
    finally:
        db.close()
    return {
        "status": "ok" if db_ok else "degraded",
        "application": settings.app_name,
        "database_connected": db_ok,
        "audio_storage_enabled": False,
        "scheduler": escalation_scheduler.get_status(),
    }
