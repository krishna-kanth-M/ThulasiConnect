"""Audit trail helper for recording security and operational actions."""

import json
from typing import Any

from sqlalchemy.orm import Session

from app.models.workflow import AuditLog


def write_audit_log(
    db: Session,
    *,
    action: str,
    entity_type: str,
    entity_id: str | int | None = None,
    actor_user_id: int | None = None,
    actor_email: str | None = None,
    details: dict[str, Any] | None = None,
    ip_address: str | None = None,
) -> AuditLog:
    entry = AuditLog(
        actor_user_id=actor_user_id,
        actor_email=actor_email,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id is not None else None,
        details_json=json.dumps(details, default=str) if details else None,
        ip_address=ip_address,
    )
    db.add(entry)
    return entry
