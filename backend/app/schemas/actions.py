"""Payload schemas per action type. Validated at execute time."""

from typing import Literal
from pydantic import BaseModel, EmailStr, Field


class TaskPayload(BaseModel):
    """A self-tracked todo. No external system."""
    notes: str | None = None  # extra free-form notes the AI or user added


class EmailPayload(BaseModel):
    """Outbound email via Resend."""
    recipients: list[EmailStr] = Field(..., min_length=1)
    subject: str = Field(..., min_length=1, max_length=200)
    body_markdown: str = Field(..., min_length=1)
    from_persona: Literal["ceo", "manager", "csm", "system"] = "system"


class PdfReportPayload(BaseModel):
    """Executive deliverable. Sections rendered to a real PDF."""
    report_type: Literal[
        "comp_review",
        "engagement_deep_dive",
        "retention_plan",
        "qbr_brief",
        "save_plan",
        "general",
    ] = "general"
    sections: list[dict] = Field(default_factory=list)
    # Each section: {heading: str, body: str}


class MeetingIcsPayload(BaseModel):
    """Calendar invite — generates a .ics file (and optionally emails it).

    Compatible with Google Calendar, Outlook, Apple Calendar — any app that
    accepts iCalendar (RFC 5545) imports.
    """
    title: str = Field(..., min_length=1, max_length=200)
    attendees: list[EmailStr] = Field(..., min_length=1)
    organizer_email: EmailStr | None = None
    start_iso: str = Field(..., description="Start time in ISO 8601, e.g. 2026-05-08T15:00:00")
    duration_minutes: int = Field(default=30, ge=5, le=480)
    description: str | None = None  # becomes the calendar event's description / agenda
    location: str | None = None      # free-form: "Conference Room B", "Google Meet", a URL
    send_email: bool = True          # if true, also email the .ics to attendees via Resend


PAYLOAD_SCHEMAS = {
    "task": TaskPayload,
    "email_send": EmailPayload,
    "pdf_report": PdfReportPayload,
    "meeting_ics": MeetingIcsPayload,
}


def validate_payload(action_type: str, payload: dict | None) -> BaseModel:
    """Raise ValidationError if payload doesn't match the type's schema."""
    schema = PAYLOAD_SCHEMAS.get(action_type)
    if schema is None:
        raise ValueError(f"Unknown action type: {action_type}")
    return schema.model_validate(payload or {})


def tier_for(action_type: str) -> str:
    """Default approval tier for a type. email_send and meeting_ics both have
    real outbound side effects (email or calendar invite to a real recipient)
    so they default to 'mid'. Tasks and PDFs are 'low'."""
    if action_type in ("email_send", "meeting_ics"):
        return "mid"
    return "low"
