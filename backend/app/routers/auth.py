"""Authentication, session revocation, password change, and password reset endpoints."""

import hashlib
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import write_audit_log
from app.core.config import get_settings
from app.core.database import get_db
from app.core.rbac import (
    AuthContext,
    get_current_user,
    load_user_with_rbac,
    resolve_auth_context,
)
from app.core.security import (
    create_access_token,
    generate_reset_token,
    hash_password,
    verify_password,
)
from app.models.identity import PasswordResetToken, RevokedToken, User
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    LoginResponse,
    PasswordResetConfirmIn,
    PasswordResetRequestIn,
    UserSummary,
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


def build_user_summary(ctx: AuthContext) -> UserSummary:
    user = ctx.user
    return UserSummary(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        phone=user.phone,
        is_active=user.is_active,
        must_change_password=user.must_change_password,
        roles=sorted(ctx.roles),
        permissions=sorted(ctx.permissions),
        primary_role=ctx.primary_role,
        scope_level=ctx.scope_level,
        branch_id=user.branch_id,
        branch_name=user.branch.name if user.branch else None,
        zone_id=user.zone_id,
        zone_name=user.zone.name if user.zone else None,
        employee_id=ctx.employee_id,
        employee_code=user.employee_profile.employee_code if user.employee_profile else None,
        allowed_branch_ids=sorted(ctx.allowed_branch_ids),
        allowed_zone_ids=sorted(ctx.allowed_zone_ids),
        last_login_at=user.last_login_at,
        created_at=user.created_at,
    )


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)) -> LoginResponse:
    email_norm = payload.email.strip().lower()
    user_id = db.scalar(select(User.id).where(User.email == email_norm))
    ip_addr = request.client.host if request.client else None

    if user_id is None:
        write_audit_log(
            db,
            action="auth.login_failed",
            entity_type="user",
            actor_email=email_norm,
            details={"reason": "user_not_found"},
            ip_address=ip_addr,
        )
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    user = load_user_with_rbac(db, user_id)
    if not user or not verify_password(payload.password, user.password_hash):
        write_audit_log(
            db,
            action="auth.login_failed",
            entity_type="user",
            entity_id=user_id,
            actor_user_id=user_id,
            actor_email=email_norm,
            details={"reason": "invalid_password"},
            ip_address=ip_addr,
        )
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    if not user.is_active:
        write_audit_log(
            db,
            action="auth.login_blocked_inactive",
            entity_type="user",
            entity_id=user.id,
            actor_user_id=user.id,
            actor_email=user.email,
            ip_address=ip_addr,
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Please contact your System Administrator.",
        )

    user.last_login_at = datetime.now(UTC)
    ctx = resolve_auth_context(db, user)
    token, jti, expires_at = create_access_token(
        subject=str(user.id),
        roles=sorted(ctx.roles),
        extra_claims={"primary_role": ctx.primary_role, "scope_level": ctx.scope_level},
    )
    ctx.token_jti = jti
    ctx.token_exp = expires_at

    write_audit_log(
        db,
        action="auth.login_success",
        entity_type="user",
        entity_id=user.id,
        actor_user_id=user.id,
        actor_email=user.email,
        details={"roles": sorted(ctx.roles), "scope_level": ctx.scope_level},
        ip_address=ip_addr,
    )
    db.commit()

    return LoginResponse(access_token=token, expires_at=expires_at, user=build_user_summary(ctx))


@router.post("/logout")
def logout(
    request: Request,
    ctx: AuthContext = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    if ctx.token_jti:
        existing = db.scalar(select(RevokedToken.id).where(RevokedToken.jti == ctx.token_jti))
        if existing is None:
            db.add(
                RevokedToken(
                    jti=ctx.token_jti,
                    expires_at=ctx.token_exp or (datetime.now(UTC) + timedelta(hours=8)),
                )
            )
    write_audit_log(
        db,
        action="auth.logout",
        entity_type="user",
        entity_id=ctx.user.id,
        actor_user_id=ctx.user.id,
        actor_email=ctx.user.email,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return {"message": "Logged out successfully."}


@router.get("/me", response_model=UserSummary)
def get_me(ctx: AuthContext = Depends(get_current_user)) -> UserSummary:
    return build_user_summary(ctx)


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    ctx: AuthContext = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    user = db.get(User, ctx.user.id)
    if not user or not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect.")

    user.password_hash = hash_password(payload.new_password)
    user.must_change_password = False
    write_audit_log(
        db,
        action="auth.password_changed",
        entity_type="user",
        entity_id=user.id,
        actor_user_id=user.id,
        actor_email=user.email,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return {"message": "Password updated successfully."}


@router.post("/password-reset/request")
def request_password_reset(
    payload: PasswordResetRequestIn,
    request: Request,
    db: Session = Depends(get_db),
) -> dict[str, str | None]:
    """Generate a single-use password reset token.

    In local development mode (APP_ENV=development), returns `dev_reset_token` because no external SMTP server
    is configured yet. In production, the token would only be delivered via an authorized mail relay.
    """
    settings = get_settings()
    email_norm = payload.email.strip().lower()
    user = db.scalar(select(User).where(User.email == email_norm, User.is_active.is_(True)))
    dev_token: str | None = None

    if user:
        raw_token = generate_reset_token()
        token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
        db.add(
            PasswordResetToken(
                user_id=user.id,
                token_hash=token_hash,
                expires_at=datetime.now(UTC) + timedelta(minutes=30),
            )
        )
        write_audit_log(
            db,
            action="auth.password_reset_requested",
            entity_type="user",
            entity_id=user.id,
            actor_user_id=user.id,
            actor_email=user.email,
            ip_address=request.client.host if request.client else None,
        )
        db.commit()
        if settings.app_env == "development":
            dev_token = raw_token

    resp: dict[str, str | None] = {
        "message": "If an active account exists for that email, a password reset token has been generated."
    }
    if dev_token is not None:
        resp["dev_reset_token"] = dev_token
    return resp


@router.post("/password-reset/confirm")
def confirm_password_reset(
    payload: PasswordResetConfirmIn,
    request: Request,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    token_hash = hashlib.sha256(payload.token.encode("utf-8")).hexdigest()
    record = db.scalar(select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash))
    now = datetime.now(UTC)

    if not record or record.used_at is not None or record.expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password reset token is invalid or has expired.",
        )

    user = db.get(User, record.user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Account is not eligible for reset.")

    user.password_hash = hash_password(payload.new_password)
    user.must_change_password = False
    record.used_at = now
    write_audit_log(
        db,
        action="auth.password_reset_completed",
        entity_type="user",
        entity_id=user.id,
        actor_user_id=user.id,
        actor_email=user.email,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return {"message": "Password has been reset. You may now sign in with your new password."}
