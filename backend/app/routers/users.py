"""System Administration: User, Role, and Permission Management."""

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.audit import write_audit_log
from app.core.database import get_db
from app.core.rbac import (
    AuthContext,
    load_user_with_rbac,
    require_permissions,
    resolve_auth_context,
)
from app.core.security import hash_password
from app.models.identity import (
    Employee,
    Permission,
    Role,
    RolePermission,
    User,
    UserRole,
)
from app.models.organization import Branch, Zone
from app.routers.auth import build_user_summary
from app.schemas.auth import (
    PermissionOut,
    RoleOut,
    RolePermissionsUpdateIn,
    UserCreateIn,
    UserSummary,
    UserUpdateIn,
)

router = APIRouter(prefix="/api", tags=["Users & RBAC"])


@router.get("/users", response_model=list[UserSummary])
def list_users(
    search: str | None = Query(default=None),
    role: str | None = Query(default=None),
    branch_id: int | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    _ctx: AuthContext = Depends(require_permissions("admin:users")),
    db: Session = Depends(get_db),
) -> list[UserSummary]:
    stmt = (
        select(User)
        .options(
            joinedload(User.employee_profile),
            joinedload(User.branch),
            joinedload(User.zone),
            joinedload(User.user_roles)
            .joinedload(UserRole.role)
            .joinedload(Role.role_permissions)
            .joinedload(RolePermission.permission),
        )
        .order_by(User.created_at.desc())
    )
    users = db.scalars(stmt).unique().all()
    results: list[UserSummary] = []
    for u in users:
        uctx = resolve_auth_context(db, u)
        if is_active is not None and u.is_active != is_active:
            continue
        if branch_id is not None and u.branch_id != branch_id:
            continue
        if role and role not in uctx.roles:
            continue
        if search:
            s = search.lower()
            if s not in u.full_name.lower() and s not in u.email.lower():
                continue
        results.append(build_user_summary(uctx))
    return results


@router.post("/users", response_model=UserSummary, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreateIn,
    request: Request,
    ctx: AuthContext = Depends(require_permissions("admin:users")),
    db: Session = Depends(get_db),
) -> UserSummary:
    email_norm = payload.email.strip().lower()
    if db.scalar(select(User.id).where(User.email == email_norm)) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A user with this email already exists.")

    if payload.branch_id is not None and db.get(Branch, payload.branch_id) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Specified branch does not exist.")
    if payload.zone_id is not None and db.get(Zone, payload.zone_id) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Specified zone does not exist.")

    roles = db.scalars(select(Role).where(Role.code.in_(payload.role_codes))).all()
    if len(roles) != len(set(payload.role_codes)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="One or more role codes are invalid.")

    # Auto-derive zone_id from branch if not explicitly given
    zone_id = payload.zone_id
    if zone_id is None and payload.branch_id is not None:
        br = db.get(Branch, payload.branch_id)
        if br:
            zone_id = br.zone_id

    user = User(
        email=email_norm,
        full_name=payload.full_name.strip(),
        phone=payload.phone.strip() if payload.phone else None,
        password_hash=hash_password(payload.password),
        is_active=payload.is_active,
        branch_id=payload.branch_id,
        zone_id=zone_id,
    )
    db.add(user)
    db.flush()

    for r in roles:
        db.add(UserRole(user_id=user.id, role_id=r.id))

    # Create employee profile for operational users (or when employee_code is provided)
    role_code_set = {r.code for r in roles}
    if payload.employee_code or role_code_set.intersection({"pharmacist", "branch_manager", "zonal_manager"}):
        emp_code = (payload.employee_code or f"EMP-{user.id:04d}").strip().upper()
        if db.scalar(select(Employee.id).where(Employee.employee_code == emp_code)) is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail=f"Employee code '{emp_code}' already exists."
            )
        designation = payload.designation or (
            "Branch Manager"
            if "branch_manager" in role_code_set
            else ("Zonal Manager" if "zonal_manager" in role_code_set else "Pharmacist")
        )
        db.add(
            Employee(
                user_id=user.id,
                employee_code=emp_code,
                branch_id=payload.branch_id,
                designation=designation,
                is_active=payload.is_active,
            )
        )

    write_audit_log(
        db,
        action="admin.user_created",
        entity_type="user",
        entity_id=user.id,
        actor_user_id=ctx.user.id,
        actor_email=ctx.user.email,
        details={"email": user.email, "roles": sorted(role_code_set), "branch_id": user.branch_id, "zone_id": user.zone_id},
        ip_address=request.client.host if request.client else None,
    )
    db.commit()

    loaded = load_user_with_rbac(db, user.id)
    assert loaded is not None
    return build_user_summary(resolve_auth_context(db, loaded))


@router.patch("/users/{user_id}", response_model=UserSummary)
def update_user(
    user_id: int,
    payload: UserUpdateIn,
    request: Request,
    ctx: AuthContext = Depends(require_permissions("admin:users")),
    db: Session = Depends(get_db),
) -> UserSummary:
    user = load_user_with_rbac(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    changes: dict[str, object] = {}
    if payload.full_name is not None:
        user.full_name = payload.full_name.strip()
        changes["full_name"] = user.full_name
    if payload.phone is not None:
        user.phone = payload.phone.strip() or None
        changes["phone"] = user.phone
    if payload.is_active is not None:
        if user.id == ctx.user.id and not payload.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot deactivate your own active administrator account.",
            )
        user.is_active = payload.is_active
        if user.employee_profile:
            user.employee_profile.is_active = payload.is_active
        changes["is_active"] = user.is_active
    if payload.branch_id is not None:
        if payload.branch_id == 0:
            user.branch_id = None
            if user.employee_profile:
                user.employee_profile.branch_id = None
        else:
            br = db.get(Branch, payload.branch_id)
            if not br:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Branch not found.")
            user.branch_id = br.id
            if payload.zone_id is None:
                user.zone_id = br.zone_id
            if user.employee_profile:
                user.employee_profile.branch_id = br.id
        changes["branch_id"] = user.branch_id
    if payload.zone_id is not None:
        if payload.zone_id == 0:
            user.zone_id = None
        else:
            if not db.get(Zone, payload.zone_id):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Zone not found.")
            user.zone_id = payload.zone_id
        changes["zone_id"] = user.zone_id
    if payload.designation is not None and user.employee_profile:
        user.employee_profile.designation = payload.designation.strip()
        changes["designation"] = user.employee_profile.designation
    if payload.reset_password:
        user.password_hash = hash_password(payload.reset_password)
        changes["password_reset_by_admin"] = True

    if payload.role_codes is not None:
        if user.id == ctx.user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot modify your own assigned roles.",
            )
        if not payload.role_codes:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User must have at least one role.")
        roles = db.scalars(select(Role).where(Role.code.in_(payload.role_codes))).all()
        if len(roles) != len(set(payload.role_codes)):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role code provided.")
        db.query(UserRole).filter(UserRole.user_id == user.id).delete()
        db.flush()
        for r in roles:
            db.add(UserRole(user_id=user.id, role_id=r.id))
        changes["role_codes"] = sorted({r.code for r in roles})

        # Ensure employee profile exists if assigned an operational role
        if not user.employee_profile and {r.code for r in roles}.intersection(
            {"pharmacist", "branch_manager", "zonal_manager"}
        ):
            db.add(
                Employee(
                    user_id=user.id,
                    employee_code=f"EMP-{user.id:04d}",
                    branch_id=user.branch_id,
                    designation=payload.designation or "Pharmacist",
                    is_active=user.is_active,
                )
            )

    write_audit_log(
        db,
        action="admin.user_updated",
        entity_type="user",
        entity_id=user.id,
        actor_user_id=ctx.user.id,
        actor_email=ctx.user.email,
        details=changes,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()

    refreshed = load_user_with_rbac(db, user.id)
    assert refreshed is not None
    return build_user_summary(resolve_auth_context(db, refreshed))


@router.get("/roles", response_model=list[RoleOut])
def list_roles(
    _ctx: AuthContext = Depends(require_permissions("admin:roles", "admin:users")),
    db: Session = Depends(get_db),
) -> list[RoleOut]:
    roles = (
        db.scalars(
            select(Role)
            .options(joinedload(Role.role_permissions).joinedload(RolePermission.permission))
            .order_by(Role.hierarchy_level.asc())
        )
        .unique()
        .all()
    )
    return [
        RoleOut(
            id=r.id,
            code=r.code,
            name=r.name,
            description=r.description,
            hierarchy_level=r.hierarchy_level,
            permissions=sorted(rp.permission.code for rp in r.role_permissions if rp.permission),
        )
        for r in roles
    ]


@router.get("/permissions", response_model=list[PermissionOut])
def list_permissions(
    _ctx: AuthContext = Depends(require_permissions("admin:roles")),
    db: Session = Depends(get_db),
) -> list[PermissionOut]:
    perms = db.scalars(select(Permission).order_by(Permission.module.asc(), Permission.code.asc())).all()
    return [PermissionOut(id=p.id, code=p.code, module=p.module, description=p.description) for p in perms]


@router.put("/roles/{role_id}/permissions", response_model=RoleOut)
def update_role_permissions(
    role_id: int,
    payload: RolePermissionsUpdateIn,
    request: Request,
    ctx: AuthContext = Depends(require_permissions("admin:roles")),
    db: Session = Depends(get_db),
) -> RoleOut:
    role = db.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found.")

    if role.code == "system_admin" and "admin:roles" not in set(payload.permission_codes):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot revoke 'admin:roles' from the system_admin role (prevents administrative lockout).",
        )

    perms = db.scalars(select(Permission).where(Permission.code.in_(payload.permission_codes))).all()
    if len(perms) != len(set(payload.permission_codes)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown permission code supplied.")

    db.query(RolePermission).filter(RolePermission.role_id == role.id).delete()
    db.flush()
    for p in perms:
        db.add(RolePermission(role_id=role.id, permission_id=p.id))

    write_audit_log(
        db,
        action="admin.role_permissions_updated",
        entity_type="role",
        entity_id=role.id,
        actor_user_id=ctx.user.id,
        actor_email=ctx.user.email,
        details={"role_code": role.code, "permissions": sorted(p.code for p in perms)},
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return RoleOut(
        id=role.id,
        code=role.code,
        name=role.name,
        description=role.description,
        hierarchy_level=role.hierarchy_level,
        permissions=sorted(p.code for p in perms),
    )
