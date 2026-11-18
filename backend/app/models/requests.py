"""Medicine & customer request tracking models with full status history."""

from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.identity import Employee, User
    from app.models.operations import Call, Customer
    from app.models.organization import Branch
    from app.models.workflow import FollowUp


def utcnow() -> datetime:
    return datetime.now(UTC)


REQUEST_STATUSES = (
    "new",
    "in_progress",
    "waiting_for_info",
    "waiting_for_stock",
    "follow_up_required",
    "resolved",
    "closed",
    "cancelled",
)


class MedicineRequest(Base):
    __tablename__ = "medicine_requests"
    __table_args__ = (
        Index("ix_med_requests_branch_status", "branch_id", "status"),
        Index("ix_med_requests_assigned_status", "assigned_employee_id", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    request_reference: Mapped[str] = mapped_column(String(48), unique=True, nullable=False, index=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id", ondelete="RESTRICT"), nullable=False, index=True)
    call_id: Mapped[int | None] = mapped_column(
        ForeignKey("calls.id", ondelete="SET NULL"), nullable=True, index=True
    )
    customer_id: Mapped[int | None] = mapped_column(
        ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True
    )
    customer_name_snapshot: Mapped[str] = mapped_column(String(140), nullable=False)
    customer_phone_snapshot: Mapped[str] = mapped_column(String(32), nullable=False)

    assigned_employee_id: Mapped[int | None] = mapped_column(
        ForeignKey("employees.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # new | in_progress | waiting_for_info | waiting_for_stock | follow_up_required | resolved | closed | cancelled
    status: Mapped[str] = mapped_column(String(32), default="new", nullable=False, index=True)
    # low | normal | high | urgent
    priority: Mapped[str] = mapped_column(String(16), default="normal", nullable=False)
    inquiry_type: Mapped[str] = mapped_column(String(48), default="availability_and_price", nullable=False)
    employee_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolution_details: Mapped[str | None] = mapped_column(Text, nullable=True)
    cancellation_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    required_followup_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    branch: Mapped["Branch"] = relationship("Branch")
    call: Mapped["Call | None"] = relationship("Call", back_populates="medicine_requests")
    customer: Mapped["Customer | None"] = relationship("Customer")
    assigned_employee: Mapped["Employee | None"] = relationship("Employee")
    created_by: Mapped["User | None"] = relationship("User")
    items: Mapped[list["MedicineRequestItem"]] = relationship(
        "MedicineRequestItem", back_populates="request", cascade="all, delete-orphan"
    )
    status_history: Mapped[list["RequestStatusHistory"]] = relationship(
        "RequestStatusHistory",
        back_populates="request",
        cascade="all, delete-orphan",
        order_by="RequestStatusHistory.changed_at.desc()",
    )
    follow_ups: Mapped[list["FollowUp"]] = relationship("FollowUp", back_populates="request")


class MedicineRequestItem(Base):
    __tablename__ = "medicine_request_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    request_id: Mapped[int] = mapped_column(
        ForeignKey("medicine_requests.id", ondelete="CASCADE"), nullable=False, index=True
    )
    medicine_name: Mapped[str] = mapped_column(String(180), nullable=False)
    strength: Mapped[str | None] = mapped_column(String(80), nullable=True)
    dosage_form: Mapped[str | None] = mapped_column(String(80), nullable=True)
    quantity: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # unknown | available | out_of_stock | order_required | partial
    availability_status: Mapped[str] = mapped_column(String(32), default="unknown", nullable=False)
    price_inquiry: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    quoted_price: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # employee_confirmed | ai_suggested | missing_info
    verification_status: Mapped[str] = mapped_column(String(32), default="employee_confirmed", nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    request: Mapped["MedicineRequest"] = relationship("MedicineRequest", back_populates="items")


class RequestStatusHistory(Base):
    __tablename__ = "request_status_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    request_id: Mapped[int] = mapped_column(
        ForeignKey("medicine_requests.id", ondelete="CASCADE"), nullable=False, index=True
    )
    from_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    to_status: Mapped[str] = mapped_column(String(32), nullable=False)
    changed_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)

    request: Mapped["MedicineRequest"] = relationship("MedicineRequest", back_populates="status_history")
    changed_by: Mapped["User | None"] = relationship("User")
