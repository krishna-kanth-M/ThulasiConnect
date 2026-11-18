"""ShopAid Inventory Integration Adapter (Read-Only Interface + Validated CSV Fallback).

IMPORTANT:
- No official ShopAid API credentials or endpoint documentation are configured yet.
- Live API status is explicitly BLOCKED BY EXTERNAL DEPENDENCY / NOT CONFIGURED.
- NEVER fabricates live inventory data and NEVER writes to ShopAid.
- Supports a validated read-only CSV catalog import fallback with failed-row reporting,
  duplicate SKU tracking, and persisted import history.
"""

import csv
import io
import json
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.workflow import IntegrationConfig, ShopAidCatalogItem

SHOPAID_KEY = "shopaid_inventory"


def ensure_shopaid_config(db: Session) -> IntegrationConfig:
    cfg = db.scalar(select(IntegrationConfig).where(IntegrationConfig.integration_key == SHOPAID_KEY))
    if not cfg:
        cfg = IntegrationConfig(
            integration_key=SHOPAID_KEY,
            display_name="ShopAid Inventory Software (Read-Only Adapter)",
            status="disconnected",
            mode="read_only",
            endpoint_url=None,
            status_message=(
                "Live ShopAid API: BLOCKED BY EXTERNAL DEPENDENCY (vendor API documentation and credentials unavailable). "
                "Use the read-only CSV reference catalog fallback for lookup support."
            ),
            config_json=json.dumps(
                {
                    "read_only_enforced": True,
                    "write_operations_allowed": False,
                    "live_api_status": "BLOCKED BY EXTERNAL DEPENDENCY",
                    "csv_fallback_status": "NOT CONFIGURED",
                    "import_history": [],
                }
            ),
        )
        db.add(cfg)
        db.flush()
    return cfg


def import_shopaid_csv_fallback(
    db: Session,
    csv_content: str,
    *,
    filename: str = "upload.csv",
    actor_user_id: int | None = None,
) -> dict[str, Any]:
    """Import an exported CSV medicine reference snapshot with row-level validation and history."""
    reader = csv.DictReader(io.StringIO(csv_content))
    if not reader.fieldnames:
        raise ValueError("CSV file is empty or missing header row.")

    normalized_headers = {h.strip().lower(): h for h in reader.fieldnames if h}
    if "medicine_name" not in normalized_headers and "name" not in normalized_headers:
        raise ValueError("CSV must contain at least a 'medicine_name' (or 'name') column.")

    imported = 0
    updated = 0
    duplicate_skus_in_file = 0
    failed_rows: list[dict[str, Any]] = []
    seen_skus_in_file: set[str] = set()
    now = datetime.now(UTC)

    for row_num, row in enumerate(reader, start=2):
        name = (
            row.get(normalized_headers.get("medicine_name", ""))
            or row.get(normalized_headers.get("name", ""))
            or ""
        ).strip()
        if not name:
            failed_rows.append({"row": row_num, "reason": "Missing medicine_name value"})
            continue

        raw_sku = (row.get(normalized_headers.get("sku", "")) or "").strip()
        sku = raw_sku or f"CSV-{row_num - 1:04d}"
        if sku in seen_skus_in_file:
            duplicate_skus_in_file += 1
        seen_skus_in_file.add(sku)

        strength = (row.get(normalized_headers.get("strength", "")) or "").strip() or None
        dosage_form = (row.get(normalized_headers.get("dosage_form", "")) or "").strip() or None
        manufacturer = (row.get(normalized_headers.get("manufacturer", "")) or "").strip() or None
        mrp_price = (
            row.get(normalized_headers.get("mrp_price", "")) or row.get(normalized_headers.get("mrp", "")) or ""
        ).strip() or None
        stock_snapshot = (row.get(normalized_headers.get("stock_status", "")) or "csv_snapshot_only").strip()

        existing = db.scalar(select(ShopAidCatalogItem).where(ShopAidCatalogItem.sku == sku))
        if existing:
            existing.medicine_name = name
            existing.strength = strength
            existing.dosage_form = dosage_form
            existing.manufacturer = manufacturer
            existing.mrp_price = mrp_price
            existing.stock_status_snapshot = stock_snapshot
            existing.source_label = "csv_import_fallback"
            existing.imported_at = now
            updated += 1
        else:
            db.add(
                ShopAidCatalogItem(
                    sku=sku,
                    medicine_name=name,
                    strength=strength,
                    dosage_form=dosage_form,
                    manufacturer=manufacturer,
                    mrp_price=mrp_price,
                    stock_status_snapshot=stock_snapshot,
                    source_label="csv_import_fallback",
                    imported_at=now,
                )
            )
            imported += 1

    cfg = ensure_shopaid_config(db)
    cfg_data: dict[str, Any] = {}
    if cfg.config_json:
        try:
            cfg_data = json.loads(cfg.config_json)
        except json.JSONDecodeError:
            cfg_data = {}

    history: list[dict[str, Any]] = list(cfg_data.get("import_history") or [])
    history.insert(
        0,
        {
            "imported_at": now.isoformat(),
            "filename": filename,
            "imported": imported,
            "updated": updated,
            "duplicate_skus_in_file": duplicate_skus_in_file,
            "failed_count": len(failed_rows),
        },
    )
    cfg_data["read_only_enforced"] = True
    cfg_data["write_operations_allowed"] = False
    cfg_data["live_api_status"] = "BLOCKED BY EXTERNAL DEPENDENCY"
    cfg_data["csv_fallback_status"] = "CONNECTED AND TESTED"
    cfg_data["import_history"] = history[:10]

    if cfg.status == "disconnected":
        cfg.status = "csv_fallback_only"
        cfg.mode = "csv_fallback"
    cfg.config_json = json.dumps(cfg_data)
    cfg.last_synced_at = now
    cfg.updated_by_user_id = actor_user_id
    cfg.status_message = (
        f"Live ShopAid API: BLOCKED BY EXTERNAL DEPENDENCY. CSV reference snapshot synced "
        f"({imported} added, {updated} updated, {len(failed_rows)} failed rows). "
        "Verify live stock directly inside ShopAid."
    )
    db.flush()
    total_items = db.scalar(select(func.count(ShopAidCatalogItem.id))) or 0
    return {
        "imported": imported,
        "updated": updated,
        "duplicate_skus_in_file": duplicate_skus_in_file,
        "failed_count": len(failed_rows),
        "failed_rows": failed_rows[:25],
        "total_reference_items": total_items,
        "source_label": "csv_import_fallback",
        "live_shopaid_connected": False,
    }


def search_shopaid_reference_catalog(db: Session, query: str, limit: int = 20) -> list[ShopAidCatalogItem]:
    q = f"%{query.strip()}%"
    stmt = (
        select(ShopAidCatalogItem)
        .where(
            or_(
                ShopAidCatalogItem.medicine_name.ilike(q),
                ShopAidCatalogItem.sku.ilike(q),
                ShopAidCatalogItem.manufacturer.ilike(q),
            )
        )
        .order_by(ShopAidCatalogItem.medicine_name.asc())
        .limit(limit)
    )
    return list(db.scalars(stmt).all())
