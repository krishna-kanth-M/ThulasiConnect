"""Follow-ups, Notifications, Escalations, Audit Logs, Integrations, and App Settings."""

from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.identity import Employee, User
    from app.models.operations import Call, Customer
    from app.models.organization import Branch
    from app.models.requests import MedicineRequest


def utcnow() -> datetime:
    return datetime.now(UTC)


class FollowUp(Base):
    __tablename__ = "follow_ups"
    __table_args__ = (
        Index("ix_followups_status_due", "status", "due_at"),
        Index("ix_followups_employee_status", "assigned_employee_id", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id", ondelete="RESTRICT"), nullable=False, index=True)
    call_id: Mapped[int | None] = mapped_column(
        ForeignKey("calls.id", ondelete="SET NULL"), nullable=True, index=True
    )
    request_id: Mapped[int | None] = mapped_column(
        ForeignKey("medicine_requests.id", ondelete="SET NULL"), nullable=True, index=True
    )
    customer_id: Mapped[int | None] = mapped_column(
        ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True
    )
    assigned_employee_id: Mapped[int] = mapped_column(
        ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    created_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    title: Mapped[str] = mapped_column(String(180), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    # low | normal | high | urgent
    priority: Mapped[str] = mapped_column(String(16), default="normal", nullable=False)
    # pending | overdue | completed | cancelled
    status: Mapped[str] = mapped_column(String(24), default="pending", nullable=False, index=True)
    completion_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reminder_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    branch: Mapped["Branch"] = relationship("Branch")
    call: Mapped["Call | None"] = relationship("Call")
    request: Mapped["MedicineRequest | None"] = relationship("MedicineRequest", back_populates="follow_ups")
    customer: Mapped["Customer | None"] = relationship("Customer")
    assigned_employee: Mapped["Employee"] = relationship("Employee")


class Escalation(Base):
    __tablename__ = "escalations"
    __table_args__ = (
        Index("ix_escalations_branch_status", "branch_id", "status"),
        Index("ix_escalations_dedup", "follow_up_id", "escalation_level"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id", ondelete="RESTRICT"), nullable=False, index=True)
    follow_up_id: Mapped[int | None] = mapped_column(
        ForeignKey("follow_ups.id", ondelete="CASCADE"), nullable=True, index=True
    )
    request_id: Mapped[int | None] = mapped_column(
        ForeignKey("medicine_requests.id", ondelete="SET NULL"), nullable=True, index=True
    )
    call_id: Mapped[int | None] = mapped_column(
        ForeignKey("calls.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # 1 = branch_manager, 2 = zonal_manager, 3 = owner
    escalation_level: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    target_role: Mapped[str] = mapped_column(String(40), nullable=False)
    target_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    # open | acknowledged | resolved
    status: Mapped[str] = mapped_column(String(24), default="open", nullable=False, index=True)
    resolution_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    triggered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    branch: Mapped["Branch"] = relationship("Branch")
    follow_up: Mapped["FollowUp | None"] = relationship("FollowUp")
    target_user: Mapped["User | None"] = relationship("User", foreign_keys=[target_user_id])


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        Index("ix_notifications_recipient_read", "recipient_user_id", "is_read", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    recipient_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # reminder | escalation | request_update | missed_call | system_alert
    category: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    # info | warning | critical
    severity: Mapped[str] = mapped_column(String(16), default="info", nullable=False)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    entity_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    entity_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    dedup_key: Mapped[str | None] = mapped_column(String(160), unique=True, nullable=True, index=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (Index("ix_audit_entity_time", "entity_type", "created_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    actor_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    actor_email: Mapped[str | None] = mapped_column(String(160), nullable=True)
    action: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    entity_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    details_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)


class IntegrationConfig(Base):
    __tablename__ = "integration_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # shopaid_inventory | telephony_pbx
    integration_key: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    # disconnected | configured_unverified | connected | csv_fallback_only
    status: Mapped[str] = mapped_column(String(32), default="disconnected", nullable=False)
    mode: Mapped[str] = mapped_column(String(32), default="read_only", nullable=False)
    endpoint_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    config_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    status_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )


class ShopAidCatalogItem(Base):
    """Optional CSV fallback reference catalog (strictly read-only reference, never live ShopAid)."""

    __tablename__ = "shopaid_catalog_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sku: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    medicine_name: Mapped[str] = mapped_column(String(180), nullable=False, index=True)
    strength: Mapped[str | None] = mapped_column(String(80), nullable=True)
    dosage_form: Mapped[str | None] = mapped_column(String(80), nullable=True)
    manufacturer: Mapped[str | None] = mapped_column(String(120), nullable=True)
    mrp_price: Mapped[str | None] = mapped_column(String(32), nullable=True)
    stock_status_snapshot: Mapped[str] = mapped_column(String(32), default="snapshot_unverified", nullable=False)
    source_label: Mapped[str] = mapped_column(String(64), default="csv_import_fallback", nullable=False)
    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class AppSetting(Base):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    updated_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )
