"""Medicine and Customer Request schemas."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

RequestStatus = Literal[
    "new",
    "in_progress",
    "waiting_for_info",
    "waiting_for_stock",
    "follow_up_required",
    "resolved",
    "closed",
    "cancelled",
]
PriorityLevel = Literal["low", "normal", "high", "urgent"]
AvailabilityStatus = Literal["unknown", "available", "out_of_stock", "order_required", "partial"]
VerificationStatus = Literal["employee_confirmed", "ai_suggested", "missing_info"]


class MedicineRequestItemIn(BaseModel):
    medicine_name: str = Field(min_length=1, max_length=180)
    strength: str | None = Field(default=None, max_length=80)
    dosage_form: str | None = Field(default=None, max_length=80)
    quantity: str | None = Field(default=None, max_length=64)
    availability_status: AvailabilityStatus = "unknown"
    price_inquiry: bool = False
    quoted_price: str | None = Field(default=None, max_length=64)
    verification_status: VerificationStatus = "employee_confirmed"
    notes: str | None = None


class MedicineRequestItemOut(BaseModel):
    id: int
    medicine_name: str
    strength: str | None = None
    dosage_form: str | None = None
    quantity: str | None = None
    availability_status: str
    price_inquiry: bool
    quoted_price: str | None = None
    verification_status: str
    notes: str | None = None


class RequestStatusHistoryOut(BaseModel):
    id: int
    from_status: str | None = None
    to_status: str
    changed_by_user_id: int | None = None
    changed_by_name: str | None = None
    note: str | None = None
    changed_at: datetime


class MedicineRequestCreateIn(BaseModel):
    branch_id: int | None = None
    call_id: int | None = None
    customer_id: int | None = None
    customer_name: str = Field(min_length=2, max_length=140)
    customer_phone: str = Field(min_length=6, max_length=32)
    assigned_employee_id: int | None = None
    priority: PriorityLevel = "normal"
    inquiry_type: str = Field(default="availability_and_price", max_length=48)
    employee_notes: str | None = None
    required_followup_at: datetime | None = None
    create_followup: bool = False
    followup_title: str | None = Field(default=None, max_length=180)
    items: list[MedicineRequestItemIn] = Field(min_length=1)


class MedicineRequestUpdateIn(BaseModel):
    status: RequestStatus | None = None
    priority: PriorityLevel | None = None
    assigned_employee_id: int | None = None
    employee_notes: str | None = None
    resolution_details: str | None = None
    cancellation_reason: str | None = None
    required_followup_at: datetime | None = None
    status_note: str | None = None
    items: list[MedicineRequestItemIn] | None = None


class MedicineRequestOut(BaseModel):
    id: int
    request_reference: str
    branch_id: int
    branch_name: str | None = None
    call_id: int | None = None
    call_reference: str | None = None
    customer_id: int | None = None
    customer_name: str
    customer_phone: str
    assigned_employee_id: int | None = None
    assigned_employee_name: str | None = None
    status: str
    priority: str
    inquiry_type: str
    employee_notes: str | None = None
    resolution_details: str | None = None
    cancellation_reason: str | None = None
    required_followup_at: datetime | None = None
    resolved_at: datetime | None = None
    closed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    items: list[MedicineRequestItemOut] = []
    status_history: list[RequestStatusHistoryOut] = []
