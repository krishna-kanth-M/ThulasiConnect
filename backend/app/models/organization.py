"""Organizational hierarchy models: Zones and Branches."""

from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.identity import Employee, User


def utcnow() -> datetime:
    return datetime.now(UTC)


class Zone(Base):
    __tablename__ = "zones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    region_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    zonal_manager_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL", use_alter=True, name="fk_zones_zonal_manager"),
        nullable=True,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    branches: Mapped[list["Branch"]] = relationship("Branch", back_populates="zone")
    zonal_manager: Mapped["User | None"] = relationship(
        "User", foreign_keys=[zonal_manager_user_id], post_update=True
    )


class Branch(Base):
    __tablename__ = "branches"
    __table_args__ = (Index("ix_branches_zone_active", "zone_id", "is_active"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    zone_id: Mapped[int] = mapped_column(ForeignKey("zones.id", ondelete="RESTRICT"), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    city: Mapped[str] = mapped_column(String(80), nullable=False)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    phone_number: Mapped[str | None] = mapped_column(String(32), nullable=True)
    branch_manager_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL", use_alter=True, name="fk_branches_branch_manager"),
        nullable=True,
        index=True,
    )
    escalation_overdue_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    operating_hours: Mapped[str | None] = mapped_column(String(120), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    zone: Mapped["Zone"] = relationship("Zone", back_populates="branches")
    employees: Mapped[list["Employee"]] = relationship("Employee", back_populates="branch")
    branch_manager: Mapped["User | None"] = relationship(
        "User", foreign_keys=[branch_manager_user_id], post_update=True
    )
