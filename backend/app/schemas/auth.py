"""Authentication, User, Role, and Permission schemas."""

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field

EmailAddress = Annotated[
    str,
    Field(min_length=5, max_length=160, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$"),
]


class LoginRequest(BaseModel):
    email: EmailAddress
    password: str = Field(min_length=6, max_length=128)


class UserSummary(BaseModel):
    id: int
    email: str
    full_name: str
    phone: str | None = None
    is_active: bool
    must_change_password: bool = False
    roles: list[str]
    permissions: list[str] = []
    primary_role: str
    scope_level: str
    branch_id: int | None = None
    branch_name: str | None = None
    zone_id: int | None = None
    zone_name: str | None = None
    employee_id: int | None = None
    employee_code: str | None = None
    allowed_branch_ids: list[int] = []
    allowed_zone_ids: list[int] = []
    last_login_at: datetime | None = None
    created_at: datetime | None = None


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    user: UserSummary


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=6, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class PasswordResetRequestIn(BaseModel):
    email: EmailAddress


class PasswordResetConfirmIn(BaseModel):
    token: str = Field(min_length=16, max_length=255)
    new_password: str = Field(min_length=8, max_length=128)


class UserCreateIn(BaseModel):
    email: EmailAddress
    full_name: str = Field(min_length=2, max_length=120)
    phone: str | None = Field(default=None, max_length=32)
    password: str = Field(min_length=8, max_length=128)
    role_codes: list[str] = Field(min_length=1)
    branch_id: int | None = None
    zone_id: int | None = None
    employee_code: str | None = Field(default=None, max_length=40)
    designation: str | None = Field(default=None, max_length=80)
    is_active: bool = True


class UserUpdateIn(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    phone: str | None = Field(default=None, max_length=32)
    is_active: bool | None = None
    role_codes: list[str] | None = None
    branch_id: int | None = None
    zone_id: int | None = None
    designation: str | None = Field(default=None, max_length=80)
    reset_password: str | None = Field(default=None, min_length=8, max_length=128)


class RoleOut(BaseModel):
    id: int
    code: str
    name: str
    description: str | None = None
    hierarchy_level: int
    permissions: list[str] = []


class PermissionOut(BaseModel):
    id: int
    code: str
    module: str
    description: str | None = None


class RolePermissionsUpdateIn(BaseModel):
    permission_codes: list[str]
