"""Follow-ups, Reminders, Escalations, and Configurable Escalation Policies."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.audit import write_audit_log
from app.core.database import get_db
from app.core.rbac import AuthContext, get_current_user, require_permissions
from app.models.identity import Employee
from app.models.operations import Call
from app.models.requests import MedicineRequest
from app.models.workflow import AppSetting, Escalation, FollowUp, Notification
from app.schemas.workflow import (
    EscalationOut,
    EscalationPolicyIn,
    EscalationPolicyOut,
    EscalationUpdateIn,
    FollowUpCreateIn,
    FollowUpOut,
    FollowUpUpdateIn,
)
from app.services.escalation_service import (
    SETTING_BM_MINUTES,
    SETTING_OWNER_MINUTES,
    SETTING_ZM_MINUTES,
    evaluate_overdue_followups_and_escalations,
    get_escalation_policy,
)

router = APIRouter(prefix="/api", tags=["Follow-ups & Escalations"])


def _serialize_followup(fu: FollowUp) -> FollowUpOut:
    now = datetime.now(UTC)
    is_overdue = fu.status in ("pending", "overdue") and fu.due_at < now
    return FollowUpOut(
        id=fu.id,
        branch_id=fu.branch_id,
        branch_name=fu.branch.name if fu.branch else None,
        call_id=fu.call_id,
        call_reference=fu.call.call_reference if fu.call else None,
        request_id=fu.request_id,
        request_reference=fu.request.request_reference if fu.request else None,
        customer_id=fu.customer_id,
        customer_name=(
            fu.customer.full_name
            if fu.customer
            else (fu.request.customer_name_snapshot if fu.request else None)
        ),
        customer_phone=(
            fu.customer.phone_number
            if fu.customer
            else (fu.request.customer_phone_snapshot if fu.request else None)
        ),
        assigned_employee_id=fu.assigned_employee_id,
        assigned_employee_name=(
            fu.assigned_employee.user.full_name if (fu.assigned_employee and fu.assigned_employee.user) else None
        ),
        title=fu.title,
        notes=fu.notes,
        due_at=fu.due_at,
        priority=fu.priority,
        status="overdue" if is_overdue else fu.status,
        is_overdue=is_overdue,
        completion_notes=fu.completion_notes,
        completed_at=fu.completed_at,
        reminder_sent_at=fu.reminder_sent_at,
        created_at=fu.created_at,
    )


def _serialize_escalation(e: Escalation) -> EscalationOut:
    return EscalationOut(
        id=e.id,
        branch_id=e.branch_id,
        branch_name=e.branch.name if e.branch else None,
        follow_up_id=e.follow_up_id,
        follow_up_title=e.follow_up.title if e.follow_up else None,
        request_id=e.request_id,
        call_id=e.call_id,
        escalation_level=e.escalation_level,
        target_role=e.target_role,
        target_user_id=e.target_user_id,
        target_user_name=e.target_user.full_name if e.target_user else None,
        reason=e.reason,
        status=e.status,
        resolution_notes=e.resolution_notes,
        triggered_at=e.triggered_at,
        resolved_at=e.resolved_at,
    )


@router.get("/followups", response_model=list[FollowUpOut])
def list_followups(
    status_filter: str | None = Query(default=None, alias="status"),
    branch_id: int | None = Query(default=None),
    assigned_employee_id: int | None = Query(default=None),
    overdue_only: bool = Query(default=False),
    ctx: AuthContext = Depends(
        require_permissions("followups:read_own", "followups:read_branch", "followups:read_zone", "followups:read_org")
    ),
    db: Session = Depends(get_db),
) -> list[FollowUpOut]:
    stmt = (
        select(FollowUp)
        .options(
            joinedload(FollowUp.branch),
            joinedload(FollowUp.call),
            joinedload(FollowUp.request),
            joinedload(FollowUp.customer),
            joinedload(FollowUp.assigned_employee).joinedload(Employee.user),
        )
        .order_by(FollowUp.due_at.asc())
    )

    if ctx.scope_level == "self":
        if ctx.employee_id is None:
            return []
        stmt = stmt.where(FollowUp.assigned_employee_id == ctx.employee_id)
    elif ctx.scope_level in ("branch", "zone"):
        if not ctx.allowed_branch_ids:
            return []
        stmt = stmt.where(FollowUp.branch_id.in_(ctx.allowed_branch_ids))

    if branch_id is not None:
        if not ctx.can_access_branch(branch_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized branch.")
        stmt = stmt.where(FollowUp.branch_id == branch_id)
    if assigned_employee_id is not None:
        if ctx.scope_level == "self" and assigned_employee_id != ctx.employee_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot view another employee's follow-ups.")
        stmt = stmt.where(FollowUp.assigned_employee_id == assigned_employee_id)
    if status_filter:
        stmt = stmt.where(FollowUp.status == status_filter)
    if overdue_only:
        stmt = stmt.where(FollowUp.status.in_(["pending", "overdue"]), FollowUp.due_at < datetime.now(UTC))

    rows = db.scalars(stmt).unique().all()
    return [_serialize_followup(r) for r in rows]


@router.post("/followups", response_model=FollowUpOut, status_code=status.HTTP_201_CREATED)
def create_followup(
    payload: FollowUpCreateIn,
    request: Request,
    ctx: AuthContext = Depends(require_permissions("followups:create")),
    db: Session = Depends(get_db),
) -> FollowUpOut:
    branch_id = payload.branch_id or ctx.user.branch_id or next(iter(ctx.allowed_branch_ids), None)
    customer_id = payload.customer_id
    call_id = payload.call_id

    if payload.request_id:
        req = db.get(MedicineRequest, payload.request_id)
        if not req:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Linked request not found.")
        branch_id = req.branch_id
        customer_id = customer_id or req.customer_id
        call_id = call_id or req.call_id
    elif payload.call_id:
        call = db.get(Call, payload.call_id)
        if not call:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Linked call not found.")
        branch_id = call.branch_id
        customer_id = customer_id or call.customer_id

    if branch_id is None or not ctx.can_access_branch(branch_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Valid authorized branch is required.")

    assigned_emp_id = (
        payload.assigned_employee_id
        if (payload.assigned_employee_id and ctx.scope_level != "self")
        else ctx.employee_id
    )
    if assigned_emp_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Assigned employee is required.")

    emp = db.get(Employee, assigned_emp_id)
    if not emp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assigned employee not found.")

    due_at = payload.due_at if payload.due_at.tzinfo else payload.due_at.replace(tzinfo=UTC)
    initial_status = "overdue" if due_at < datetime.now(UTC) else "pending"

    fu = FollowUp(
        branch_id=branch_id,
        call_id=call_id,
        request_id=payload.request_id,
        customer_id=customer_id,
        assigned_employee_id=emp.id,
        created_by_user_id=ctx.user.id,
        title=payload.title.strip(),
        notes=payload.notes,
        due_at=due_at,
        priority=payload.priority,
        status=initial_status,
    )
    db.add(fu)
    db.flush()

    if emp.user_id != ctx.user.id:
        db.add(
            Notification(
                recipient_user_id=emp.user_id,
                category="reminder",
                severity="info",
                title=f"New Follow-up Assigned: {fu.title}",
                message=f"Due at {due_at.strftime('%Y-%m-%d %H:%M UTC')}.",
                entity_type="follow_up",
                entity_id=fu.id,
                dedup_key=f"fu:{fu.id}:assigned:{emp.user_id}",
            )
        )

    write_audit_log(
        db,
        action="followup.created",
        entity_type="follow_up",
        entity_id=fu.id,
        actor_user_id=ctx.user.id,
        actor_email=ctx.user.email,
        details={"title": fu.title, "due_at": due_at.isoformat(), "assigned_employee_id": emp.id},
        ip_address=request.client.host if request.client else None,
    )
    db.commit()

    loaded = (
        db.scalars(
            select(FollowUp)
            .options(
                joinedload(FollowUp.branch),
                joinedload(FollowUp.call),
                joinedload(FollowUp.request),
                joinedload(FollowUp.customer),
                joinedload(FollowUp.assigned_employee).joinedload(Employee.user),
            )
            .where(FollowUp.id == fu.id)
        )
        .unique()
        .first()
    )
    assert loaded is not None
    return _serialize_followup(loaded)


@router.patch("/followups/{followup_id}", response_model=FollowUpOut)
def update_followup(
    followup_id: int,
    payload: FollowUpUpdateIn,
    request: Request,
    ctx: AuthContext = Depends(require_permissions("followups:update_own", "followups:update_branch")),
    db: Session = Depends(get_db),
) -> FollowUpOut:
    fu = db.get(FollowUp, followup_id)
    if not fu:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Follow-up not found.")
    if ctx.scope_level == "self" and fu.assigned_employee_id != ctx.employee_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only update your own follow-ups.")
    if not ctx.can_access_branch(fu.branch_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized branch.")

    if payload.title is not None:
        fu.title = payload.title.strip()
    if payload.notes is not None:
        fu.notes = payload.notes
    if payload.due_at is not None:
        fu.due_at = payload.due_at if payload.due_at.tzinfo else payload.due_at.replace(tzinfo=UTC)
    if payload.priority is not None:
        fu.priority = payload.priority
    if payload.assigned_employee_id is not None and ctx.scope_level != "self":
        emp = db.get(Employee, payload.assigned_employee_id)
        if not emp or not ctx.can_access_branch(emp.branch_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid employee.")
        fu.assigned_employee_id = emp.id
    if payload.completion_notes is not None:
        fu.completion_notes = payload.completion_notes
    if payload.status is not None:
        fu.status = payload.status
        if payload.status == "completed":
            fu.completed_at = datetime.now(UTC)
            # Auto-resolve any open escalations tied to this follow-up
            open_escs = db.scalars(
                select(Escalation).where(Escalation.follow_up_id == fu.id, Escalation.status != "resolved")
            ).all()
            for esc in open_escs:
                esc.status = "resolved"
                esc.resolved_at = datetime.now(UTC)
                esc.resolved_by_user_id = ctx.user.id
                esc.resolution_notes = payload.completion_notes or "Linked follow-up completed."

    write_audit_log(
        db,
        action="followup.updated",
        entity_type="follow_up",
        entity_id=fu.id,
        actor_user_id=ctx.user.id,
        actor_email=ctx.user.email,
        details={"status": fu.status, "completion_notes": fu.completion_notes},
        ip_address=request.client.host if request.client else None,
    )
    db.commit()

    loaded = (
        db.scalars(
            select(FollowUp)
            .options(
                joinedload(FollowUp.branch),
                joinedload(FollowUp.call),
                joinedload(FollowUp.request),
                joinedload(FollowUp.customer),
                joinedload(FollowUp.assigned_employee).joinedload(Employee.user),
            )
            .where(FollowUp.id == fu.id)
        )
        .unique()
        .first()
    )
    assert loaded is not None
    return _serialize_followup(loaded)


@router.post("/followups/evaluate-escalations")
def run_escalation_evaluation(
    request: Request,
    ctx: AuthContext = Depends(
        require_permissions(
            "escalations:manage_branch",
            "escalations:manage_zone",
            "escalations:manage_org",
            "admin:settings",
        )
    ),
    db: Session = Depends(get_db),
) -> dict[str, int]:
    """Evaluate overdue follow-ups and generate deduplicated reminders and escalations (management/admin only)."""
    result = evaluate_overdue_followups_and_escalations(db)
    write_audit_log(
        db,
        action="escalations.evaluated",
        entity_type="escalation",
        actor_user_id=ctx.user.id,
        actor_email=ctx.user.email,
        details=result,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return result


@router.get("/escalations", response_model=list[EscalationOut])
def list_escalations(
    status_filter: str | None = Query(default=None, alias="status"),
    branch_id: int | None = Query(default=None),
    ctx: AuthContext = Depends(
        require_permissions("escalations:read_branch", "escalations:read_zone", "escalations:read_org")
    ),
    db: Session = Depends(get_db),
) -> list[EscalationOut]:
    stmt = (
        select(Escalation)
        .options(
            joinedload(Escalation.branch),
            joinedload(Escalation.follow_up),
            joinedload(Escalation.target_user),
        )
        .order_by(Escalation.triggered_at.desc())
    )
    if ctx.scope_level != "org":
        if not ctx.allowed_branch_ids:
            return []
        stmt = stmt.where(Escalation.branch_id.in_(ctx.allowed_branch_ids))
    if branch_id is not None:
        if not ctx.can_access_branch(branch_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized branch.")
        stmt = stmt.where(Escalation.branch_id == branch_id)
    if status_filter:
        stmt = stmt.where(Escalation.status == status_filter)

    rows = db.scalars(stmt).unique().all()
    return [_serialize_escalation(e) for e in rows]


@router.patch("/escalations/{escalation_id}", response_model=EscalationOut)
def update_escalation(
    escalation_id: int,
    payload: EscalationUpdateIn,
    request: Request,
    ctx: AuthContext = Depends(
        require_permissions("escalations:manage_branch", "escalations:manage_zone", "escalations:manage_org")
    ),
    db: Session = Depends(get_db),
) -> EscalationOut:
    esc = db.get(Escalation, escalation_id)
    if not esc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Escalation not found.")
    if not ctx.can_access_branch(esc.branch_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized branch escalation.")

    esc.status = payload.status
    if payload.resolution_notes is not None:
        esc.resolution_notes = payload.resolution_notes
    if payload.status == "resolved":
        esc.resolved_at = datetime.now(UTC)
        esc.resolved_by_user_id = ctx.user.id

    write_audit_log(
        db,
        action="escalation.updated",
        entity_type="escalation",
        entity_id=esc.id,
        actor_user_id=ctx.user.id,
        actor_email=ctx.user.email,
        details={"status": esc.status, "resolution_notes": esc.resolution_notes},
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    loaded = (
        db.scalars(
            select(Escalation)
            .options(
                joinedload(Escalation.branch),
                joinedload(Escalation.follow_up),
                joinedload(Escalation.target_user),
            )
            .where(Escalation.id == esc.id)
        )
        .unique()
        .first()
    )
    assert loaded is not None
    return _serialize_escalation(loaded)


@router.get("/settings/escalation-policy", response_model=EscalationPolicyOut)
def read_escalation_policy(
    _ctx: AuthContext = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EscalationPolicyOut:
    return EscalationPolicyOut(**get_escalation_policy(db))


@router.put("/settings/escalation-policy", response_model=EscalationPolicyOut)
def update_escalation_policy(
    payload: EscalationPolicyIn,
    request: Request,
    ctx: AuthContext = Depends(require_permissions("admin:settings")),
    db: Session = Depends(get_db),
) -> EscalationPolicyOut:
    pairs = [
        (SETTING_BM_MINUTES, str(payload.branch_manager_overdue_minutes), "Minutes overdue before Branch Manager escalation"),
        (SETTING_ZM_MINUTES, str(payload.zonal_manager_overdue_minutes), "Minutes overdue before Zonal Manager escalation"),
        (SETTING_OWNER_MINUTES, str(payload.owner_overdue_minutes), "Minutes overdue before Owner escalation"),
    ]
    for key, val, desc in pairs:
        existing = db.get(AppSetting, key)
        if existing:
            existing.value = val
            existing.updated_by_user_id = ctx.user.id
        else:
            db.add(AppSetting(key=key, value=val, description=desc, updated_by_user_id=ctx.user.id))

    write_audit_log(
        db,
        action="admin.escalation_policy_updated",
        entity_type="app_setting",
        actor_user_id=ctx.user.id,
        actor_email=ctx.user.email,
        details=payload.model_dump(),
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return EscalationPolicyOut(**payload.model_dump())
