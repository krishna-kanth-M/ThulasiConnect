"""Customer, Call, CallOutcome, Transcript, and AI Extraction schemas."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

CallDirection = Literal["inbound", "outbound"]
CallSourceType = Literal[
    "browser_microphone_test",
    "manual_telephone_call",
    "verified_telephony_integration",
]
AttendanceStatus = Literal["attended", "missed", "unregistered", "abandoned"]
RegistrationStatus = Literal["draft", "registered", "completed", "unregistered"]


class CustomerCreateIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=140)
    phone_number: str = Field(min_length=6, max_length=32)
    branch_id: int | None = None
    preferred_language: str = Field(default="ta-en", max_length=24)
    notes: str | None = None


class CustomerUpdateIn(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=140)
    phone_number: str | None = Field(default=None, min_length=6, max_length=32)
    preferred_language: str | None = Field(default=None, max_length=24)
    notes: str | None = None


class CustomerOut(BaseModel):
    id: int
    branch_id: int | None = None
    full_name: str
    phone_number: str
    preferred_language: str
    notes: str | None = None
    call_count: int = 0
    created_at: datetime


class CallOutcomeOut(BaseModel):
    id: int
    code: str
    label: str
    requires_followup: bool
    is_active: bool


class TranscriptSegmentIn(BaseModel):
    sequence_index: int = Field(ge=0)
    speaker_label: str = Field(default="Unknown speaker", max_length=48)
    start_seconds: float = Field(default=0.0, ge=0.0)
    end_seconds: float = Field(default=0.0, ge=0.0)
    text: str = Field(min_length=1)
    language: str | None = Field(default=None, max_length=24)
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    is_edited: bool = False


class TranscriptSegmentOut(BaseModel):
    id: int
    sequence_index: int
    speaker_label: str
    start_seconds: float
    end_seconds: float
    text: str
    language: str | None = None
    confidence: float | None = None
    is_edited: bool


class TranscriptSaveIn(BaseModel):
    full_text: str | None = None
    language_detected: str | None = Field(default=None, max_length=24)
    model_used: str | None = Field(default=None, max_length=80)
    average_confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    review_status: Literal["ai_generated", "employee_edited", "manual_entry"] = "employee_edited"
    segments: list[TranscriptSegmentIn] = []
    ai_extraction_json: str | None = None


class TranscriptOut(BaseModel):
    id: int
    call_id: int
    full_text: str
    language_detected: str | None = None
    model_used: str | None = None
    average_confidence: float | None = None
    review_status: str
    ai_extraction_json: str | None = None
    segments: list[TranscriptSegmentOut] = []
    updated_at: datetime


class CallCreateIn(BaseModel):
    branch_id: int | None = None
    employee_id: int | None = None
    customer_id: int | None = None
    customer_name: str | None = Field(default=None, max_length=140)
    customer_phone: str | None = Field(default=None, max_length=32)
    call_direction: CallDirection = "inbound"
    call_source_type: CallSourceType = "manual_telephone_call"
    attendance_status: AttendanceStatus = "attended"
    registration_status: RegistrationStatus = "registered"
    outcome_code: str | None = None
    outcome_notes: str | None = None
    summary: str | None = None
    detected_language: str | None = Field(default=None, max_length=24)
    started_at: datetime | None = None
    ended_at: datetime | None = None


class CallUpdateIn(BaseModel):
    customer_id: int | None = None
    customer_name: str | None = Field(default=None, max_length=140)
    customer_phone: str | None = Field(default=None, max_length=32)
    call_direction: CallDirection | None = None
    attendance_status: AttendanceStatus | None = None
    registration_status: RegistrationStatus | None = None
    outcome_code: str | None = None
    outcome_notes: str | None = None
    summary: str | None = None
    detected_language: str | None = None
    ended_at: datetime | None = None


class CallOut(BaseModel):
    id: int
    call_reference: str
    branch_id: int
    branch_name: str | None = None
    employee_id: int | None = None
    employee_name: str | None = None
    customer_id: int | None = None
    customer_name: str | None = None
    customer_phone: str | None = None
    call_direction: str
    call_source_type: str
    attendance_status: str
    registration_status: str
    outcome_id: int | None = None
    outcome_code: str | None = None
    outcome_label: str | None = None
    outcome_notes: str | None = None
    summary: str | None = None
    detected_language: str | None = None
    has_transcript: bool = False
    request_count: int = 0
    followup_count: int = 0
    started_at: datetime
    ended_at: datetime | None = None
    created_at: datetime


class CallDetailOut(CallOut):
    transcript: TranscriptOut | None = None
    request_ids: list[int] = []
    followup_ids: list[int] = []


class AIExtractRequestIn(BaseModel):
    transcript_text: str = Field(min_length=3)
    language_hint: str | None = None


class ExtractedMedicineSuggestion(BaseModel):
    medicine_name: str
    strength: str | None = None
    dosage_form: str | None = None
    quantity: str | None = None
    availability_question: bool = False
    pricing_question: bool = False
    verification_status: Literal["ai_suggested", "missing_info"] = "ai_suggested"
    notes: str | None = None


class AIExtractResponseOut(BaseModel):
    source: str  # ollama | heuristic_fallback
    model_used: str
    disclaimer: str
    summary_suggestion: str
    customer_name_mentioned: str | None = None
    urgency_indicator: str = "normal"
    uncertain_fields: list[str] = []
    medicines: list[ExtractedMedicineSuggestion] = []
    availability_questions: list[str] = []
    pricing_questions: list[str] = []
    missing_information: list[str] = []
    suggested_followup_needed: bool = False
    customer_details_to_confirm: list[str] = []
