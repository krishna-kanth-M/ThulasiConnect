"""Operational Reports & Authorized CSV Export endpoints (real stored data only)."""

import csv
import io
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.rbac import AuthContext, require_permissions
from app.models.identity import Employee
from app.models.operations import Call
from app.models.organization import Branch
from app.models.requests import MedicineRequest
from app.models.workflow import Escalation, FollowUp
from app.routers.dashboard import (
    OPEN_REQUEST_STATUSES,
    _compute_branch_metrics,
    _compute_employee_metrics,
)

router = APIRouter(prefix="/api/reports", tags=["Reports & Analytics"])

ReportType = Literal[
    "daily_calls",
    "weekly_calls",
    "monthly_calls",
    "branch_performance",
    "employee_performance",
    "pending_requests",
    "overdue_followups",
    "escalations",
]


def _build_report_rows(
    db: Session,
    ctx: AuthContext,
    report_type: ReportType,
    date_from: datetime,
    date_to: datetime,
    branch_id: int | None,
) -> tuple[list[str], list[dict[str, Any]]]:
    allowed_branches = set(ctx.allowed_branch_ids)
    if branch_id is not None:
        if not ctx.can_access_branch(branch_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized branch.")
        allowed_branches = {branch_id}

    if not allowed_branches and ctx.scope_level != "org":
        return [], []

    if report_type in ("daily_calls", "weekly_calls", "monthly_calls"):
        stmt = (
            select(Call)
            .options(joinedload(Call.branch), joinedload(Call.employee).joinedload(Employee.user), joinedload(Call.outcome))
            .where(Call.started_at >= date_from, Call.started_at <= date_to)
            .order_by(Call.started_at.desc())
        )
        if allowed_branches:
            stmt = stmt.where(Call.branch_id.in_(allowed_branches))
        calls = db.scalars(stmt).unique().all()
        columns = [
            "call_reference",
            "started_at",
            "branch",
            "employee",
            "customer_name",
            "customer_phone",
            "direction",
            "source_type",
            "attendance_status",
            "registration_status",
            "outcome",
        ]
        rows = [
            {
                "call_reference": c.call_reference,
                "started_at": c.started_at.isoformat(),
                "branch": c.branch.name if c.branch else "",
                "employee": c.employee.user.full_name if (c.employee and c.employee.user) else "",
                "customer_name": c.customer_name_snapshot or "",
                "customer_phone": c.customer_phone_snapshot or "",
                "direction": c.call_direction,
                "source_type": c.call_source_type,
                "attendance_status": c.attendance_status,
                "registration_status": c.registration_status,
                "outcome": c.outcome.label if c.outcome else "",
            }
            for c in calls
        ]
        return columns, rows

    if report_type == "branch_performance":
        stmt = select(Branch).options(joinedload(Branch.zone)).order_by(Branch.name.asc())
        if allowed_branches:
            stmt = stmt.where(Branch.id.in_(allowed_branches))
        branches = db.scalars(stmt).unique().all()
        rows = _compute_branch_metrics(db, branches, date_from=date_from, date_to=date_to)
        columns = list(rows[0].keys()) if rows else []
        return columns, rows

    if report_type == "employee_performance":
        stmt = (
            select(Employee)
            .options(joinedload(Employee.user), joinedload(Employee.branch))
            .where(Employee.is_active.is_(True))
        )
        if allowed_branches:
            stmt = stmt.where(Employee.branch_id.in_(allowed_branches))
        emps = db.scalars(stmt).unique().all()
        rows = _compute_employee_metrics(db, emps, date_from=date_from, date_to=date_to)
        columns = list(rows[0].keys()) if rows else []
        return columns, rows

    if report_type == "pending_requests":
        stmt = (
            select(MedicineRequest)
            .options(
                joinedload(MedicineRequest.branch),
                joinedload(MedicineRequest.assigned_employee).joinedload(Employee.user),
                joinedload(MedicineRequest.items),
            )
            .where(
                MedicineRequest.status.in_(OPEN_REQUEST_STATUSES),
                MedicineRequest.created_at >= date_from,
                MedicineRequest.created_at <= date_to,
            )
            .order_by(MedicineRequest.created_at.desc())
        )
        if allowed_branches:
            stmt = stmt.where(MedicineRequest.branch_id.in_(allowed_branches))
        reqs = db.scalars(stmt).unique().all()
        columns = [
            "request_reference",
            "created_at",
            "branch",
            "customer_name",
            "customer_phone",
            "medicines",
            "priority",
            "status",
            "assigned_employee",
            "required_followup_at",
        ]
        rows = [
            {
                "request_reference": r.request_reference,
                "created_at": r.created_at.isoformat(),
                "branch": r.branch.name if r.branch else "",
                "customer_name": r.customer_name_snapshot,
                "customer_phone": r.customer_phone_snapshot,
                "medicines": "; ".join(f"{i.medicine_name} {i.strength or ''}".strip() for i in r.items),
                "priority": r.priority,
                "status": r.status,
                "assigned_employee": (
                    r.assigned_employee.user.full_name
                    if (r.assigned_employee and r.assigned_employee.user)
                    else ""
                ),
                "required_followup_at": r.required_followup_at.isoformat() if r.required_followup_at else "",
            }
            for r in reqs
        ]
        return columns, rows

    if report_type == "overdue_followups":
        now = datetime.now(UTC)
        stmt = (
            select(FollowUp)
            .options(joinedload(FollowUp.branch), joinedload(FollowUp.assigned_employee).joinedload(Employee.user))
            .where(
                FollowUp.status.in_(["pending", "overdue"]),
                FollowUp.due_at < now,
                FollowUp.due_at >= date_from,
                FollowUp.due_at <= date_to,
            )
            .order_by(FollowUp.due_at.asc())
        )
        if allowed_branches:
            stmt = stmt.where(FollowUp.branch_id.in_(allowed_branches))
        fus = db.scalars(stmt).unique().all()
        columns = ["id", "title", "branch", "assigned_employee", "due_at", "priority", "status"]
        rows = [
            {
                "id": f.id,
                "title": f.title,
                "branch": f.branch.name if f.branch else "",
                "assigned_employee": (
                    f.assigned_employee.user.full_name
                    if (f.assigned_employee and f.assigned_employee.user)
                    else ""
                ),
                "due_at": f.due_at.isoformat(),
                "priority": f.priority,
                "status": "overdue",
            }
            for f in fus
        ]
        return columns, rows

    # escalations
    stmt = (
        select(Escalation)
        .options(joinedload(Escalation.branch), joinedload(Escalation.target_user), joinedload(Escalation.follow_up))
        .where(Escalation.triggered_at >= date_from, Escalation.triggered_at <= date_to)
        .order_by(Escalation.triggered_at.desc())
    )
    if allowed_branches:
        stmt = stmt.where(Escalation.branch_id.in_(allowed_branches))
    escs = db.scalars(stmt).unique().all()
    columns = ["id", "triggered_at", "branch", "escalation_level", "target_role", "target_user", "status", "reason"]
    rows = [
        {
            "id": e.id,
            "triggered_at": e.triggered_at.isoformat(),
            "branch": e.branch.name if e.branch else "",
            "escalation_level": e.escalation_level,
            "target_role": e.target_role,
            "target_user": e.target_user.full_name if e.target_user else "",
            "status": e.status,
            "reason": e.reason,
        }
        for e in escs
    ]
    return columns, rows


def _resolve_date_range(
    report_type: ReportType, date_from: datetime | None, date_to: datetime | None
) -> tuple[datetime, datetime]:
    now = datetime.now(UTC)
    end = date_to if date_to else now
    if end.tzinfo is None:
        end = end.replace(tzinfo=UTC)
    if date_from is not None:
        start = date_from if date_from.tzinfo else date_from.replace(tzinfo=UTC)
        return start, end
    if report_type == "daily_calls":
        return end - timedelta(days=1), end
    if report_type == "weekly_calls":
        return end - timedelta(days=7), end
    return end - timedelta(days=30), end


@router.get("/{report_type}")
def get_report(
    report_type: ReportType,
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    branch_id: int | None = Query(default=None),
    ctx: AuthContext = Depends(require_permissions("reports:branch", "reports:zone", "reports:org")),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    start, end = _resolve_date_range(report_type, date_from, date_to)
    columns, rows = _build_report_rows(db, ctx, report_type, start, end, branch_id)
    return {
        "report_type": report_type,
        "date_from": start.isoformat(),
        "date_to": end.isoformat(),
        "row_count": len(rows),
        "columns": columns,
        "rows": rows,
    }


@router.get("/{report_type}/export.csv")
def export_report_csv(
    report_type: ReportType,
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    branch_id: int | None = Query(default=None),
    ctx: AuthContext = Depends(require_permissions("reports:branch", "reports:zone", "reports:org")),
    db: Session = Depends(get_db),
) -> Response:
    start, end = _resolve_date_range(report_type, date_from, date_to)
    columns, rows = _build_report_rows(db, ctx, report_type, start, end, branch_id)

    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=columns or ["message"])
    writer.writeheader()
    if rows:
        writer.writerows(rows)
    else:
        writer.writerow({"message": "No records found for the selected filter range."})

    filename = f"thulasiconnect_{report_type}_{datetime.now(UTC).strftime('%Y%m%d_%H%M')}.csv"
    return Response(
        content=buf.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
