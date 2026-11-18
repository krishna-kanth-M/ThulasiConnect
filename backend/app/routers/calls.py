"""Call Management, Call Outcomes, and Text-Only Transcript endpoints."""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.core.audit import write_audit_log
from app.core.database import get_db
from app.core.rbac import AuthContext, get_current_user, require_permissions
from app.models.identity import Employee
from app.models.operations import (
    Call,
    CallOutcome,
    CallTranscript,
    Customer,
    Speaker,
    TranscriptSegment,
)
from app.models.requests import MedicineRequest
from app.models.workflow import FollowUp
from app.schemas.operations import (
    CallCreateIn,
    CallDetailOut,
    CallOut,
    CallOutcomeOut,
    CallUpdateIn,
    TranscriptOut,
    TranscriptSaveIn,
    TranscriptSegmentOut,
)

router = APIRouter(prefix="/api", tags=["Calls & Transcripts"])

DEFAULT_CALL_OUTCOMES = [
    ("medicine_inquiry_logged", "Medicine Inquiry Logged", True),
    ("availability_confirmed", "Availability Confirmed", False),
    ("price_quoted", "Price Quoted", False),
    ("callback_scheduled", "Callback Scheduled", True),
    ("order_reserved_pickup", "Order Reserved for Branch Pickup", False),
    ("stock_unavailable_followup", "Stock Unavailable — Follow-up Needed", True),
    ("missed_call_pending_callback", "Missed Call — Callback Pending", True),
    ("general_inquiry_resolved", "General Inquiry Resolved", False),
]


def ensure_call_outcomes_seeded(db: Session) -> None:
    existing = set(db.scalars(select(CallOutcome.code)).all())
    for code, label, req_fu in DEFAULT_CALL_OUTCOMES:
        if code not in existing:
            db.add(CallOutcome(code=code, label=label, requires_followup=req_fu, is_active=True))
    db.flush()


def _assert_can_view_call(ctx: AuthContext, call: Call) -> None:
    if ctx.scope_level == "org":
        return
    if ctx.scope_level == "self":
        if call.employee_id != ctx.employee_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You may only access your own calls.")
        return
    if not ctx.can_access_branch(call.branch_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Call belongs to an unauthorized branch.")


def _serialize_call(db: Session, call: Call) -> CallOut:
    req_count = db.scalar(select(func.count(MedicineRequest.id)).where(MedicineRequest.call_id == call.id)) or 0
    fu_count = db.scalar(select(func.count(FollowUp.id)).where(FollowUp.call_id == call.id)) or 0
    has_tr = db.scalar(select(CallTranscript.id).where(CallTranscript.call_id == call.id)) is not None
    emp_name = call.employee.user.full_name if (call.employee and call.employee.user) else None
    return CallOut(
        id=call.id,
        call_reference=call.call_reference,
        branch_id=call.branch_id,
        branch_name=call.branch.name if call.branch else None,
        employee_id=call.employee_id,
        employee_name=emp_name,
        customer_id=call.customer_id,
        customer_name=call.customer_name_snapshot or (call.customer.full_name if call.customer else None),
        customer_phone=call.customer_phone_snapshot or (call.customer.phone_number if call.customer else None),
        call_direction=call.call_direction,
        call_source_type=call.call_source_type,
        attendance_status=call.attendance_status,
        registration_status=call.registration_status,
        outcome_id=call.outcome_id,
        outcome_code=call.outcome.code if call.outcome else None,
        outcome_label=call.outcome.label if call.outcome else None,
        outcome_notes=call.outcome_notes,
        summary=call.summary,
        detected_language=call.detected_language,
        has_transcript=has_tr,
        request_count=req_count,
        followup_count=fu_count,
        started_at=call.started_at,
        ended_at=call.ended_at,
        created_at=call.created_at,
    )


def _serialize_transcript(tr: CallTranscript) -> TranscriptOut:
    return TranscriptOut(
        id=tr.id,
        call_id=tr.call_id,
        full_text=tr.full_text,
        language_detected=tr.language_detected,
        model_used=tr.model_used,
        average_confidence=tr.average_confidence,
        review_status=tr.review_status,
        ai_extraction_json=tr.ai_extraction_json,
        segments=[
            TranscriptSegmentOut(
                id=s.id,
                sequence_index=s.sequence_index,
                speaker_label=s.speaker_label,
                start_seconds=s.start_seconds,
                end_seconds=s.end_seconds,
                text=s.text,
                language=s.language,
                confidence=s.confidence,
                is_edited=s.is_edited,
            )
            for s in tr.segments
        ],
        updated_at=tr.updated_at,
    )


@router.get("/call-outcomes", response_model=list[CallOutcomeOut])
def list_call_outcomes(
    _ctx: AuthContext = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[CallOutcomeOut]:
    outcomes = db.scalars(select(CallOutcome).where(CallOutcome.is_active.is_(True)).order_by(CallOutcome.id.asc())).all()
    return [
        CallOutcomeOut(
            id=o.id,
            code=o.code,
            label=o.label,
            requires_followup=o.requires_followup,
            is_active=o.is_active,
        )
        for o in outcomes
    ]


@router.get("/calls", response_model=list[CallOut])
def list_calls(
    search: str | None = Query(default=None),
    branch_id: int | None = Query(default=None),
    employee_id: int | None = Query(default=None),
    call_source_type: str | None = Query(default=None),
    registration_status: str | None = Query(default=None),
    attendance_status: str | None = Query(default=None),
    outcome_code: str | None = Query(default=None),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=300),
    ctx: AuthContext = Depends(
        require_permissions("calls:read_own", "calls:read_branch", "calls:read_zone", "calls:read_org")
    ),
    db: Session = Depends(get_db),
) -> list[CallOut]:
    stmt = (
        select(Call)
        .options(
            joinedload(Call.branch),
            joinedload(Call.employee).joinedload(Employee.user),
            joinedload(Call.customer),
            joinedload(Call.outcome),
        )
        .order_by(Call.started_at.desc())
    )

    if ctx.scope_level == "self":
        if ctx.employee_id is None:
            return []
        stmt = stmt.where(Call.employee_id == ctx.employee_id)
    elif ctx.scope_level in ("branch", "zone"):
        if not ctx.allowed_branch_ids:
            return []
        stmt = stmt.where(Call.branch_id.in_(ctx.allowed_branch_ids))

    if branch_id is not None:
        if not ctx.can_access_branch(branch_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized branch filter.")
        stmt = stmt.where(Call.branch_id == branch_id)
    if employee_id is not None:
        if ctx.scope_level == "self" and employee_id != ctx.employee_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot view another employee's calls.")
        stmt = stmt.where(Call.employee_id == employee_id)
    if call_source_type:
        stmt = stmt.where(Call.call_source_type == call_source_type)
    if registration_status:
        stmt = stmt.where(Call.registration_status == registration_status)
    if attendance_status:
        stmt = stmt.where(Call.attendance_status == attendance_status)
    if outcome_code:
        outcome_obj = db.scalar(select(CallOutcome.id).where(CallOutcome.code == outcome_code))
        if outcome_obj is None:
            return []
        stmt = stmt.where(Call.outcome_id == outcome_obj)
    if date_from:
        stmt = stmt.where(Call.started_at >= date_from)
    if date_to:
        stmt = stmt.where(Call.started_at <= date_to)
    if search:
        q = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Call.call_reference.ilike(q),
                Call.customer_name_snapshot.ilike(q),
                Call.customer_phone_snapshot.ilike(q),
                Call.summary.ilike(q),
            )
        )

    calls = db.scalars(stmt.limit(limit)).unique().all()
    return [_serialize_call(db, c) for c in calls]


@router.post("/calls", response_model=CallDetailOut, status_code=status.HTTP_201_CREATED)
def create_call(
    payload: CallCreateIn,
    request: Request,
    ctx: AuthContext = Depends(require_permissions("calls:create")),
    db: Session = Depends(get_db),
) -> CallDetailOut:
    # Guardrail: Verified telephony integration calls cannot be spoofed as manual browser entries
    if payload.call_source_type == "verified_telephony_integration" and not ctx.has_permission("admin:integrations"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Verified telephony calls can only be created by an authorized telephony integration adapter. "
                "Use 'manual_telephone_call' or 'browser_microphone_test'."
            ),
        )

    branch_id = payload.branch_id or ctx.user.branch_id or next(iter(ctx.allowed_branch_ids), None)
    if branch_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Branch ID is required.")
    if not ctx.can_access_branch(branch_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot register call for unauthorized branch.")

    employee_id = payload.employee_id if (payload.employee_id and ctx.scope_level != "self") else ctx.employee_id

    customer: Customer | None = None
    if payload.customer_id:
        customer = db.get(Customer, payload.customer_id)
        if not customer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found.")
    elif payload.customer_phone and payload.customer_name:
        phone_clean = payload.customer_phone.strip()
        customer = db.scalar(
            select(Customer).where(Customer.branch_id == branch_id, Customer.phone_number == phone_clean)
        )
        if not customer:
            customer = Customer(
                branch_id=branch_id,
                full_name=payload.customer_name.strip(),
                phone_number=phone_clean,
            )
            db.add(customer)
            db.flush()

    outcome_id: int | None = None
    if payload.outcome_code:
        outcome = db.scalar(select(CallOutcome).where(CallOutcome.code == payload.outcome_code))
        if not outcome:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid outcome_code.")
        outcome_id = outcome.id

    call_ref = f"TC-{datetime.now(UTC).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    call = Call(
        call_reference=call_ref,
        branch_id=branch_id,
        employee_id=employee_id,
        customer_id=customer.id if customer else None,
        customer_name_snapshot=(payload.customer_name.strip() if payload.customer_name else (customer.full_name if customer else None)),
        customer_phone_snapshot=(payload.customer_phone.strip() if payload.customer_phone else (customer.phone_number if customer else None)),
        call_direction=payload.call_direction,
        call_source_type=payload.call_source_type,
        attendance_status=payload.attendance_status,
        registration_status=payload.registration_status,
        outcome_id=outcome_id,
        outcome_notes=payload.outcome_notes,
        summary=payload.summary,
        detected_language=payload.detected_language,
        started_at=payload.started_at or datetime.now(UTC),
        ended_at=payload.ended_at,
    )
    db.add(call)
    db.flush()

    write_audit_log(
        db,
        action="call.registered",
        entity_type="call",
        entity_id=call.id,
        actor_user_id=ctx.user.id,
        actor_email=ctx.user.email,
        details={
            "call_reference": call.call_reference,
            "branch_id": call.branch_id,
            "source_type": call.call_source_type,
            "registration_status": call.registration_status,
        },
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return get_call_detail(call.id, ctx, db)


@router.get("/calls/{call_id}", response_model=CallDetailOut)
def get_call_detail(
    call_id: int,
    ctx: AuthContext = Depends(
        require_permissions("calls:read_own", "calls:read_branch", "calls:read_zone", "calls:read_org")
    ),
    db: Session = Depends(get_db),
) -> CallDetailOut:
    call = (
        db.scalars(
            select(Call)
            .options(
                joinedload(Call.branch),
                joinedload(Call.employee).joinedload(Employee.user),
                joinedload(Call.customer),
                joinedload(Call.outcome),
                joinedload(Call.transcript).joinedload(CallTranscript.segments),
            )
            .where(Call.id == call_id)
        )
        .unique()
        .first()
    )
    if not call:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found.")
    _assert_can_view_call(ctx, call)

    base = _serialize_call(db, call)
    req_ids = list(db.scalars(select(MedicineRequest.id).where(MedicineRequest.call_id == call.id)).all())
    fu_ids = list(db.scalars(select(FollowUp.id).where(FollowUp.call_id == call.id)).all())
    return CallDetailOut(
        **base.model_dump(),
        transcript=_serialize_transcript(call.transcript) if call.transcript else None,
        request_ids=req_ids,
        followup_ids=fu_ids,
    )


@router.patch("/calls/{call_id}", response_model=CallDetailOut)
def update_call(
    call_id: int,
    payload: CallUpdateIn,
    request: Request,
    ctx: AuthContext = Depends(require_permissions("calls:update_own", "calls:update_branch")),
    db: Session = Depends(get_db),
) -> CallDetailOut:
    call = db.get(Call, call_id)
    if not call:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found.")
    _assert_can_view_call(ctx, call)

    if payload.customer_id is not None:
        cust = db.get(Customer, payload.customer_id)
        if not cust:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found.")
        call.customer_id = cust.id
        call.customer_name_snapshot = cust.full_name
        call.customer_phone_snapshot = cust.phone_number
    if payload.customer_name is not None:
        call.customer_name_snapshot = payload.customer_name.strip() or None
    if payload.customer_phone is not None:
        call.customer_phone_snapshot = payload.customer_phone.strip() or None
    if payload.call_direction is not None:
        call.call_direction = payload.call_direction
    if payload.attendance_status is not None:
        call.attendance_status = payload.attendance_status
    if payload.registration_status is not None:
        call.registration_status = payload.registration_status
    if payload.outcome_code is not None:
        if payload.outcome_code == "":
            call.outcome_id = None
        else:
            outcome = db.scalar(select(CallOutcome).where(CallOutcome.code == payload.outcome_code))
            if not outcome:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid outcome_code.")
            call.outcome_id = outcome.id
    if payload.outcome_notes is not None:
        call.outcome_notes = payload.outcome_notes
    if payload.summary is not None:
        call.summary = payload.summary
    if payload.detected_language is not None:
        call.detected_language = payload.detected_language
    if payload.ended_at is not None:
        call.ended_at = payload.ended_at

    write_audit_log(
        db,
        action="call.updated",
        entity_type="call",
        entity_id=call.id,
        actor_user_id=ctx.user.id,
        actor_email=ctx.user.email,
        details={"registration_status": call.registration_status, "outcome_id": call.outcome_id},
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return get_call_detail(call.id, ctx, db)


@router.post("/calls/{call_id}/transcript", response_model=TranscriptOut)
def save_call_transcript(
    call_id: int,
    payload: TranscriptSaveIn,
    request: Request,
    ctx: AuthContext = Depends(require_permissions("calls:update_own", "calls:update_branch", "calls:create")),
    db: Session = Depends(get_db),
) -> TranscriptOut:
    """Save or update text-only transcript and timestamped segments (zero audio stored)."""
    call = db.get(Call, call_id)
    if not call:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found.")
    _assert_can_view_call(ctx, call)

    tr = db.scalar(select(CallTranscript).where(CallTranscript.call_id == call.id))
    full_text = (
        payload.full_text
        if payload.full_text is not None
        else "\n".join(seg.text.strip() for seg in payload.segments if seg.text.strip())
    )
    if not tr:
        tr = CallTranscript(
            call_id=call.id,
            full_text=full_text,
            language_detected=payload.language_detected,
            model_used=payload.model_used or "faster-whisper-base-cpu-int8",
            average_confidence=payload.average_confidence,
            review_status=payload.review_status,
            ai_extraction_json=payload.ai_extraction_json,
        )
        db.add(tr)
        db.flush()
    else:
        tr.full_text = full_text
        if payload.language_detected is not None:
            tr.language_detected = payload.language_detected
        if payload.model_used is not None:
            tr.model_used = payload.model_used
        if payload.average_confidence is not None:
            tr.average_confidence = payload.average_confidence
        tr.review_status = payload.review_status
        if payload.ai_extraction_json is not None:
            tr.ai_extraction_json = payload.ai_extraction_json

    if payload.language_detected:
        call.detected_language = payload.language_detected

    # Replace segments cleanly inside transaction
    db.query(TranscriptSegment).filter(TranscriptSegment.transcript_id == tr.id).delete()
    db.query(Speaker).filter(Speaker.transcript_id == tr.id).delete()
    db.flush()

    speaker_map: dict[str, Speaker] = {}
    for seg in payload.segments:
        label = seg.speaker_label.strip() or "Unknown speaker"
        if label not in speaker_map:
            sp = Speaker(transcript_id=tr.id, speaker_label=label, identity_status="unverified")
            db.add(sp)
            db.flush()
            speaker_map[label] = sp
        db.add(
            TranscriptSegment(
                transcript_id=tr.id,
                speaker_id=speaker_map[label].id,
                speaker_label=label,
                sequence_index=seg.sequence_index,
                start_seconds=seg.start_seconds,
                end_seconds=seg.end_seconds,
                text=seg.text.strip(),
                language=seg.language or payload.language_detected,
                confidence=seg.confidence,
                is_edited=seg.is_edited,
            )
        )

    write_audit_log(
        db,
        action="call.transcript_saved",
        entity_type="call_transcript",
        entity_id=tr.id,
        actor_user_id=ctx.user.id,
        actor_email=ctx.user.email,
        details={"call_id": call.id, "segment_count": len(payload.segments), "review_status": tr.review_status},
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    db.expire_all()

    refreshed = (
        db.scalars(
            select(CallTranscript)
            .options(joinedload(CallTranscript.segments))
            .where(CallTranscript.id == tr.id)
        )
        .unique()
        .first()
    )
    assert refreshed is not None
    return _serialize_transcript(refreshed)
