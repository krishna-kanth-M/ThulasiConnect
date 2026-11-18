"""Role-Adaptive Dashboards and Performance Analytics endpoints (100% real database data).

Prompt 3 corrections applied:
- `calls_today` counts operational telephone calls ONLY (`manual_telephone_call` + `verified_telephony_integration`);
  `microphone_tests_today` reports browser mic sessions separately so KPIs reconcile consistently.
- `requests_created` measures requests actually created by the employee (`created_by_user_id == emp.user_id`),
  while `requests_assigned` measures assigned workload (`assigned_employee_id == emp.id`).
- Pharmacist (`self`) dashboard request scope matches `GET /api/requests` (`assigned OR created_by`).
- `overdue_followups` is evaluated consistently across dashboard KPIs, employee metrics, and branch metrics.
- System Administrator receives a dedicated `system_admin_summary` payload (users, org warnings, scheduler,
  integrations, DB health, and recent audit activity).
"""

from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select, text
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.rbac import ROLE_SYSTEM_ADMIN, AuthContext, require_permissions
from app.models.identity import Employee, Role, User, UserRole
from app.models.operations import Call
from app.models.organization import Branch, Zone
from app.models.requests import MedicineRequest
from app.models.workflow import AuditLog, Escalation, FollowUp, IntegrationConfig, Notification
from app.services.scheduler import escalation_scheduler

router = APIRouter(prefix="/api", tags=["Dashboards & Performance"])

OPEN_REQUEST_STATUSES = {"new", "in_progress", "waiting_for_info", "waiting_for_stock", "follow_up_required"}
OPERATIONAL_CALL_SOURCES = ("manual_telephone_call", "verified_telephony_integration")

METRIC_DEFINITIONS = {
    "calls_today": "Count of operational telephone calls (`manual_telephone_call` or `verified_telephony_integration`) started today (UTC). Browser microphone test sessions are counted separately in `microphone_tests_today`.",
    "calls_registered": "Count of operational telephone calls with `registration_status` in ('registered', 'completed'). Browser microphone test sessions are reported separately and NOT counted as verified telephone calls.",
    "microphone_test_sessions": "Count of calls recorded with `call_source_type = 'browser_microphone_test'`.",
    "requests_created": "Count of customer medicine requests actually created by the employee (`created_by_user_id == employee.user_id`) in the selected period.",
    "requests_assigned": "Count of customer medicine requests currently assigned to the employee (`assigned_employee_id == employee.id`) in the selected period.",
    "requests_resolved": "Count of assigned medicine requests with status in ('resolved', 'closed') in the selected period.",
    "overdue_followups": "Count of ALL currently active follow-ups (`status in ('pending', 'overdue')` and `due_at < now UTC`) assigned to the employee/branch.",
    "avg_resolution_hours": "Mean hours between `created_at` and `resolved_at` across resolved/closed assigned requests.",
    "registration_completeness_pct": "Percentage of employee's registered operational calls that include customer phone, outcome, and summary/transcript.",
    "followup_completion_rate_pct": "Percentage of non-cancelled follow-ups in the selected period marked 'completed'.",
}


def _compute_employee_metrics(
    db: Session,
    employees: list[Employee],
    *,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> list[dict[str, Any]]:
    if not employees:
        return []
    now = datetime.now(UTC)
    emp_ids = [e.id for e in employees]
    user_ids = [e.user_id for e in employees]

    calls_stmt = select(Call).options(joinedload(Call.transcript)).where(Call.employee_id.in_(emp_ids))
    assigned_reqs_stmt = select(MedicineRequest).where(MedicineRequest.assigned_employee_id.in_(emp_ids))
    created_reqs_stmt = select(MedicineRequest).where(MedicineRequest.created_by_user_id.in_(user_ids))
    fus_period_stmt = select(FollowUp).where(FollowUp.assigned_employee_id.in_(emp_ids))
    fus_all_overdue_stmt = select(FollowUp).where(
        FollowUp.assigned_employee_id.in_(emp_ids),
        FollowUp.status.in_(["pending", "overdue"]),
        FollowUp.due_at < now,
    )

    if date_from:
        calls_stmt = calls_stmt.where(Call.started_at >= date_from)
        assigned_reqs_stmt = assigned_reqs_stmt.where(MedicineRequest.created_at >= date_from)
        created_reqs_stmt = created_reqs_stmt.where(MedicineRequest.created_at >= date_from)
        fus_period_stmt = fus_period_stmt.where(FollowUp.created_at >= date_from)
    if date_to:
        calls_stmt = calls_stmt.where(Call.started_at <= date_to)
        assigned_reqs_stmt = assigned_reqs_stmt.where(MedicineRequest.created_at <= date_to)
        created_reqs_stmt = created_reqs_stmt.where(MedicineRequest.created_at <= date_to)
        fus_period_stmt = fus_period_stmt.where(FollowUp.created_at <= date_to)

    calls = db.scalars(calls_stmt).unique().all()
    assigned_reqs = db.scalars(assigned_reqs_stmt).all()
    created_reqs = db.scalars(created_reqs_stmt).all()
    fus_period = db.scalars(fus_period_stmt).all()
    fus_overdue = db.scalars(fus_all_overdue_stmt).all()

    calls_by_emp: dict[int, list[Call]] = {eid: [] for eid in emp_ids}
    for c in calls:
        if c.employee_id in calls_by_emp:
            calls_by_emp[c.employee_id].append(c)

    assigned_by_emp: dict[int, list[MedicineRequest]] = {eid: [] for eid in emp_ids}
    for r in assigned_reqs:
        if r.assigned_employee_id in assigned_by_emp:
            assigned_by_emp[r.assigned_employee_id].append(r)

    created_by_user: dict[int, list[MedicineRequest]] = {uid: [] for uid in user_ids}
    for r in created_reqs:
        if r.created_by_user_id in created_by_user:
            created_by_user[r.created_by_user_id].append(r)

    fus_by_emp: dict[int, list[FollowUp]] = {eid: [] for eid in emp_ids}
    for f in fus_period:
        if f.assigned_employee_id in fus_by_emp:
            fus_by_emp[f.assigned_employee_id].append(f)

    overdue_by_emp: dict[int, int] = {eid: 0 for eid in emp_ids}
    for f in fus_overdue:
        if f.assigned_employee_id in overdue_by_emp:
            overdue_by_emp[f.assigned_employee_id] += 1

    out: list[dict[str, Any]] = []
    for emp in employees:
        ecalls = calls_by_emp[emp.id]
        e_assigned = assigned_by_emp[emp.id]
        e_created = created_by_user[emp.user_id]
        efus = fus_by_emp[emp.id]

        tel_calls = [
            c
            for c in ecalls
            if c.call_source_type in OPERATIONAL_CALL_SOURCES
            and c.registration_status in ("registered", "completed")
        ]
        mic_sessions = [c for c in ecalls if c.call_source_type == "browser_microphone_test"]
        complete_calls = [
            c
            for c in tel_calls
            if (c.customer_phone_snapshot and c.outcome_id is not None and (c.summary or c.transcript is not None))
        ]
        reg_completeness = round((len(complete_calls) / len(tel_calls)) * 100.0, 1) if tel_calls else None

        resolved_reqs = [r for r in e_assigned if r.status in ("resolved", "closed")]
        pending_reqs = [r for r in e_assigned if r.status in OPEN_REQUEST_STATUSES]
        res_hours_list = [
            (r.resolved_at - r.created_at).total_seconds() / 3600.0
            for r in resolved_reqs
            if r.resolved_at is not None and r.resolved_at >= r.created_at
        ]
        avg_res_hours = round(sum(res_hours_list) / len(res_hours_list), 2) if res_hours_list else None

        active_fus = [f for f in efus if f.status != "cancelled"]
        completed_fus = [f for f in active_fus if f.status == "completed"]
        fu_completion_rate = round((len(completed_fus) / len(active_fus)) * 100.0, 1) if active_fus else None

        out.append(
            {
                "employee_id": emp.id,
                "employee_code": emp.employee_code,
                "full_name": emp.user.full_name if emp.user else f"Employee #{emp.id}",
                "designation": emp.designation,
                "branch_id": emp.branch_id,
                "branch_name": emp.branch.name if emp.branch else None,
                "calls_registered": len(tel_calls),
                "microphone_test_sessions": len(mic_sessions),
                "requests_created": len(e_created),
                "requests_assigned": len(e_assigned),
                "requests_resolved": len(resolved_reqs),
                "pending_workload": len(pending_reqs),
                "overdue_followups": overdue_by_emp[emp.id],
                "avg_resolution_hours": avg_res_hours,
                "registration_completeness_pct": reg_completeness,
                "followup_completion_rate_pct": fu_completion_rate,
            }
        )
    return out


def _compute_branch_metrics(
    db: Session,
    branches: list[Branch],
    *,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> list[dict[str, Any]]:
    if not branches:
        return []
    now = datetime.now(UTC)
    b_ids = [b.id for b in branches]

    calls_stmt = select(Call).where(Call.branch_id.in_(b_ids))
    reqs_stmt = select(MedicineRequest).where(MedicineRequest.branch_id.in_(b_ids))
    # Overdue follow-ups & open escalations represent current operational backlog (all-time)
    fus_overdue_stmt = select(FollowUp).where(
        FollowUp.branch_id.in_(b_ids),
        FollowUp.status.in_(["pending", "overdue"]),
        FollowUp.due_at < now,
    )
    esc_open_stmt = select(Escalation).where(
        Escalation.branch_id.in_(b_ids),
        Escalation.status != "resolved",
    )

    if date_from:
        calls_stmt = calls_stmt.where(Call.started_at >= date_from)
        reqs_stmt = reqs_stmt.where(MedicineRequest.created_at >= date_from)
    if date_to:
        calls_stmt = calls_stmt.where(Call.started_at <= date_to)
        reqs_stmt = reqs_stmt.where(MedicineRequest.created_at <= date_to)

    calls = db.scalars(calls_stmt).all()
    reqs = db.scalars(reqs_stmt).all()
    fus_overdue = db.scalars(fus_overdue_stmt).all()
    escs_open = db.scalars(esc_open_stmt).all()

    out: list[dict[str, Any]] = []
    for b in branches:
        bc = [c for c in calls if c.branch_id == b.id]
        br = [r for r in reqs if r.branch_id == b.id]
        bf_overdue = [f for f in fus_overdue if f.branch_id == b.id]
        be_open = [e for e in escs_open if e.branch_id == b.id]

        verified_calls = [c for c in bc if c.call_source_type == "verified_telephony_integration"]
        manual_calls = [c for c in bc if c.call_source_type == "manual_telephone_call"]
        mic_tests = [c for c in bc if c.call_source_type == "browser_microphone_test"]
        registered = [
            c
            for c in (verified_calls + manual_calls)
            if c.registration_status in ("registered", "completed")
        ]
        missed = [c for c in bc if c.attendance_status == "missed"]
        unregistered = [c for c in bc if c.registration_status == "unregistered" or c.attendance_status == "unregistered"]
        pending_reqs = [r for r in br if r.status in OPEN_REQUEST_STATUSES]
        resolved_reqs = [r for r in br if r.status in ("resolved", "closed")]

        total_phone_calls = len(verified_calls) + len(manual_calls)
        reg_rate = round((len(registered) / total_phone_calls) * 100.0, 1) if total_phone_calls else None

        out.append(
            {
                "branch_id": b.id,
                "branch_code": b.code,
                "branch_name": b.name,
                "city": b.city,
                "zone_id": b.zone_id,
                "zone_name": b.zone.name if b.zone else None,
                "verified_telephony_calls": len(verified_calls),
                "manual_telephone_calls": len(manual_calls),
                "microphone_test_sessions": len(mic_tests),
                "registered_calls": len(registered),
                "missed_calls": len(missed),
                "unregistered_calls": len(unregistered),
                "registration_rate_pct": reg_rate,
                "total_requests": len(br),
                "pending_requests": len(pending_reqs),
                "resolved_requests": len(resolved_reqs),
                "overdue_followups": len(bf_overdue),
                "open_escalations": len(be_open),
            }
        )
    return out


def _build_system_admin_summary(db: Session) -> dict[str, Any]:
    total_users = db.scalar(select(func.count(User.id))) or 0
    active_users = db.scalar(select(func.count(User.id)).where(User.is_active.is_(True))) or 0
    total_zones = db.scalar(select(func.count(Zone.id))) or 0
    total_branches = db.scalar(select(func.count(Branch.id))) or 0

    branches = db.scalars(select(Branch).where(Branch.is_active.is_(True)).order_by(Branch.name.asc())).all()
    org_warnings: list[dict[str, Any]] = []
    manager_counts: dict[int, int] = {}
    for b in branches:
        if b.branch_manager_user_id:
            manager_counts[b.branch_manager_user_id] = manager_counts.get(b.branch_manager_user_id, 0) + 1

    for b in branches:
        ph_count = (
            db.scalar(
                select(func.count(Employee.id))
                .join(User, User.id == Employee.user_id)
                .join(UserRole, UserRole.user_id == User.id)
                .join(Role, Role.id == UserRole.role_id)
                .where(
                    Employee.branch_id == b.id,
                    Employee.is_active.is_(True),
                    User.is_active.is_(True),
                    Role.code == "pharmacist",
                )
            )
            or 0
        )
        if ph_count == 0:
            org_warnings.append(
                {
                    "severity": "warning",
                    "branch_code": b.code,
                    "branch_name": b.name,
                    "message": "No active pharmacists assigned to this branch.",
                }
            )
        if b.branch_manager_user_id is None:
            org_warnings.append(
                {
                    "severity": "warning",
                    "branch_code": b.code,
                    "branch_name": b.name,
                    "message": "No branch manager assigned to this branch.",
                }
            )
        elif manager_counts.get(b.branch_manager_user_id, 0) > 1:
            org_warnings.append(
                {
                    "severity": "info",
                    "branch_code": b.code,
                    "branch_name": b.name,
                    "message": (
                        f"Branch manager is shared across {manager_counts[b.branch_manager_user_id]} active branches "
                        "(confirm if intentional)."
                    ),
                }
            )

    db_ok = False
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False

    integrations = db.scalars(select(IntegrationConfig).order_by(IntegrationConfig.id.asc())).all()
    recent_audits = db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(10)).all()
    failed_logins_24h = (
        db.scalar(
            select(func.count(AuditLog.id)).where(
                AuditLog.action == "auth.login_failed",
                AuditLog.created_at >= datetime.now(UTC) - timedelta(hours=24),
            )
        )
        or 0
    )

    return {
        "users_total": total_users,
        "users_active": active_users,
        "users_inactive": total_users - active_users,
        "zones_total": total_zones,
        "branches_total": total_branches,
        "database_healthy": db_ok,
        "failed_logins_24h": failed_logins_24h,
        "scheduler": escalation_scheduler.get_status(),
        "org_warnings": org_warnings,
        "integrations": [
            {
                "integration_key": i.integration_key,
                "display_name": i.display_name,
                "status": i.status,
                "mode": i.mode,
                "last_synced_at": i.last_synced_at,
            }
            for i in integrations
        ],
        "recent_audit_logs": [
            {
                "id": a.id,
                "actor_email": a.actor_email,
                "action": a.action,
                "entity_type": a.entity_type,
                "entity_id": a.entity_id,
                "created_at": a.created_at,
            }
            for a in recent_audits
        ],
    }


@router.get("/dashboard/overview")
def get_dashboard_overview(
    branch_id: int | None = Query(default=None),
    zone_id: int | None = Query(default=None),
    days: int = Query(default=30, ge=1, le=365),
    ctx: AuthContext = Depends(require_permissions("dashboard:view")),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    now = datetime.now(UTC)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    period_start = now - timedelta(days=days)

    target_branch_ids = set(ctx.allowed_branch_ids)
    if zone_id is not None:
        if not ctx.can_access_zone(zone_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized zone.")
        z_branch_ids = set(db.scalars(select(Branch.id).where(Branch.zone_id == zone_id)).all())
        target_branch_ids = target_branch_ids.intersection(z_branch_ids)
    if branch_id is not None:
        if not ctx.can_access_branch(branch_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized branch.")
        target_branch_ids = {branch_id}

    calls_stmt = select(Call).where(Call.started_at >= period_start)
    reqs_stmt = select(MedicineRequest).where(MedicineRequest.created_at >= period_start)
    fus_stmt = select(FollowUp)
    esc_stmt = select(Escalation)

    if ctx.scope_level == "self":
        if ctx.employee_id is None:
            calls, reqs, fus, escs = [], [], [], []
        else:
            calls = db.scalars(calls_stmt.where(Call.employee_id == ctx.employee_id)).all()
            reqs = db.scalars(
                reqs_stmt.where(
                    or_(
                        MedicineRequest.assigned_employee_id == ctx.employee_id,
                        MedicineRequest.created_by_user_id == ctx.user.id,
                    )
                )
            ).all()
            fus = db.scalars(fus_stmt.where(FollowUp.assigned_employee_id == ctx.employee_id)).all()
            escs = []
    else:
        if not target_branch_ids:
            calls, reqs, fus, escs = [], [], [], []
        else:
            calls = db.scalars(calls_stmt.where(Call.branch_id.in_(target_branch_ids))).all()
            reqs = db.scalars(reqs_stmt.where(MedicineRequest.branch_id.in_(target_branch_ids))).all()
            fus = db.scalars(fus_stmt.where(FollowUp.branch_id.in_(target_branch_ids))).all()
            escs = db.scalars(esc_stmt.where(Escalation.branch_id.in_(target_branch_ids))).all()

    phone_calls = [c for c in calls if c.call_source_type in OPERATIONAL_CALL_SOURCES]
    verified_calls = [c for c in calls if c.call_source_type == "verified_telephony_integration"]
    mic_sessions = [c for c in calls if c.call_source_type == "browser_microphone_test"]

    # Consistent rule (DEF-02 fixed): calls_today counts operational telephone calls only;
    # microphone_tests_today is tracked separately so all KPIs reconcile.
    calls_today = [c for c in phone_calls if c.started_at >= today_start]
    mic_tests_today = [c for c in mic_sessions if c.started_at >= today_start]

    registered_calls = [c for c in phone_calls if c.registration_status in ("registered", "completed")]
    missed_calls = [c for c in phone_calls if c.attendance_status == "missed"]
    unregistered_calls = [
        c for c in phone_calls if c.registration_status == "unregistered" or c.attendance_status == "unregistered"
    ]

    pending_reqs = [r for r in reqs if r.status in OPEN_REQUEST_STATUSES]
    resolved_reqs = [r for r in reqs if r.status in ("resolved", "closed")]
    overdue_reqs = [
        r for r in pending_reqs if r.required_followup_at is not None and r.required_followup_at < now
    ]
    overdue_fus = [f for f in fus if f.status in ("pending", "overdue") and f.due_at < now]
    upcoming_fus = [f for f in fus if f.status == "pending" and f.due_at >= now]
    open_escs = [e for e in escs if e.status != "resolved"]

    unread_notifications = (
        db.scalars(
            select(Notification)
            .where(Notification.recipient_user_id == ctx.user.id, Notification.is_read.is_(False))
            .order_by(Notification.created_at.desc())
            .limit(8)
        ).all()
    )

    trend_days = min(days, 30)
    trend_7d: list[dict[str, Any]] = []
    for i in range(trend_days - 1, -1, -1):
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        day_calls = [c for c in calls if day_start <= c.started_at < day_end]
        trend_7d.append(
            {
                "date": day_start.strftime("%Y-%m-%d"),
                "telephone_calls": sum(1 for c in day_calls if c.call_source_type in OPERATIONAL_CALL_SOURCES),
                "microphone_tests": sum(1 for c in day_calls if c.call_source_type == "browser_microphone_test"),
                "missed_calls": sum(
                    1
                    for c in day_calls
                    if c.call_source_type in OPERATIONAL_CALL_SOURCES and c.attendance_status == "missed"
                ),
            }
        )

    branch_comparison: list[dict[str, Any]] = []
    zone_comparison: list[dict[str, Any]] = []
    employee_comparison: list[dict[str, Any]] = []

    if ctx.scope_level == "branch" and target_branch_ids:
        emps = (
            db.scalars(
                select(Employee)
                .options(joinedload(Employee.user), joinedload(Employee.branch))
                .where(Employee.branch_id.in_(target_branch_ids), Employee.is_active.is_(True))
            )
            .unique()
            .all()
        )
        employee_comparison = _compute_employee_metrics(db, emps, date_from=period_start)

    if ctx.scope_level in ("zone", "org") and target_branch_ids:
        branches = (
            db.scalars(
                select(Branch)
                .options(joinedload(Branch.zone))
                .where(Branch.id.in_(target_branch_ids))
                .order_by(Branch.name.asc())
            )
            .unique()
            .all()
        )
        branch_comparison = _compute_branch_metrics(db, branches, date_from=period_start)

    if ctx.scope_level == "org":
        zones = db.scalars(select(Zone).order_by(Zone.name.asc())).all()
        for z in zones:
            zb = [b for b in branch_comparison if b["zone_id"] == z.id]
            z_tel = sum(b["verified_telephony_calls"] + b["manual_telephone_calls"] for b in zb)
            z_reg = sum(b["registered_calls"] for b in zb)
            zone_comparison.append(
                {
                    "zone_id": z.id,
                    "zone_code": z.code,
                    "zone_name": z.name,
                    "branch_count": len(zb),
                    "telephone_calls": z_tel,
                    "registered_calls": z_reg,
                    "registration_rate_pct": round((z_reg / z_tel) * 100.0, 1) if z_tel else None,
                    "pending_requests": sum(b["pending_requests"] for b in zb),
                    "overdue_followups": sum(b["overdue_followups"] for b in zb),
                    "open_escalations": sum(b["open_escalations"] for b in zb),
                }
            )

    personal_performance = None
    if ctx.employee_id is not None:
        me_emp = (
            db.scalars(
                select(Employee)
                .options(joinedload(Employee.user), joinedload(Employee.branch))
                .where(Employee.id == ctx.employee_id)
            )
            .unique()
            .first()
        )
        if me_emp:
            personal_performance = _compute_employee_metrics(db, [me_emp], date_from=period_start)[0]

    system_admin_summary = (
        _build_system_admin_summary(db)
        if ctx.has_role(ROLE_SYSTEM_ADMIN) or ctx.has_permission("admin:users")
        else None
    )

    return {
        "view_role": ctx.primary_role,
        "scope_level": ctx.scope_level,
        "period_days": days,
        "telephony_connected": len(verified_calls) > 0,
        "telephony_note": (
            "Verified PBX/SIP telephony integration is NOT CONFIGURED; answered/missed counts reflect "
            "manually registered telephone calls only. Browser microphone prototype sessions are reported separately."
            if len(verified_calls) == 0
            else "Verified telephony data active."
        ),
        "kpis": {
            "calls_today": len(calls_today),
            "microphone_tests_today": len(mic_tests_today),
            "telephone_calls_period": len(phone_calls),
            "verified_telephony_calls": len(verified_calls),
            "microphone_test_sessions": len(mic_sessions),
            "registered_calls": len(registered_calls),
            "missed_calls": len(missed_calls),
            "unregistered_calls": len(unregistered_calls),
            "registration_rate_pct": round((len(registered_calls) / len(phone_calls)) * 100.0, 1)
            if phone_calls
            else None,
            "pending_requests": len(pending_reqs),
            "overdue_requests": len(overdue_reqs),
            "resolved_requests": len(resolved_reqs),
            "upcoming_followups": len(upcoming_fus),
            "overdue_followups": len(overdue_fus),
            "open_escalations": len(open_escs),
        },
        "trend_7d": trend_7d,
        "personal_performance": personal_performance,
        "employee_comparison": employee_comparison,
        "branch_comparison": branch_comparison,
        "zone_comparison": zone_comparison,
        "system_admin_summary": system_admin_summary,
        "recent_notifications": [
            {
                "id": n.id,
                "category": n.category,
                "severity": n.severity,
                "title": n.title,
                "message": n.message,
                "created_at": n.created_at,
            }
            for n in unread_notifications
        ],
    }


@router.get("/performance/employees")
def get_employee_performance(
    branch_id: int | None = Query(default=None),
    days: int = Query(default=30, ge=1, le=365),
    ctx: AuthContext = Depends(
        require_permissions("performance:read_own", "performance:read_branch", "performance:read_zone", "performance:read_org")
    ),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    date_from = datetime.now(UTC) - timedelta(days=days)
    stmt = (
        select(Employee)
        .options(joinedload(Employee.user), joinedload(Employee.branch))
        .where(Employee.is_active.is_(True))
        .order_by(Employee.employee_code.asc())
    )
    if ctx.scope_level == "self":
        if ctx.employee_id is None:
            return {"period_days": days, "metric_definitions": METRIC_DEFINITIONS, "employees": []}
        stmt = stmt.where(Employee.id == ctx.employee_id)
    elif ctx.scope_level in ("branch", "zone"):
        if not ctx.allowed_branch_ids:
            return {"period_days": days, "metric_definitions": METRIC_DEFINITIONS, "employees": []}
        stmt = stmt.where(Employee.branch_id.in_(ctx.allowed_branch_ids))

    if branch_id is not None:
        if not ctx.can_access_branch(branch_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized branch.")
        stmt = stmt.where(Employee.branch_id == branch_id)

    emps = db.scalars(stmt).unique().all()
    return {
        "period_days": days,
        "metric_definitions": METRIC_DEFINITIONS,
        "employees": _compute_employee_metrics(db, emps, date_from=date_from),
    }


@router.get("/performance/branches")
def get_branch_performance(
    zone_id: int | None = Query(default=None),
    days: int = Query(default=30, ge=1, le=365),
    ctx: AuthContext = Depends(
        require_permissions("performance:read_branch", "performance:read_zone", "performance:read_org")
    ),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    date_from = datetime.now(UTC) - timedelta(days=days)
    stmt = select(Branch).options(joinedload(Branch.zone)).order_by(Branch.name.asc())
    if ctx.scope_level != "org":
        if not ctx.allowed_branch_ids:
            return {"period_days": days, "branches": []}
        stmt = stmt.where(Branch.id.in_(ctx.allowed_branch_ids))
    if zone_id is not None:
        if not ctx.can_access_zone(zone_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized zone.")
        stmt = stmt.where(Branch.zone_id == zone_id)

    branches = db.scalars(stmt).unique().all()
    return {"period_days": days, "branches": _compute_branch_metrics(db, branches, date_from=date_from)}
