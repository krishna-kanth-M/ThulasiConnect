"""Follow-ups, Escalations, Notifications, Audit, Integrations, and Settings schemas."""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class FollowUpCreateIn(BaseModel):
    branch_id: int | None = None
    call_id: int | None = None
    request_id: int | None = None
    customer_id: int | None = None
    assigned_employee_id: int | None = None
    title: str = Field(min_length=2, max_length=180)
    notes: str | None = None
    due_at: datetime
    priority: Literal["low", "normal", "high", "urgent"] = "normal"


class FollowUpUpdateIn(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=180)
    notes: str | None = None
    due_at: datetime | None = None
    priority: Literal["low", "normal", "high", "urgent"] | None = None
    assigned_employee_id: int | None = None
    status: Literal["pending", "overdue", "completed", "cancelled"] | None = None
    completion_notes: str | None = None


class FollowUpOut(BaseModel):
    id: int
    branch_id: int
    branch_name: str | None = None
    call_id: int | None = None
    call_reference: str | None = None
    request_id: int | None = None
    request_reference: str | None = None
    customer_id: int | None = None
    customer_name: str | None = None
    customer_phone: str | None = None
    assigned_employee_id: int
    assigned_employee_name: str | None = None
    title: str
    notes: str | None = None
    due_at: datetime
    priority: str
    status: str
    is_overdue: bool = False
    completion_notes: str | None = None
    completed_at: datetime | None = None
    reminder_sent_at: datetime | None = None
    created_at: datetime


class EscalationOut(BaseModel):
    id: int
    branch_id: int
    branch_name: str | None = None
    follow_up_id: int | None = None
    follow_up_title: str | None = None
    request_id: int | None = None
    call_id: int | None = None
    escalation_level: int
    target_role: str
    target_user_id: int | None = None
    target_user_name: str | None = None
    reason: str
    status: str
    resolution_notes: str | None = None
    triggered_at: datetime
    resolved_at: datetime | None = None


class EscalationUpdateIn(BaseModel):
    status: Literal["acknowledged", "resolved"]
    resolution_notes: str | None = None


class EscalationPolicyIn(BaseModel):
    branch_manager_overdue_minutes: int = Field(ge=5, le=10080)
    zonal_manager_overdue_minutes: int = Field(ge=15, le=20160)
    owner_overdue_minutes: int = Field(ge=30, le=43200)


class EscalationPolicyOut(EscalationPolicyIn):
    pass


class NotificationOut(BaseModel):
    id: int
    recipient_user_id: int
    category: str
    severity: str
    title: str
    message: str
    entity_type: str | None = None
    entity_id: int | None = None
    is_read: bool
    read_at: datetime | None = None
    created_at: datetime


class AuditLogOut(BaseModel):
    id: int
    actor_user_id: int | None = None
    actor_email: str | None = None
    action: str
    entity_type: str
    entity_id: str | None = None
    details: dict[str, Any] | None = None
    ip_address: str | None = None
    created_at: datetime


class IntegrationConfigUpdateIn(BaseModel):
    endpoint_url: str | None = Field(default=None, max_length=255)
    mode: Literal["read_only", "csv_fallback", "webhook_listener"] | None = None
    status_message: str | None = None
    config: dict[str, Any] | None = None


class IntegrationConfigOut(BaseModel):
    id: int
    integration_key: str
    display_name: str
    status: str
    mode: str
    endpoint_url: str | None = None
    status_message: str | None = None
    config: dict[str, Any] = {}
    last_synced_at: datetime | None = None
    updated_at: datetime


class ShopAidCatalogItemOut(BaseModel):
    id: int
    sku: str
    medicine_name: str
    strength: str | None = None
    dosage_form: str | None = None
    manufacturer: str | None = None
    mrp_price: str | None = None
    stock_status_snapshot: str
    source_label: str
    imported_at: datetime
