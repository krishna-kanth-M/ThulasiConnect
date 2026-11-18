"""Follow-up reminder and hierarchical escalation evaluation engine (deduplicated).

Fixes applied in Prompt 3:
- Level 3 Owner escalation notifies ALL active eligible Owner accounts (deduplicated per user).
- If no active eligible recipient exists for any triggered escalation level, creates a deduplicated
  administrative configuration warning notification for all active System Administrators so escalations
  are never silently discarded.
- Preserves configured SLA thresholds (default: L1=60m, L2=240m, L3=1440m).
"""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.config import get_settings
from app.core.rbac import ROLE_OWNER, ROLE_SYSTEM_ADMIN
from app.models.identity import Employee, Role, User, UserRole
from app.models.organization import Branch
from app.models.workflow import AppSetting, Escalation, FollowUp, Notification

SETTING_BM_MINUTES = "escalation_branch_manager_overdue_minutes"
SETTING_ZM_MINUTES = "escalation_zonal_manager_overdue_minutes"
SETTING_OWNER_MINUTES = "escalation_owner_overdue_minutes"


def get_escalation_policy(db: Session) -> dict[str, int]:
    settings = get_settings()
    rows = {s.key: s.value for s in db.scalars(select(AppSetting)).all()}
    return {
        "branch_manager_overdue_minutes": int(
            rows.get(SETTING_BM_MINUTES, settings.escalation_branch_manager_overdue_minutes)
        ),
        "zonal_manager_overdue_minutes": int(
            rows.get(SETTING_ZM_MINUTES, settings.escalation_zonal_manager_overdue_minutes)
        ),
        "owner_overdue_minutes": int(
            rows.get(SETTING_OWNER_MINUTES, settings.escalation_owner_overdue_minutes)
        ),
    }


def _create_notification_once(
    db: Session,
    *,
    recipient_user_id: int,
    category: str,
    severity: str,
    title: str,
    message: str,
    dedup_key: str,
    entity_type: str | None = None,
    entity_id: int | None = None,
) -> bool:
    existing = db.scalar(select(Notification.id).where(Notification.dedup_key == dedup_key))
    if existing is not None:
        return False
    db.add(
        Notification(
            recipient_user_id=recipient_user_id,
            category=category,
            severity=severity,
            title=title,
            message=message,
            entity_type=entity_type,
            entity_id=entity_id,
            dedup_key=dedup_key,
        )
    )
    return True


def _active_users_by_role(db: Session, role_code: str) -> list[User]:
    return list(
        db.scalars(
            select(User)
            .join(UserRole, UserRole.user_id == User.id)
            .join(Role, Role.id == UserRole.role_id)
            .where(Role.code == role_code, User.is_active.is_(True))
        )
        .unique()
        .all()
    )


def evaluate_overdue_followups_and_escalations(db: Session) -> dict[str, int]:
    """Mark overdue follow-ups, emit deduplicated employee reminders, and escalate hierarchically."""
    now = datetime.now(UTC)
    policy = get_escalation_policy(db)

    stmt = (
        select(FollowUp)
        .options(
            joinedload(FollowUp.assigned_employee).joinedload(Employee.user),
            joinedload(FollowUp.branch).joinedload(Branch.zone),
        )
        .where(FollowUp.status.in_(["pending", "overdue"]), FollowUp.due_at < now)
    )
    overdue_items = db.scalars(stmt).unique().all()

    owners = _active_users_by_role(db, ROLE_OWNER)
    admins = _active_users_by_role(db, ROLE_SYSTEM_ADMIN)

    marked_overdue = 0
    reminders_created = 0
    escalations_created = 0
    notifications_created = 0
    config_warnings_created = 0

    for fu in overdue_items:
        if fu.status != "overdue":
            fu.status = "overdue"
            marked_overdue += 1

        overdue_minutes = (now - fu.due_at).total_seconds() / 60.0

        # Step 1: Employee overdue reminder (deduplicated per follow-up)
        emp_user = fu.assigned_employee.user if fu.assigned_employee else None
        if emp_user and emp_user.is_active:
            created = _create_notification_once(
                db,
                recipient_user_id=emp_user.id,
                category="reminder",
                severity="warning",
                title=f"Overdue Follow-up: {fu.title}",
                message=(
                    f"Follow-up #{fu.id} ('{fu.title}') was due at {fu.due_at.strftime('%Y-%m-%d %H:%M UTC')} "
                    f"and is overdue by {int(overdue_minutes)} minutes."
                ),
                dedup_key=f"fu:{fu.id}:employee_reminder",
                entity_type="follow_up",
                entity_id=fu.id,
            )
            if created:
                fu.reminder_sent_at = now
                reminders_created += 1
                notifications_created += 1

        branch = fu.branch
        zone = branch.zone if branch else None

        bm_threshold = (
            branch.escalation_overdue_minutes
            if (branch and branch.escalation_overdue_minutes)
            else policy["branch_manager_overdue_minutes"]
        )
        zm_threshold = policy["zonal_manager_overdue_minutes"]
        owner_threshold = policy["owner_overdue_minutes"]

        def _maybe_escalate(
            level: int,
            role_code: str,
            recipient_ids: list[int],
            threshold: int,
        ) -> None:
            nonlocal escalations_created, notifications_created, config_warnings_created
            if overdue_minutes < threshold:
                return

            esc = db.scalar(
                select(Escalation).where(
                    Escalation.follow_up_id == fu.id,
                    Escalation.escalation_level == level,
                )
            )
            reason = (
                f"Follow-up #{fu.id} ('{fu.title}') at branch {branch.name if branch else fu.branch_id} "
                f"is overdue by {int(overdue_minutes)} minutes (threshold: {threshold} min)."
            )
            if esc is None:
                esc = Escalation(
                    branch_id=fu.branch_id,
                    follow_up_id=fu.id,
                    request_id=fu.request_id,
                    call_id=fu.call_id,
                    escalation_level=level,
                    target_role=role_code,
                    target_user_id=recipient_ids[0] if recipient_ids else None,
                    reason=reason,
                    status="open",
                )
                db.add(esc)
                db.flush()
                escalations_created += 1

            if recipient_ids:
                for uid in recipient_ids:
                    if _create_notification_once(
                        db,
                        recipient_user_id=uid,
                        category="escalation",
                        severity="critical" if level >= 2 else "warning",
                        title=f"Level {level} Escalation: {fu.title}",
                        message=reason,
                        dedup_key=f"fu:{fu.id}:esc_l{level}:u{uid}",
                        entity_type="escalation",
                        entity_id=esc.id,
                    ):
                        notifications_created += 1
            else:
                # Never silently discard an escalation when recipient configuration is missing
                for adm in admins:
                    if _create_notification_once(
                        db,
                        recipient_user_id=adm.id,
                        category="system_alert",
                        severity="warning",
                        title=f"Escalation Config Warning (L{level} {role_code} missing)",
                        message=(
                            f"Escalation #{esc.id} for follow-up #{fu.id} at branch "
                            f"{branch.name if branch else fu.branch_id} has no active '{role_code}' recipient configured."
                        ),
                        dedup_key=f"fu:{fu.id}:esc_l{level}:missing_recipient:adm{adm.id}",
                        entity_type="escalation",
                        entity_id=esc.id,
                    ):
                        config_warnings_created += 1
                        notifications_created += 1

        # Level 1 -> Branch Manager (only if active)
        bm_ids: list[int] = []
        if branch and branch.branch_manager_user_id:
            bm_user = db.get(User, branch.branch_manager_user_id)
            if bm_user and bm_user.is_active:
                bm_ids.append(bm_user.id)
        _maybe_escalate(1, "branch_manager", bm_ids, bm_threshold)

        # Level 2 -> Zonal Manager (only if active)
        zm_ids: list[int] = []
        if zone and zone.zonal_manager_user_id:
            zm_user = db.get(User, zone.zonal_manager_user_id)
            if zm_user and zm_user.is_active:
                zm_ids.append(zm_user.id)
        _maybe_escalate(2, "zonal_manager", zm_ids, zm_threshold)

        # Level 3 -> ALL active eligible Owners
        owner_ids = [o.id for o in owners]
        _maybe_escalate(3, "owner", owner_ids, owner_threshold)

    db.flush()
    return {
        "evaluated_overdue": len(overdue_items),
        "newly_marked_overdue": marked_overdue,
        "reminders_created": reminders_created,
        "escalations_created": escalations_created,
        "notifications_created": notifications_created,
        "config_warnings_created": config_warnings_created,
    }
