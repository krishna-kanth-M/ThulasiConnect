"""Lightweight asyncio background scheduler for automated overdue follow-up escalations.

Designed for 8 GB RAM / dual-core Windows hardware:
- Zero extra third-party scheduler daemons (no Redis/Celery).
- Runs inside FastAPI lifespan, restarts automatically with the application, stops cleanly on shutdown.
- Executes DB evaluation in a worker thread with an explicit stop event so shutdown is instantaneous.
"""

import asyncio
import logging
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import text

from app.core.audit import write_audit_log
from app.core.database import SessionLocal
from app.services.escalation_service import evaluate_overdue_followups_and_escalations

logger = logging.getLogger("thulasiconnect.scheduler")


class EscalationScheduler:
    def __init__(self, interval_seconds: int = 60) -> None:
        self.interval_seconds = max(15, interval_seconds)
        self._task: asyncio.Task[None] | None = None
        self._stop_event: asyncio.Event | None = None
        self._running = False
        self.started_at: datetime | None = None
        self.last_run_at: datetime | None = None
        self.last_status: str = "idle"
        self.last_result: dict[str, int] | None = None
        self.last_error: str | None = None
        self.run_count: int = 0
        self.error_count: int = 0

    def _run_once_sync(self) -> dict[str, int]:
        db = SessionLocal()
        # ThulasiConnect 64-bit integer advisory lock key (hash identifier for escalation scheduler)
        SCHEDULER_LOCK_ID = 84251293
        acquired_lock = False
        try:
            # Single-instance safeguard: acquire non-blocking PostgreSQL advisory lock if running on PostgreSQL
            if db.bind and db.bind.dialect.name == "postgresql":
                lock_res = db.scalar(text(f"SELECT pg_try_advisory_lock({SCHEDULER_LOCK_ID})"))
                if not lock_res:
                    logger.debug("Escalation scheduler cycle skipped: advisory lock held by another active instance.")
                    return {
                        "status": "skipped_concurrent_instance_running",
                        "evaluated_overdue": 0,
                        "newly_marked_overdue": 0,
                        "reminders_created": 0,
                        "escalations_created": 0,
                        "notifications_created": 0,
                        "config_warnings_created": 0,
                    }
                acquired_lock = True

            res = evaluate_overdue_followups_and_escalations(db)
            if (
                res["newly_marked_overdue"] > 0
                or res["reminders_created"] > 0
                or res["escalations_created"] > 0
                or res["config_warnings_created"] > 0
            ):
                write_audit_log(
                    db,
                    action="scheduler.escalations_evaluated",
                    entity_type="escalation",
                    actor_email="system.scheduler@thulasiconnect",
                    details=res,
                )
            db.commit()
            return res
        except Exception:
            db.rollback()
            raise
        finally:
            if acquired_lock and db.bind and db.bind.dialect.name == "postgresql":
                try:
                    db.execute(text(f"SELECT pg_advisory_unlock({SCHEDULER_LOCK_ID})"))
                    db.commit()
                except Exception as unlock_err:
                    logger.warning("Failed to release advisory lock cleanly: %s", unlock_err)
            db.close()

    async def run_cycle_now(self) -> dict[str, int]:
        try:
            result = await asyncio.to_thread(self._run_once_sync)
            self.last_run_at = datetime.now(UTC)
            self.last_status = "ok"
            self.last_result = result
            self.last_error = None
            self.run_count += 1
            return result
        except Exception as exc:
            self.last_run_at = datetime.now(UTC)
            self.last_status = "error"
            self.last_error = str(exc)
            self.error_count += 1
            logger.exception("Escalation scheduler cycle failed: %s", exc)
            return {
                "evaluated_overdue": 0,
                "newly_marked_overdue": 0,
                "reminders_created": 0,
                "escalations_created": 0,
                "notifications_created": 0,
                "config_warnings_created": 0,
            }

    async def _loop(self) -> None:
        assert self._stop_event is not None
        # Brief initial delay so startup requests complete without lock contention
        try:
            await asyncio.wait_for(self._stop_event.wait(), timeout=2.0)
            return
        except TimeoutError:
            pass

        while self._running and not self._stop_event.is_set():
            await self.run_cycle_now()
            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=float(self.interval_seconds))
                break
            except TimeoutError:
                continue

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._stop_event = asyncio.Event()
        self.started_at = datetime.now(UTC)
        self._task = asyncio.create_task(self._loop(), name="thulasiconnect-escalation-scheduler")
        logger.info("Escalation scheduler started (interval=%ss)", self.interval_seconds)

    async def stop(self) -> None:
        self._running = False
        if self._stop_event:
            self._stop_event.set()
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        self._stop_event = None
        logger.info("Escalation scheduler stopped")

    def get_status(self) -> dict[str, Any]:
        return {
            "running": self._running,
            "interval_seconds": self.interval_seconds,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "last_run_at": self.last_run_at.isoformat() if self.last_run_at else None,
            "last_status": self.last_status,
            "last_result": self.last_result,
            "last_error": self.last_error,
            "run_count": self.run_count,
            "error_count": self.error_count,
        }


escalation_scheduler = EscalationScheduler(interval_seconds=60)
