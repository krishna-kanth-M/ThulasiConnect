"""Customer directory endpoints (branch-scoped with data minimization)."""

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.audit import write_audit_log
from app.core.database import get_db
from app.core.rbac import AuthContext, require_permissions
from app.models.operations import Call, Customer
from app.schemas.operations import CustomerCreateIn, CustomerOut, CustomerUpdateIn

router = APIRouter(prefix="/api/customers", tags=["Customers"])


def _customer_out(db: Session, c: Customer) -> CustomerOut:
    cnt = db.scalar(select(func.count(Call.id)).where(Call.customer_id == c.id)) or 0
    return CustomerOut(
        id=c.id,
        branch_id=c.branch_id,
        full_name=c.full_name,
        phone_number=c.phone_number,
        preferred_language=c.preferred_language,
        notes=c.notes,
        call_count=cnt,
        created_at=c.created_at,
    )


@router.get("", response_model=list[CustomerOut])
def list_customers(
    search: str | None = Query(default=None),
    branch_id: int | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    ctx: AuthContext = Depends(require_permissions("customers:read")),
    db: Session = Depends(get_db),
) -> list[CustomerOut]:
    stmt = select(Customer).order_by(Customer.updated_at.desc())
    if ctx.scope_level != "org":
        if not ctx.allowed_branch_ids:
            return []
        stmt = stmt.where(Customer.branch_id.in_(ctx.allowed_branch_ids))
    if branch_id is not None:
        if not ctx.can_access_branch(branch_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Branch access denied.")
        stmt = stmt.where(Customer.branch_id == branch_id)
    if search:
        q = f"%{search.strip()}%"
        stmt = stmt.where(or_(Customer.full_name.ilike(q), Customer.phone_number.ilike(q)))

    rows = db.scalars(stmt.limit(limit)).all()
    return [_customer_out(db, c) for c in rows]


@router.post("", response_model=CustomerOut, status_code=status.HTTP_201_CREATED)
def create_customer(
    payload: CustomerCreateIn,
    request: Request,
    ctx: AuthContext = Depends(require_permissions("customers:write")),
    db: Session = Depends(get_db),
) -> CustomerOut:
    target_branch_id = payload.branch_id or ctx.user.branch_id or (next(iter(ctx.allowed_branch_ids), None))
    if target_branch_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Branch is required for customer record.")
    if not ctx.can_access_branch(target_branch_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot create customer in unauthorized branch.")

    # Reuse existing customer with same phone in same branch if present to prevent unnecessary duplication
    phone_clean = payload.phone_number.strip()
    existing = db.scalar(
        select(Customer).where(Customer.branch_id == target_branch_id, Customer.phone_number == phone_clean)
    )
    if existing:
        existing.full_name = payload.full_name.strip()
        existing.preferred_language = payload.preferred_language
        if payload.notes:
            existing.notes = payload.notes
        db.commit()
        return _customer_out(db, existing)

    cust = Customer(
        branch_id=target_branch_id,
        full_name=payload.full_name.strip(),
        phone_number=phone_clean,
        preferred_language=payload.preferred_language,
        notes=payload.notes,
    )
    db.add(cust)
    db.flush()
    write_audit_log(
        db,
        action="customer.created",
        entity_type="customer",
        entity_id=cust.id,
        actor_user_id=ctx.user.id,
        actor_email=ctx.user.email,
        details={"branch_id": target_branch_id},
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return _customer_out(db, cust)


@router.patch("/{customer_id}", response_model=CustomerOut)
def update_customer(
    customer_id: int,
    payload: CustomerUpdateIn,
    request: Request,
    ctx: AuthContext = Depends(require_permissions("customers:write")),
    db: Session = Depends(get_db),
) -> CustomerOut:
    cust = db.get(Customer, customer_id)
    if not cust:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found.")
    if not ctx.can_access_branch(cust.branch_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    if payload.full_name is not None:
        cust.full_name = payload.full_name.strip()
    if payload.phone_number is not None:
        cust.phone_number = payload.phone_number.strip()
    if payload.preferred_language is not None:
        cust.preferred_language = payload.preferred_language
    if payload.notes is not None:
        cust.notes = payload.notes

    write_audit_log(
        db,
        action="customer.updated",
        entity_type="customer",
        entity_id=cust.id,
        actor_user_id=ctx.user.id,
        actor_email=ctx.user.email,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return _customer_out(db, cust)
