"""Customer & Medicine Request Management endpoints with multi-item & status history tracking."""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from app.core.audit import write_audit_log
from app.core.database import get_db
from app.core.rbac import AuthContext, require_permissions
from app.models.identity import Employee
from app.models.operations import Call, Customer
from app.models.requests import (
    MedicineRequest,
    MedicineRequestItem,
    RequestStatusHistory,
)
from app.models.workflow import FollowUp, Notification
from app.schemas.requests import (
    MedicineRequestCreateIn,
    MedicineRequestItemOut,
    MedicineRequestOut,
    MedicineRequestUpdateIn,
    RequestStatusHistoryOut,
)

router = APIRouter(prefix="/api/requests", tags=["Medicine Requests"])


def _assert_can_view_request(ctx: AuthContext, req: MedicineRequest) -> None:
    if ctx.scope_level == "org":
        return
    if ctx.scope_level == "self":
        if req.assigned_employee_id != ctx.employee_id and req.created_by_user_id != ctx.user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to access this request.")
        return
    if not ctx.can_access_branch(req.branch_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Request belongs to an unauthorized branch.")


def _serialize_request(req: MedicineRequest) -> MedicineRequestOut:
    return MedicineRequestOut(
        id=req.id,
        request_reference=req.request_reference,
        branch_id=req.branch_id,
        branch_name=req.branch.name if req.branch else None,
        call_id=req.call_id,
        call_reference=req.call.call_reference if req.call else None,
        customer_id=req.customer_id,
        customer_name=req.customer_name_snapshot,
        customer_phone=req.customer_phone_snapshot,
        assigned_employee_id=req.assigned_employee_id,
        assigned_employee_name=(
            req.assigned_employee.user.full_name
            if (req.assigned_employee and req.assigned_employee.user)
            else None
        ),
        status=req.status,
        priority=req.priority,
        inquiry_type=req.inquiry_type,
        employee_notes=req.employee_notes,
        resolution_details=req.resolution_details,
        cancellation_reason=req.cancellation_reason,
        required_followup_at=req.required_followup_at,
        resolved_at=req.resolved_at,
        closed_at=req.closed_at,
        created_at=req.created_at,
        updated_at=req.updated_at,
        items=[
            MedicineRequestItemOut(
                id=i.id,
                medicine_name=i.medicine_name,
                strength=i.strength,
                dosage_form=i.dosage_form,
                quantity=i.quantity,
                availability_status=i.availability_status,
                price_inquiry=i.price_inquiry,
                quoted_price=i.quoted_price,
                verification_status=i.verification_status,
                notes=i.notes,
            )
            for i in req.items
        ],
        status_history=[
            RequestStatusHistoryOut(
                id=h.id,
                from_status=h.from_status,
                to_status=h.to_status,
                changed_by_user_id=h.changed_by_user_id,
                changed_by_name=h.changed_by.full_name if h.changed_by else None,
                note=h.note,
                changed_at=h.changed_at,
            )
            for h in req.status_history
        ],
    )


def _load_request(db: Session, request_id: int) -> MedicineRequest | None:
    stmt = (
        select(MedicineRequest)
        .options(
            joinedload(MedicineRequest.branch),
            joinedload(MedicineRequest.call),
            joinedload(MedicineRequest.assigned_employee).joinedload(Employee.user),
            joinedload(MedicineRequest.items),
            joinedload(MedicineRequest.status_history).joinedload(RequestStatusHistory.changed_by),
        )
        .where(MedicineRequest.id == request_id)
    )
    return db.scalars(stmt).unique().first()


@router.get("", response_model=list[MedicineRequestOut])
def list_requests(
    search: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    priority: str | None = Query(default=None),
    branch_id: int | None = Query(default=None),
    assigned_employee_id: int | None = Query(default=None),
    call_id: int | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=300),
    ctx: AuthContext = Depends(
        require_permissions("requests:read_own", "requests:read_branch", "requests:read_zone", "requests:read_org")
    ),
    db: Session = Depends(get_db),
) -> list[MedicineRequestOut]:
    stmt = (
        select(MedicineRequest)
        .options(
            joinedload(MedicineRequest.branch),
            joinedload(MedicineRequest.call),
            joinedload(MedicineRequest.assigned_employee).joinedload(Employee.user),
            joinedload(MedicineRequest.items),
            joinedload(MedicineRequest.status_history).joinedload(RequestStatusHistory.changed_by),
        )
        .order_by(MedicineRequest.created_at.desc())
    )

    if ctx.scope_level == "self":
        if ctx.employee_id is None:
            return []
        stmt = stmt.where(
            or_(
                MedicineRequest.assigned_employee_id == ctx.employee_id,
                MedicineRequest.created_by_user_id == ctx.user.id,
            )
        )
    elif ctx.scope_level in ("branch", "zone"):
        if not ctx.allowed_branch_ids:
            return []
        stmt = stmt.where(MedicineRequest.branch_id.in_(ctx.allowed_branch_ids))

    if branch_id is not None:
        if not ctx.can_access_branch(branch_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized branch.")
        stmt = stmt.where(MedicineRequest.branch_id == branch_id)
    if assigned_employee_id is not None:
        if ctx.scope_level == "self" and assigned_employee_id != ctx.employee_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot filter by another employee.")
        stmt = stmt.where(MedicineRequest.assigned_employee_id == assigned_employee_id)
    if call_id is not None:
        stmt = stmt.where(MedicineRequest.call_id == call_id)
    if status_filter:
        stmt = stmt.where(MedicineRequest.status == status_filter)
    if priority:
        stmt = stmt.where(MedicineRequest.priority == priority)
    if search:
        q = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                MedicineRequest.request_reference.ilike(q),
                MedicineRequest.customer_name_snapshot.ilike(q),
                MedicineRequest.customer_phone_snapshot.ilike(q),
                MedicineRequest.employee_notes.ilike(q),
            )
        )

    rows = db.scalars(stmt.limit(limit)).unique().all()
    return [_serialize_request(r) for r in rows]


@router.post("", response_model=MedicineRequestOut, status_code=status.HTTP_201_CREATED)
def create_request(
    payload: MedicineRequestCreateIn,
    request: Request,
    ctx: AuthContext = Depends(require_permissions("requests:create")),
    db: Session = Depends(get_db),
) -> MedicineRequestOut:
    branch_id = payload.branch_id or ctx.user.branch_id or next(iter(ctx.allowed_branch_ids), None)
    if payload.call_id:
        call = db.get(Call, payload.call_id)
        if not call:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Linked call not found.")
        branch_id = call.branch_id
    if branch_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Branch ID is required.")
    if not ctx.can_access_branch(branch_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized branch.")

    # Resolve/reuse customer
    customer_id = payload.customer_id
    if customer_id is None:
        phone_clean = payload.customer_phone.strip()
        existing_cust = db.scalar(
            select(Customer).where(Customer.branch_id == branch_id, Customer.phone_number == phone_clean)
        )
        if existing_cust:
            customer_id = existing_cust.id
        else:
            new_cust = Customer(
                branch_id=branch_id,
                full_name=payload.customer_name.strip(),
                phone_number=phone_clean,
            )
            db.add(new_cust)
            db.flush()
            customer_id = new_cust.id

    assigned_emp_id = (
        payload.assigned_employee_id
        if (payload.assigned_employee_id and ctx.has_permission("requests:assign_branch"))
        else ctx.employee_id
    )

    req_ref = f"REQ-{datetime.now(UTC).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    req = MedicineRequest(
        request_reference=req_ref,
        branch_id=branch_id,
        call_id=payload.call_id,
        customer_id=customer_id,
        customer_name_snapshot=payload.customer_name.strip(),
        customer_phone_snapshot=payload.customer_phone.strip(),
        assigned_employee_id=assigned_emp_id,
        created_by_user_id=ctx.user.id,
        status="new",
        priority=payload.priority,
        inquiry_type=payload.inquiry_type,
        employee_notes=payload.employee_notes,
        required_followup_at=payload.required_followup_at,
    )
    db.add(req)
    db.flush()

    for item in payload.items:
        db.add(
            MedicineRequestItem(
                request_id=req.id,
                medicine_name=item.medicine_name.strip(),
                strength=item.strength,
                dosage_form=item.dosage_form,
                quantity=item.quantity,
                availability_status=item.availability_status,
                price_inquiry=item.price_inquiry,
                quoted_price=item.quoted_price,
                verification_status=item.verification_status,
                notes=item.notes,
            )
        )

    db.add(
        RequestStatusHistory(
            request_id=req.id,
            from_status=None,
            to_status="new",
            changed_by_user_id=ctx.user.id,
            note="Customer medicine request created.",
        )
    )

    if payload.create_followup and payload.required_followup_at and assigned_emp_id:
        med_names = ", ".join(i.medicine_name.strip() for i in payload.items[:3])
        db.add(
            FollowUp(
                branch_id=branch_id,
                call_id=payload.call_id,
                request_id=req.id,
                customer_id=customer_id,
                assigned_employee_id=assigned_emp_id,
                created_by_user_id=ctx.user.id,
                title=payload.followup_title or f"Callback {payload.customer_name.strip()}: {med_names}"[:180],
                notes=payload.employee_notes,
                due_at=payload.required_followup_at,
                priority=payload.priority,
                status="pending",
            )
        )

    write_audit_log(
        db,
        action="request.created",
        entity_type="medicine_request",
        entity_id=req.id,
        actor_user_id=ctx.user.id,
        actor_email=ctx.user.email,
        details={"request_reference": req.request_reference, "item_count": len(payload.items)},
        ip_address=request.client.host if request.client else None,
    )
    db.commit()

    loaded = _load_request(db, req.id)
    assert loaded is not None
    return _serialize_request(loaded)


@router.get("/{request_id}", response_model=MedicineRequestOut)
def get_request_detail(
    request_id: int,
    ctx: AuthContext = Depends(
        require_permissions("requests:read_own", "requests:read_branch", "requests:read_zone", "requests:read_org")
    ),
    db: Session = Depends(get_db),
) -> MedicineRequestOut:
    req = _load_request(db, request_id)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medicine request not found.")
    _assert_can_view_request(ctx, req)
    return _serialize_request(req)


@router.patch("/{request_id}", response_model=MedicineRequestOut)
def update_request(
    request_id: int,
    payload: MedicineRequestUpdateIn,
    request: Request,
    ctx: AuthContext = Depends(require_permissions("requests:update_own", "requests:update_branch")),
    db: Session = Depends(get_db),
) -> MedicineRequestOut:
    req = _load_request(db, request_id)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medicine request not found.")
    _assert_can_view_request(ctx, req)

    changes: dict[str, object] = {}
    old_status = req.status

    if payload.status is not None and payload.status != req.status:
        if payload.status == "cancelled" and not (payload.cancellation_reason or payload.status_note):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cancellation reason is required when cancelling a request.",
            )
        req.status = payload.status
        now = datetime.now(UTC)
        if payload.status == "resolved" and req.resolved_at is None:
            req.resolved_at = now
        if payload.status == "closed":
            if req.resolved_at is None:
                req.resolved_at = now
            req.closed_at = now
        if payload.status == "cancelled":
            req.cancellation_reason = payload.cancellation_reason or payload.status_note

        db.add(
            RequestStatusHistory(
                request_id=req.id,
                from_status=old_status,
                to_status=payload.status,
                changed_by_user_id=ctx.user.id,
                note=payload.status_note or payload.resolution_details or payload.cancellation_reason,
            )
        )
        changes["status"] = f"{old_status} -> {payload.status}"

    if payload.priority is not None:
        req.priority = payload.priority
        changes["priority"] = payload.priority
    if payload.employee_notes is not None:
        req.employee_notes = payload.employee_notes
    if payload.resolution_details is not None:
        req.resolution_details = payload.resolution_details
    if payload.cancellation_reason is not None:
        req.cancellation_reason = payload.cancellation_reason
    if payload.required_followup_at is not None:
        req.required_followup_at = payload.required_followup_at

    if payload.assigned_employee_id is not None and payload.assigned_employee_id != req.assigned_employee_id:
        if not ctx.has_permission("requests:assign_branch") and ctx.scope_level == "self":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only managers can reassign requests to another employee.",
            )
        emp = db.get(Employee, payload.assigned_employee_id)
        if not emp or not ctx.can_access_branch(emp.branch_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid employee assignment.")
        req.assigned_employee_id = emp.id
        changes["assigned_employee_id"] = emp.id
        db.add(
            Notification(
                recipient_user_id=emp.user_id,
                category="request_update",
                severity="info",
                title=f"Request Assigned: {req.request_reference}",
                message=f"You have been assigned customer request {req.request_reference} ({req.customer_name_snapshot}).",
                entity_type="medicine_request",
                entity_id=req.id,
            )
        )

    if payload.items is not None:
        if not payload.items:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Request must have at least one item.")
        db.query(MedicineRequestItem).filter(MedicineRequestItem.request_id == req.id).delete()
        db.flush()
        for item in payload.items:
            db.add(
                MedicineRequestItem(
                    request_id=req.id,
                    medicine_name=item.medicine_name.strip(),
                    strength=item.strength,
                    dosage_form=item.dosage_form,
                    quantity=item.quantity,
                    availability_status=item.availability_status,
                    price_inquiry=item.price_inquiry,
                    quoted_price=item.quoted_price,
                    verification_status=item.verification_status,
                    notes=item.notes,
                )
            )
        changes["items_updated"] = len(payload.items)

    write_audit_log(
        db,
        action="request.updated",
        entity_type="medicine_request",
        entity_id=req.id,
        actor_user_id=ctx.user.id,
        actor_email=ctx.user.email,
        details=changes,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    db.expire_all()

    refreshed = _load_request(db, req.id)
    assert refreshed is not None
    return _serialize_request(refreshed)
