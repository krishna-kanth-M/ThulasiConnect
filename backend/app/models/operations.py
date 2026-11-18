"""Operational call, customer, and text-only transcription models.

STRICT PRIVACY RULE: No audio blob columns, audio file paths, or audio URLs exist anywhere in this schema.
"""

from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.identity import Employee
    from app.models.organization import Branch
    from app.models.requests import MedicineRequest


def utcnow() -> datetime:
    return datetime.now(UTC)


class Customer(Base):
    __tablename__ = "customers"
    __table_args__ = (Index("ix_customers_branch_phone", "branch_id", "phone_number"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    branch_id: Mapped[int | None] = mapped_column(
        ForeignKey("branches.id", ondelete="SET NULL"), nullable=True, index=True
    )
    full_name: Mapped[str] = mapped_column(String(140), nullable=False)
    phone_number: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    preferred_language: Mapped[str] = mapped_column(String(24), default="ta-en", nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    calls: Mapped[list["Call"]] = relationship("Call", back_populates="customer")


class CallOutcome(Base):
    __tablename__ = "call_outcomes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(48), unique=True, nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    requires_followup: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Call(Base):
    __tablename__ = "calls"
    __table_args__ = (
        Index("ix_calls_branch_started", "branch_id", "started_at"),
        Index("ix_calls_employee_started", "employee_id", "started_at"),
        Index("ix_calls_source_status", "call_source_type", "registration_status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    call_reference: Mapped[str] = mapped_column(String(48), unique=True, nullable=False, index=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id", ondelete="RESTRICT"), nullable=False, index=True)
    employee_id: Mapped[int | None] = mapped_column(
        ForeignKey("employees.id", ondelete="SET NULL"), nullable=True, index=True
    )
    customer_id: Mapped[int | None] = mapped_column(
        ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True
    )
    customer_phone_snapshot: Mapped[str | None] = mapped_column(String(32), nullable=True)
    customer_name_snapshot: Mapped[str | None] = mapped_column(String(140), nullable=True)

    # inbound | outbound
    call_direction: Mapped[str] = mapped_column(String(16), default="inbound", nullable=False)
    # browser_microphone_test | manual_telephone_call | verified_telephony_integration
    call_source_type: Mapped[str] = mapped_column(
        String(40), default="manual_telephone_call", nullable=False, index=True
    )
    # attended | missed | unregistered | abandoned (for verified telephony or logged missed calls)
    attendance_status: Mapped[str] = mapped_column(String(24), default="attended", nullable=False)
    # draft | registered | completed | unregistered
    registration_status: Mapped[str] = mapped_column(String(24), default="registered", nullable=False)

    outcome_id: Mapped[int | None] = mapped_column(
        ForeignKey("call_outcomes.id", ondelete="SET NULL"), nullable=True, index=True
    )
    outcome_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    detected_language: Mapped[str | None] = mapped_column(String(24), nullable=True)
    external_telephony_id: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)

    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    branch: Mapped["Branch"] = relationship("Branch")
    employee: Mapped["Employee | None"] = relationship("Employee")
    customer: Mapped["Customer | None"] = relationship("Customer", back_populates="calls")
    outcome: Mapped["CallOutcome | None"] = relationship("CallOutcome")
    transcript: Mapped["CallTranscript | None"] = relationship(
        "CallTranscript", back_populates="call", uselist=False, cascade="all, delete-orphan"
    )
    medicine_requests: Mapped[list["MedicineRequest"]] = relationship(
        "MedicineRequest", back_populates="call"
    )


class CallTranscript(Base):
    __tablename__ = "call_transcripts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    call_id: Mapped[int] = mapped_column(
        ForeignKey("calls.id", ondelete="CASCADE"), unique=True, nullable=False, index=True
    )
    full_text: Mapped[str] = mapped_column(Text, default="", nullable=False)
    language_detected: Mapped[str | None] = mapped_column(String(24), nullable=True)
    model_used: Mapped[str | None] = mapped_column(String(80), nullable=True)
    average_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    # ai_generated | employee_edited | manual_entry
    review_status: Mapped[str] = mapped_column(String(32), default="ai_generated", nullable=False)
    ai_extraction_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    call: Mapped["Call"] = relationship("Call", back_populates="transcript")
    speakers: Mapped[list["Speaker"]] = relationship(
        "Speaker", back_populates="transcript", cascade="all, delete-orphan"
    )
    segments: Mapped[list["TranscriptSegment"]] = relationship(
        "TranscriptSegment",
        back_populates="transcript",
        cascade="all, delete-orphan",
        order_by="TranscriptSegment.sequence_index",
    )


class Speaker(Base):
    __tablename__ = "speakers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    transcript_id: Mapped[int] = mapped_column(
        ForeignKey("call_transcripts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Speaker 1 | Speaker 2 | Unknown speaker
    speaker_label: Mapped[str] = mapped_column(String(48), default="Unknown speaker", nullable=False)
    # unverified | verified_employee | verified_customer
    identity_status: Mapped[str] = mapped_column(String(32), default="unverified", nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(120), nullable=True)

    transcript: Mapped["CallTranscript"] = relationship("CallTranscript", back_populates="speakers")


class TranscriptSegment(Base):
    __tablename__ = "transcript_segments"
    __table_args__ = (Index("ix_transcript_segments_transcript_seq", "transcript_id", "sequence_index"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    transcript_id: Mapped[int] = mapped_column(
        ForeignKey("call_transcripts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    speaker_id: Mapped[int | None] = mapped_column(
        ForeignKey("speakers.id", ondelete="SET NULL"), nullable=True
    )
    speaker_label: Mapped[str] = mapped_column(String(48), default="Unknown speaker", nullable=False)
    sequence_index: Mapped[int] = mapped_column(Integer, nullable=False)
    start_seconds: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    end_seconds: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[str | None] = mapped_column(String(24), nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_edited: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    transcript: Mapped["CallTranscript"] = relationship("CallTranscript", back_populates="segments")
    speaker: Mapped["Speaker | None"] = relationship("Speaker")
