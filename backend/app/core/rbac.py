"""Role-Based Access Control (RBAC), scope resolution, and FastAPI dependencies."""

from dataclasses import dataclass, field
from datetime import UTC, datetime

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.identity import (
    Permission,
    RevokedToken,
    Role,
    RolePermission,
    User,
    UserRole,
)
from app.models.organization import Branch, Zone

ROLE_PHARMACIST = "pharmacist"
ROLE_BRANCH_MANAGER = "branch_manager"
ROLE_ZONAL_MANAGER = "zonal_manager"
ROLE_OWNER = "owner"
ROLE_SYSTEM_ADMIN = "system_admin"

ROLE_DEFINITIONS: dict[str, dict[str, object]] = {
    ROLE_PHARMACIST: {
        "name": "Pharmacist / Employee",
        "description": "Branch-level call desk operator managing assigned calls, requests, and follow-ups.",
        "hierarchy_level": 1,
        "permissions": [
            "dashboard:view",
            "live_call:use",
            "calls:read_own",
            "calls:create",
            "calls:update_own",
            "customers:read",
            "customers:write",
            "requests:read_own",
            "requests:create",
            "requests:update_own",
            "followups:read_own",
            "followups:create",
            "followups:update_own",
            "performance:read_own",
            "notifications:read",
            "integrations:lookup_catalog",
        ],
    },
    ROLE_BRANCH_MANAGER: {
        "name": "Branch Manager",
        "description": "Supervises assigned branch calls, employees, escalations, and branch reports.",
        "hierarchy_level": 2,
        "permissions": [
            "dashboard:view",
            "live_call:use",
            "calls:read_branch",
            "calls:create",
            "calls:update_branch",
            "customers:read",
            "customers:write",
            "requests:read_branch",
            "requests:create",
            "requests:update_branch",
            "requests:assign_branch",
            "followups:read_branch",
            "followups:create",
            "followups:update_branch",
            "escalations:read_branch",
            "escalations:manage_branch",
            "performance:read_branch",
            "branches:read",
            "branches:manage_settings",
            "reports:branch",
            "notifications:read",
            "integrations:lookup_catalog",
        ],
    },
    ROLE_ZONAL_MANAGER: {
        "name": "Zonal Manager",
        "description": "Monitors authorized zone branches, escalations, and zonal performance comparisons.",
        "hierarchy_level": 3,
        "permissions": [
            "dashboard:view",
            "calls:read_zone",
            "customers:read",
            "requests:read_zone",
            "followups:read_zone",
            "escalations:read_zone",
            "escalations:manage_zone",
            "performance:read_zone",
            "branches:read",
            "zones:read",
            "reports:zone",
            "notifications:read",
        ],
    },
    ROLE_OWNER: {
        "name": "Owner",
        "description": "Organization-wide executive visibility across all zones, branches, and critical escalations.",
        "hierarchy_level": 4,
        "permissions": [
            "dashboard:view",
            "calls:read_org",
            "customers:read",
            "requests:read_org",
            "followups:read_org",
            "escalations:read_org",
            "escalations:manage_org",
            "performance:read_org",
            "branches:read",
            "zones:read",
            "reports:org",
            "notifications:read",
        ],
    },
    ROLE_SYSTEM_ADMIN: {
        "name": "System Administrator",
        "description": "Manages user accounts, roles, branches, zones, integrations, settings, and audit logs.",
        "hierarchy_level": 5,
        "permissions": [
            "dashboard:view",
            "admin:users",
            "admin:roles",
            "admin:branches",
            "admin:zones",
            "admin:settings",
            "admin:integrations",
            "admin:audit_logs",
            "branches:read",
            "zones:read",
            "notifications:read",
            "escalations:read_org",
            "reports:org",
            "calls:read_org",
            "requests:read_org",
            "followups:read_org",
            "performance:read_org",
            "customers:read",
            "integrations:lookup_catalog",
        ],
    },
}

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass
class AuthContext:
    user: User
    roles: set[str]
    permissions: set[str]
    employee_id: int | None
    primary_role: str
    scope_level: str  # "org" | "zone" | "branch" | "self"
    allowed_branch_ids: set[int] = field(default_factory=set)
    allowed_zone_ids: set[int] = field(default_factory=set)
    token_jti: str = ""
    token_exp: datetime | None = None

    def has_role(self, *role_codes: str) -> bool:
        return bool(self.roles.intersection(role_codes))

    def has_permission(self, permission_code: str) -> bool:
        return permission_code in self.permissions

    def can_access_branch(self, branch_id: int | None) -> bool:
        if self.scope_level == "org":
            return True
        if branch_id is None:
            return False
        return branch_id in self.allowed_branch_ids

    def can_access_zone(self, zone_id: int | None) -> bool:
        if self.scope_level == "org":
            return True
        if zone_id is None:
            return False
        return zone_id in self.allowed_zone_ids


def resolve_auth_context(db: Session, user: User, jti: str = "", exp: datetime | None = None) -> AuthContext:
    roles: set[str] = set()
    permissions: set[str] = set()

    for ur in user.user_roles:
        if ur.role:
            roles.add(ur.role.code)
            for rp in ur.role.role_permissions:
                if rp.permission:
                    permissions.add(rp.permission.code)

    # Determine highest operational scope & primary role
    if ROLE_OWNER in roles:
        scope_level = "org"
        primary_role = ROLE_OWNER
    elif ROLE_SYSTEM_ADMIN in roles:
        scope_level = "org"
        primary_role = ROLE_SYSTEM_ADMIN
    elif ROLE_ZONAL_MANAGER in roles:
        scope_level = "zone"
        primary_role = ROLE_ZONAL_MANAGER
    elif ROLE_BRANCH_MANAGER in roles:
        scope_level = "branch"
        primary_role = ROLE_BRANCH_MANAGER
    else:
        scope_level = "self"
        primary_role = ROLE_PHARMACIST

    allowed_zone_ids: set[int] = set()
    allowed_branch_ids: set[int] = set()

    if scope_level == "org":
        allowed_zone_ids = set(db.scalars(select(Zone.id)).all())
        allowed_branch_ids = set(db.scalars(select(Branch.id)).all())
    elif scope_level == "zone":
        if user.zone_id:
            allowed_zone_ids.add(user.zone_id)
        managed_zones = db.scalars(select(Zone.id).where(Zone.zonal_manager_user_id == user.id)).all()
        allowed_zone_ids.update(managed_zones)
        if allowed_zone_ids:
            zone_branches = db.scalars(select(Branch.id).where(Branch.zone_id.in_(allowed_zone_ids))).all()
            allowed_branch_ids.update(zone_branches)
    elif scope_level == "branch":
        if user.branch_id:
            allowed_branch_ids.add(user.branch_id)
        managed_branches = db.scalars(select(Branch.id).where(Branch.branch_manager_user_id == user.id)).all()
        allowed_branch_ids.update(managed_branches)
        if allowed_branch_ids:
            z_ids = db.scalars(select(Branch.zone_id).where(Branch.id.in_(allowed_branch_ids))).all()
            allowed_zone_ids.update(z_ids)
    else:
        if user.branch_id:
            allowed_branch_ids.add(user.branch_id)
        if user.employee_profile and user.employee_profile.branch_id:
            allowed_branch_ids.add(user.employee_profile.branch_id)
        if allowed_branch_ids:
            z_ids = db.scalars(select(Branch.zone_id).where(Branch.id.in_(allowed_branch_ids))).all()
            allowed_zone_ids.update(z_ids)

    employee_id = user.employee_profile.id if user.employee_profile else None

    return AuthContext(
        user=user,
        roles=roles,
        permissions=permissions,
        employee_id=employee_id,
        primary_role=primary_role,
        scope_level=scope_level,
        allowed_branch_ids=allowed_branch_ids,
        allowed_zone_ids=allowed_zone_ids,
        token_jti=jti,
        token_exp=exp,
    )


def load_user_with_rbac(db: Session, user_id: int) -> User | None:
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
        .where(User.id == user_id)
    )
    return db.scalars(stmt).unique().first()


def authenticate_token(db: Session, token: str) -> AuthContext:
    try:
        payload = decode_access_token(token)
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
        ) from exc

    sub = payload.get("sub")
    jti = payload.get("jti", "")
    exp_ts = payload.get("exp")
    if not sub:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject.")

    if jti:
        revoked = db.scalar(select(RevokedToken.id).where(RevokedToken.jti == jti))
        if revoked is not None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session has been logged out. Please sign in again.",
            )

    user = load_user_with_rbac(db, int(sub))
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is inactive or no longer exists.",
        )

    exp_dt = datetime.fromtimestamp(exp_ts, tz=UTC) if exp_ts else None
    return resolve_auth_context(db, user, jti=jti, exp=exp_dt)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> AuthContext:
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )
    return authenticate_token(db, credentials.credentials)


def require_permissions(*required: str):
    def _checker(ctx: AuthContext = Depends(get_current_user)) -> AuthContext:
        if not any(ctx.has_permission(p) for p in required):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required one of: {', '.join(required)}.",
            )
        return ctx

    return _checker


def require_roles(*required_roles: str):
    def _checker(ctx: AuthContext = Depends(get_current_user)) -> AuthContext:
        if not ctx.has_role(*required_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have the required role for this action.",
            )
        return ctx

    return _checker


def ensure_roles_and_permissions_seeded(db: Session) -> None:
    """Idempotently seed standard roles, permissions, and mappings."""
    all_perm_codes: set[str] = set()
    for role_cfg in ROLE_DEFINITIONS.values():
        all_perm_codes.update(role_cfg["permissions"])  # type: ignore[arg-type]

    existing_perms = {p.code: p for p in db.scalars(select(Permission)).all()}
    for code in sorted(all_perm_codes):
        if code not in existing_perms:
            module = code.split(":")[0]
            perm = Permission(code=code, module=module, description=f"Permission to {code.replace(':', ' ')}")
            db.add(perm)
            db.flush()
            existing_perms[code] = perm

    existing_roles = {r.code: r for r in db.scalars(select(Role)).all()}
    for code, cfg in ROLE_DEFINITIONS.items():
        role = existing_roles.get(code)
        is_new_role = False
        if not role:
            role = Role(
                code=code,
                name=str(cfg["name"]),
                description=str(cfg["description"]),
                hierarchy_level=int(cfg["hierarchy_level"]),  # type: ignore[arg-type]
            )
            db.add(role)
            db.flush()
            existing_roles[code] = role
            is_new_role = True

        # Seed default permissions ONLY when a role is newly created so admin revocations persist across restarts
        if is_new_role:
            for pcode in cfg["permissions"]:  # type: ignore[iterable]
                perm = existing_perms[pcode]
                db.add(RolePermission(role_id=role.id, permission_id=perm.id))

    db.flush()
