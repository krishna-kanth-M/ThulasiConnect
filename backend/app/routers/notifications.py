"""In-app Notifications endpoints (scoped strictly to the authenticated recipient)."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rbac import AuthContext, require_permissions
from app.models.workflow import Notification
from app.schemas.workflow import NotificationOut

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


@router.get("", response_model=list[NotificationOut])
def list_notifications(
    unread_only: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=200),
    ctx: AuthContext = Depends(require_permissions("notifications:read")),
    db: Session = Depends(get_db),
) -> list[NotificationOut]:
    stmt = (
        select(Notification)
        .where(Notification.recipient_user_id == ctx.user.id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )
    if unread_only:
        stmt = stmt.where(Notification.is_read.is_(False))
    rows = db.scalars(stmt).all()
    return [
        NotificationOut(
            id=n.id,
            recipient_user_id=n.recipient_user_id,
            category=n.category,
            severity=n.severity,
            title=n.title,
            message=n.message,
            entity_type=n.entity_type,
            entity_id=n.entity_id,
            is_read=n.is_read,
            read_at=n.read_at,
            created_at=n.created_at,
        )
        for n in rows
    ]


@router.get("/unread-count")
def get_unread_count(
    ctx: AuthContext = Depends(require_permissions("notifications:read")),
    db: Session = Depends(get_db),
) -> dict[str, int]:
    cnt = (
        db.scalar(
            select(func.count(Notification.id)).where(
                Notification.recipient_user_id == ctx.user.id, Notification.is_read.is_(False)
            )
        )
        or 0
    )
    return {"unread_count": cnt}


@router.patch("/{notification_id}/read", response_model=NotificationOut)
def mark_notification_read(
    notification_id: int,
    ctx: AuthContext = Depends(require_permissions("notifications:read")),
    db: Session = Depends(get_db),
) -> NotificationOut:
    n = db.get(Notification, notification_id)
    if not n or n.recipient_user_id != ctx.user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found.")
    if not n.is_read:
        n.is_read = True
        n.read_at = datetime.now(UTC)
        db.commit()
    return NotificationOut(
        id=n.id,
        recipient_user_id=n.recipient_user_id,
        category=n.category,
        severity=n.severity,
        title=n.title,
        message=n.message,
        entity_type=n.entity_type,
        entity_id=n.entity_id,
        is_read=n.is_read,
        read_at=n.read_at,
        created_at=n.created_at,
    )


@router.post("/mark-all-read")
def mark_all_notifications_read(
    ctx: AuthContext = Depends(require_permissions("notifications:read")),
    db: Session = Depends(get_db),
) -> dict[str, int]:
    now = datetime.now(UTC)
    unread = db.scalars(
        select(Notification).where(Notification.recipient_user_id == ctx.user.id, Notification.is_read.is_(False))
    ).all()
    for n in unread:
        n.is_read = True
        n.read_at = now
    db.commit()
    return {"marked_read": len(unread)}
