"""Zones, Branches, and Employees management endpoints with strict RBAC scoping."""

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.core.audit import write_audit_log
from app.core.database import get_db
from app.core.rbac import AuthContext, get_current_user, require_permissions
from app.models.identity import Employee, User, UserRole
from app.models.organization import Branch, Zone
from app.schemas.organization import (
    BranchCreateIn,
    BranchOut,
    BranchUpdateIn,
    EmployeeOut,
    ZoneCreateIn,
    ZoneOut,
    ZoneUpdateIn,
)

router = APIRouter(prefix="/api", tags=["Organization"])


def _zone_out(db: Session, z: Zone) -> ZoneOut:
    b_count = db.scalar(select(func.count(Branch.id)).where(Branch.zone_id == z.id)) or 0
    return ZoneOut(
        id=z.id,
        code=z.code,
        name=z.name,
        region_description=z.region_description,
        zonal_manager_user_id=z.zonal_manager_user_id,
        zonal_manager_name=z.zonal_manager.full_name if z.zonal_manager else None,
        branch_count=b_count,
        is_active=z.is_active,
        created_at=z.created_at,
    )


def _branch_out(db: Session, b: Branch) -> BranchOut:
    from app.models.identity import Role

    e_count = (
        db.scalar(select(func.count(Employee.id)).where(Employee.branch_id == b.id, Employee.is_active.is_(True)))
        or 0
    )
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
    warnings: list[str] = []
    if b.is_active and ph_count == 0:
        warnings.append("No active pharmacists assigned to this branch.")
    if b.is_active and b.branch_manager_user_id is None:
        warnings.append("No branch manager assigned to this branch.")
    elif b.is_active and b.branch_manager_user_id is not None:
        shared_count = (
            db.scalar(
                select(func.count(Branch.id)).where(
                    Branch.branch_manager_user_id == b.branch_manager_user_id,
                    Branch.is_active.is_(True),
                )
            )
            or 0
        )
        if shared_count > 1:
            warnings.append(
                f"Branch manager is shared across {shared_count} active branches (confirm if intentional)."
            )

    return BranchOut(
        id=b.id,
        zone_id=b.zone_id,
        zone_name=b.zone.name if b.zone else None,
        code=b.code,
        name=b.name,
        city=b.city,
        address=b.address,
        phone_number=b.phone_number,
        branch_manager_user_id=b.branch_manager_user_id,
        branch_manager_name=b.branch_manager.full_name if b.branch_manager else None,
        escalation_overdue_minutes=b.escalation_overdue_minutes,
        operating_hours=b.operating_hours,
        employee_count=e_count,
        pharmacist_count=ph_count,
        warnings=warnings,
        is_active=b.is_active,
        created_at=b.created_at,
    )


@router.get("/zones", response_model=list[ZoneOut])
def list_zones(
    ctx: AuthContext = Depends(require_permissions("zones:read", "admin:zones")),
    db: Session = Depends(get_db),
) -> list[ZoneOut]:
    stmt = select(Zone).options(joinedload(Zone.zonal_manager)).order_by(Zone.name.asc())
    if ctx.scope_level != "org":
        if not ctx.allowed_zone_ids:
            return []
        stmt = stmt.where(Zone.id.in_(ctx.allowed_zone_ids))
    zones = db.scalars(stmt).unique().all()
    return [_zone_out(db, z) for z in zones]


@router.post("/zones", response_model=ZoneOut, status_code=status.HTTP_201_CREATED)
def create_zone(
    payload: ZoneCreateIn,
    request: Request,
    ctx: AuthContext = Depends(require_permissions("admin:zones")),
    db: Session = Depends(get_db),
) -> ZoneOut:
    code_norm = payload.code.strip().upper()
    if db.scalar(select(Zone.id).where(Zone.code == code_norm)) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Zone code '{code_norm}' already exists.")
    if payload.zonal_manager_user_id and db.get(User, payload.zonal_manager_user_id) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Zonal manager user not found.")

    zone = Zone(
        code=code_norm,
        name=payload.name.strip(),
        region_description=payload.region_description,
        zonal_manager_user_id=payload.zonal_manager_user_id,
        is_active=payload.is_active,
    )
    db.add(zone)
    db.flush()
    write_audit_log(
        db,
        action="admin.zone_created",
        entity_type="zone",
        entity_id=zone.id,
        actor_user_id=ctx.user.id,
        actor_email=ctx.user.email,
        details={"code": zone.code, "name": zone.name},
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    loaded = db.scalars(select(Zone).options(joinedload(Zone.zonal_manager)).where(Zone.id == zone.id)).first()
    assert loaded is not None
    return _zone_out(db, loaded)


@router.patch("/zones/{zone_id}", response_model=ZoneOut)
def update_zone(
    zone_id: int,
    payload: ZoneUpdateIn,
    request: Request,
    ctx: AuthContext = Depends(require_permissions("admin:zones")),
    db: Session = Depends(get_db),
) -> ZoneOut:
    zone = db.get(Zone, zone_id)
    if not zone:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Zone not found.")

    if payload.name is not None:
        zone.name = payload.name.strip()
    if payload.region_description is not None:
        zone.region_description = payload.region_description
    if payload.zonal_manager_user_id is not None:
        if payload.zonal_manager_user_id == 0:
            zone.zonal_manager_user_id = None
        else:
            if not db.get(User, payload.zonal_manager_user_id):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Zonal manager user not found.")
            zone.zonal_manager_user_id = payload.zonal_manager_user_id
    if payload.is_active is not None:
        zone.is_active = payload.is_active

    write_audit_log(
        db,
        action="admin.zone_updated",
        entity_type="zone",
        entity_id=zone.id,
        actor_user_id=ctx.user.id,
        actor_email=ctx.user.email,
        details={"name": zone.name, "zonal_manager_user_id": zone.zonal_manager_user_id, "is_active": zone.is_active},
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    loaded = db.scalars(select(Zone).options(joinedload(Zone.zonal_manager)).where(Zone.id == zone.id)).first()
    assert loaded is not None
    return _zone_out(db, loaded)


@router.get("/branches", response_model=list[BranchOut])
def list_branches(
    zone_id: int | None = Query(default=None),
    ctx: AuthContext = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[BranchOut]:
    stmt = (
        select(Branch)
        .options(joinedload(Branch.zone), joinedload(Branch.branch_manager))
        .order_by(Branch.name.asc())
    )
    if ctx.scope_level != "org":
        if not ctx.allowed_branch_ids:
            return []
        stmt = stmt.where(Branch.id.in_(ctx.allowed_branch_ids))
    if zone_id is not None:
        if not ctx.can_access_zone(zone_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access to this zone is not authorized.")
        stmt = stmt.where(Branch.zone_id == zone_id)

    branches = db.scalars(stmt).unique().all()
    return [_branch_out(db, b) for b in branches]


@router.post("/branches", response_model=BranchOut, status_code=status.HTTP_201_CREATED)
def create_branch(
    payload: BranchCreateIn,
    request: Request,
    ctx: AuthContext = Depends(require_permissions("admin:branches")),
    db: Session = Depends(get_db),
) -> BranchOut:
    if not db.get(Zone, payload.zone_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Zone does not exist.")
    code_norm = payload.code.strip().upper()
    if db.scalar(select(Branch.id).where(Branch.code == code_norm)) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Branch code '{code_norm}' already exists.")
    if payload.branch_manager_user_id and not db.get(User, payload.branch_manager_user_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Branch manager user not found.")

    branch = Branch(
        zone_id=payload.zone_id,
        code=code_norm,
        name=payload.name.strip(),
        city=payload.city.strip(),
        address=payload.address,
        phone_number=payload.phone_number,
        branch_manager_user_id=payload.branch_manager_user_id,
        escalation_overdue_minutes=payload.escalation_overdue_minutes,
        operating_hours=payload.operating_hours,
        is_active=payload.is_active,
    )
    db.add(branch)
    db.flush()
    write_audit_log(
        db,
        action="admin.branch_created",
        entity_type="branch",
        entity_id=branch.id,
        actor_user_id=ctx.user.id,
        actor_email=ctx.user.email,
        details={"code": branch.code, "name": branch.name, "zone_id": branch.zone_id},
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    loaded = (
        db.scalars(
            select(Branch)
            .options(joinedload(Branch.zone), joinedload(Branch.branch_manager))
            .where(Branch.id == branch.id)
        )
        .unique()
        .first()
    )
    assert loaded is not None
    return _branch_out(db, loaded)


@router.patch("/branches/{branch_id}", response_model=BranchOut)
def update_branch(
    branch_id: int,
    payload: BranchUpdateIn,
    request: Request,
    ctx: AuthContext = Depends(require_permissions("admin:branches", "branches:manage_settings")),
    db: Session = Depends(get_db),
) -> BranchOut:
    branch = db.get(Branch, branch_id)
    if not branch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Branch not found.")

    is_admin = ctx.has_permission("admin:branches")
    if not is_admin:
        # Branch managers can only modify operational settings of their own branch
        if not ctx.can_access_branch(branch.id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this branch.")
        if payload.zone_id is not None or payload.branch_manager_user_id is not None or payload.is_active is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only System Administrators can change branch zone, manager assignment, or active status.",
            )

    if payload.zone_id is not None:
        if not db.get(Zone, payload.zone_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Zone not found.")
        branch.zone_id = payload.zone_id
    if payload.name is not None and is_admin:
        branch.name = payload.name.strip()
    if payload.city is not None and is_admin:
        branch.city = payload.city.strip()
    if payload.address is not None:
        branch.address = payload.address
    if payload.phone_number is not None:
        branch.phone_number = payload.phone_number
    if payload.branch_manager_user_id is not None:
        if payload.branch_manager_user_id == 0:
            branch.branch_manager_user_id = None
        else:
            if not db.get(User, payload.branch_manager_user_id):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Manager user not found.")
            branch.branch_manager_user_id = payload.branch_manager_user_id
    if payload.escalation_overdue_minutes is not None:
        branch.escalation_overdue_minutes = payload.escalation_overdue_minutes
    if payload.operating_hours is not None:
        branch.operating_hours = payload.operating_hours
    if payload.is_active is not None:
        branch.is_active = payload.is_active

    write_audit_log(
        db,
        action="branch.updated",
        entity_type="branch",
        entity_id=branch.id,
        actor_user_id=ctx.user.id,
        actor_email=ctx.user.email,
        details={
            "escalation_overdue_minutes": branch.escalation_overdue_minutes,
            "operating_hours": branch.operating_hours,
            "branch_manager_user_id": branch.branch_manager_user_id,
        },
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    loaded = (
        db.scalars(
            select(Branch)
            .options(joinedload(Branch.zone), joinedload(Branch.branch_manager))
            .where(Branch.id == branch.id)
        )
        .unique()
        .first()
    )
    assert loaded is not None
    return _branch_out(db, loaded)


@router.get("/employees", response_model=list[EmployeeOut])
def list_employees(
    branch_id: int | None = Query(default=None),
    ctx: AuthContext = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[EmployeeOut]:
    stmt = (
        select(Employee)
        .options(
            joinedload(Employee.user).joinedload(User.user_roles).joinedload(UserRole.role),
            joinedload(Employee.branch).joinedload(Branch.zone),
        )
        .order_by(Employee.employee_code.asc())
    )

    if ctx.scope_level == "self":
        if ctx.employee_id is None:
            return []
        stmt = stmt.where(Employee.id == ctx.employee_id)
    elif ctx.scope_level in ("branch", "zone"):
        if not ctx.allowed_branch_ids:
            return []
        stmt = stmt.where(Employee.branch_id.in_(ctx.allowed_branch_ids))

    if branch_id is not None:
        if not ctx.can_access_branch(branch_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Branch access denied.")
        stmt = stmt.where(Employee.branch_id == branch_id)

    employees = db.scalars(stmt).unique().all()
    return [
        EmployeeOut(
            id=e.id,
            user_id=e.user_id,
            employee_code=e.employee_code,
            full_name=e.user.full_name,
            email=e.user.email,
            phone=e.user.phone,
            designation=e.designation,
            branch_id=e.branch_id,
            branch_name=e.branch.name if e.branch else None,
            zone_id=e.branch.zone_id if e.branch else None,
            zone_name=e.branch.zone.name if (e.branch and e.branch.zone) else None,
            roles=sorted(ur.role.code for ur in e.user.user_roles if ur.role),
            is_active=e.is_active and e.user.is_active,
        )
        for e in employees
    ]
