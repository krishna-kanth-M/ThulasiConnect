"""Integrations (ShopAid Read-Only Adapter + CSV Fallback, Telephony Adapter) and Audit Logs."""

import json

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import write_audit_log
from app.core.database import get_db
from app.core.rbac import AuthContext, get_current_user, require_permissions
from app.models.workflow import AuditLog, IntegrationConfig
from app.schemas.workflow import (
    AuditLogOut,
    IntegrationConfigOut,
    IntegrationConfigUpdateIn,
    ShopAidCatalogItemOut,
)
from app.services.shopaid_adapter import (
    ensure_shopaid_config,
    import_shopaid_csv_fallback,
    search_shopaid_reference_catalog,
)
from app.services.telephony_adapter import ensure_telephony_config

router = APIRouter(prefix="/api", tags=["Integrations & Audit"])


def _serialize_integration(cfg: IntegrationConfig) -> IntegrationConfigOut:
    parsed_cfg = {}
    if cfg.config_json:
        try:
            parsed_cfg = json.loads(cfg.config_json)
        except json.JSONDecodeError:
            parsed_cfg = {}
    return IntegrationConfigOut(
        id=cfg.id,
        integration_key=cfg.integration_key,
        display_name=cfg.display_name,
        status=cfg.status,
        mode=cfg.mode,
        endpoint_url=cfg.endpoint_url,
        status_message=cfg.status_message,
        config=parsed_cfg,
        last_synced_at=cfg.last_synced_at,
        updated_at=cfg.updated_at,
    )


NOTIFICATION_CHANNELS_KEY = "notification_channels"


def ensure_notification_channels_config(db: Session) -> IntegrationConfig:
    cfg = db.scalar(select(IntegrationConfig).where(IntegrationConfig.integration_key == NOTIFICATION_CHANNELS_KEY))
    if not cfg:
        cfg = IntegrationConfig(
            integration_key=NOTIFICATION_CHANNELS_KEY,
            display_name="Notification Delivery Channels (In-App / Email / SMS / WhatsApp)",
            status="disconnected",
            mode="read_only",
            endpoint_url=None,
            status_message=(
                "In-App Notifications: CONNECTED AND TESTED. "
                "External Email (SMTP), SMS, and WhatsApp gateways are NOT CONFIGURED (credentials required; no external messages sent)."
            ),
            config_json=json.dumps(
                {
                    "in_app": "CONNECTED AND TESTED",
                    "email_smtp": "NOT CONFIGURED",
                    "sms_gateway": "NOT CONFIGURED",
                    "whatsapp_business": "NOT CONFIGURED",
                }
            ),
        )
        db.add(cfg)
        db.flush()
    return cfg


@router.get("/integrations", response_model=list[IntegrationConfigOut])
def list_integrations(
    _ctx: AuthContext = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[IntegrationConfigOut]:
    shopaid = ensure_shopaid_config(db)
    telephony = ensure_telephony_config(db)
    notif_ch = ensure_notification_channels_config(db)
    db.commit()
    return [
        _serialize_integration(shopaid),
        _serialize_integration(telephony),
        _serialize_integration(notif_ch),
    ]


@router.patch("/integrations/{integration_key}", response_model=IntegrationConfigOut)
def update_integration_config(
    integration_key: str,
    payload: IntegrationConfigUpdateIn,
    request: Request,
    ctx: AuthContext = Depends(require_permissions("admin:integrations")),
    db: Session = Depends(get_db),
) -> IntegrationConfigOut:
    ensure_shopaid_config(db)
    ensure_telephony_config(db)
    ensure_notification_channels_config(db)
    cfg = db.scalar(select(IntegrationConfig).where(IntegrationConfig.integration_key == integration_key))
    if not cfg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Integration not found.")

    if payload.endpoint_url is not None:
        cfg.endpoint_url = payload.endpoint_url.strip() or None
        cfg.status = "configured_unverified" if cfg.endpoint_url else "disconnected"
    if payload.mode is not None:
        cfg.mode = payload.mode
    if payload.status_message is not None:
        cfg.status_message = payload.status_message
    if payload.config is not None:
        # Enforce read-only invariant on ShopAid
        if integration_key == "shopaid_inventory":
            payload.config["read_only_enforced"] = True
            payload.config["write_operations_allowed"] = False
        cfg.config_json = json.dumps(payload.config)

    cfg.updated_by_user_id = ctx.user.id
    write_audit_log(
        db,
        action="admin.integration_updated",
        entity_type="integration_config",
        entity_id=cfg.integration_key,
        actor_user_id=ctx.user.id,
        actor_email=ctx.user.email,
        details={"status": cfg.status, "mode": cfg.mode, "endpoint_url": cfg.endpoint_url},
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return _serialize_integration(cfg)


@router.post("/integrations/shopaid/import-csv")
async def import_shopaid_csv(
    request: Request,
    file: UploadFile = File(...),
    ctx: AuthContext = Depends(require_permissions("admin:integrations")),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    raw_bytes = await file.read()
    try:
        csv_text = raw_bytes.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CSV must be UTF-8 encoded.") from exc

    try:
        summary = import_shopaid_csv_fallback(
            db,
            csv_text,
            filename=file.filename or "upload.csv",
            actor_user_id=ctx.user.id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    write_audit_log(
        db,
        action="integration.shopaid_csv_imported",
        entity_type="shopaid_catalog",
        actor_user_id=ctx.user.id,
        actor_email=ctx.user.email,
        details=summary,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return summary


@router.get("/integrations/shopaid/catalog", response_model=list[ShopAidCatalogItemOut])
def search_shopaid_catalog(
    q: str = Query(default=""),
    limit: int = Query(default=20, ge=1, le=100),
    _ctx: AuthContext = Depends(require_permissions("integrations:lookup_catalog", "admin:integrations")),
    db: Session = Depends(get_db),
) -> list[ShopAidCatalogItemOut]:
    items = search_shopaid_reference_catalog(db, q, limit=limit)
    return [
        ShopAidCatalogItemOut(
            id=i.id,
            sku=i.sku,
            medicine_name=i.medicine_name,
            strength=i.strength,
            dosage_form=i.dosage_form,
            manufacturer=i.manufacturer,
            mrp_price=i.mrp_price,
            stock_status_snapshot=i.stock_status_snapshot,
            source_label=i.source_label,
            imported_at=i.imported_at,
        )
        for i in items
    ]


@router.get("/audit-logs", response_model=list[AuditLogOut])
def list_audit_logs(
    action: str | None = Query(default=None),
    entity_type: str | None = Query(default=None),
    actor_email: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    _ctx: AuthContext = Depends(require_permissions("admin:audit_logs")),
    db: Session = Depends(get_db),
) -> list[AuditLogOut]:
    stmt = select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
    if action:
        stmt = stmt.where(AuditLog.action.ilike(f"%{action.strip()}%"))
    if entity_type:
        stmt = stmt.where(AuditLog.entity_type == entity_type)
    if actor_email:
        stmt = stmt.where(AuditLog.actor_email.ilike(f"%{actor_email.strip()}%"))

    rows = db.scalars(stmt).all()
    out: list[AuditLogOut] = []
    for r in rows:
        parsed = None
        if r.details_json:
            try:
                parsed = json.loads(r.details_json)
            except json.JSONDecodeError:
                parsed = {"raw": r.details_json}
        out.append(
            AuditLogOut(
                id=r.id,
                actor_user_id=r.actor_user_id,
                actor_email=r.actor_email,
                action=r.action,
                entity_type=r.entity_type,
                entity_id=r.entity_id,
                details=parsed,
                ip_address=r.ip_address,
                created_at=r.created_at,
            )
        )
    return out
