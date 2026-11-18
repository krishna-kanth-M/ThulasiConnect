"""Export all SQLAlchemy models so Alembic autogenerate discovers every table."""

from app.models.identity import (
    Employee,
    PasswordResetToken,
    Permission,
    RevokedToken,
    Role,
    RolePermission,
    User,
    UserRole,
)
from app.models.operations import (
    Call,
    CallOutcome,
    CallTranscript,
    Customer,
    Speaker,
    TranscriptSegment,
)
from app.models.organization import Branch, Zone
from app.models.requests import (
    MedicineRequest,
    MedicineRequestItem,
    RequestStatusHistory,
)
from app.models.workflow import (
    AppSetting,
    AuditLog,
    Escalation,
    FollowUp,
    IntegrationConfig,
    Notification,
    ShopAidCatalogItem,
)

__all__ = [
    "AppSetting",
    "AuditLog",
    "Branch",
    "Call",
    "CallOutcome",
    "CallTranscript",
    "Customer",
    "Employee",
    "Escalation",
    "FollowUp",
    "IntegrationConfig",
    "MedicineRequest",
    "MedicineRequestItem",
    "Notification",
    "PasswordResetToken",
    "Permission",
    "RequestStatusHistory",
    "RevokedToken",
    "Role",
    "RolePermission",
    "ShopAidCatalogItem",
    "Speaker",
    "TranscriptSegment",
    "User",
    "UserRole",
    "Zone",
]
