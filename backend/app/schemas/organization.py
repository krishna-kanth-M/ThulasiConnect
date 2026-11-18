"""Zone, Branch, and Employee schemas."""

from datetime import datetime

from pydantic import BaseModel, Field


class ZoneCreateIn(BaseModel):
    code: str = Field(min_length=2, max_length=32)
    name: str = Field(min_length=2, max_length=120)
    region_description: str | None = None
    zonal_manager_user_id: int | None = None
    is_active: bool = True


class ZoneUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    region_description: str | None = None
    zonal_manager_user_id: int | None = None
    is_active: bool | None = None


class ZoneOut(BaseModel):
    id: int
    code: str
    name: str
    region_description: str | None = None
    zonal_manager_user_id: int | None = None
    zonal_manager_name: str | None = None
    branch_count: int = 0
    is_active: bool
    created_at: datetime


class BranchCreateIn(BaseModel):
    zone_id: int
    code: str = Field(min_length=2, max_length=32)
    name: str = Field(min_length=2, max_length=150)
    city: str = Field(min_length=2, max_length=80)
    address: str | None = None
    phone_number: str | None = Field(default=None, max_length=32)
    branch_manager_user_id: int | None = None
    escalation_overdue_minutes: int | None = Field(default=None, ge=5, le=10080)
    operating_hours: str | None = Field(default=None, max_length=120)
    is_active: bool = True


class BranchUpdateIn(BaseModel):
    zone_id: int | None = None
    name: str | None = Field(default=None, min_length=2, max_length=150)
    city: str | None = Field(default=None, min_length=2, max_length=80)
    address: str | None = None
    phone_number: str | None = Field(default=None, max_length=32)
    branch_manager_user_id: int | None = None
    escalation_overdue_minutes: int | None = Field(default=None, ge=5, le=10080)
    operating_hours: str | None = Field(default=None, max_length=120)
    is_active: bool | None = None


class BranchOut(BaseModel):
    id: int
    zone_id: int
    zone_name: str | None = None
    code: str
    name: str
    city: str
    address: str | None = None
    phone_number: str | None = None
    branch_manager_user_id: int | None = None
    branch_manager_name: str | None = None
    escalation_overdue_minutes: int | None = None
    operating_hours: str | None = None
    employee_count: int = 0
    pharmacist_count: int = 0
    warnings: list[str] = []
    is_active: bool
    created_at: datetime


class EmployeeOut(BaseModel):
    id: int
    user_id: int
    employee_code: str
    full_name: str
    email: str
    phone: str | None = None
    designation: str
    branch_id: int | None = None
    branch_name: str | None = None
    zone_id: int | None = None
    zone_name: str | None = None
    roles: list[str] = []
    is_active: bool
