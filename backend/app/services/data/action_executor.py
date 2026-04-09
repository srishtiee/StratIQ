"""Action execution. Four supported types: task, email_send, pdf_report, meeting_ics.

  task         → self-tracked. No external side effect.
  email_send   → POST to Resend. Requires RESEND_API_KEY.
  pdf_report   → Render with reportlab → upload to Storage → signed URL.
  meeting_ics  → Generate iCalendar (.ics) → upload to Storage. If payload.send_email,
                 also POST to Resend with the .ics attached so attendees can add it
                 to their calendar with one click.

Payloads are validated against pydantic schemas in app.schemas.actions before run.
"""

import base64
import io
import re
import uuid
from datetime import datetime, timedelta, timezone
from uuid import UUID

import httpx

from app.db.client import get_supabase
from app.core.config import settings
from app.schemas.actions import (
    EmailPayload,
    MeetingIcsPayload,
    PdfReportPayload,
    TaskPayload,
    validate_payload,
)


# ────────────────────────────────────────────────────────────
# Resend defaults
# ────────────────────────────────────────────────────────────
# Resend's free tier requires either a verified domain or their `onboarding@resend.dev`
# sandbox sender (which can ONLY deliver to the email address tied to your Resend
# account). For the demo we use the sandbox sender + an EMAIL_TEST_RECIPIENT override
# so the demo can ship without domain verification.
RESEND_FROM_BY_PERSONA: dict[str, str] = {
    "ceo":     "StratIQ CEO Office <onboarding@resend.dev>",
    "manager": "StratIQ <onboarding@resend.dev>",
    "csm":     "StratIQ Customer Success <onboarding@resend.dev>",
    "system":  "StratIQ <onboarding@resend.dev>",
}


def _redirect_recipients(real_recipients: list[str]) -> tuple[list[str], list[str]]:
    """Return (effective_recipients, original_recipients).

    If EMAIL_TEST_RECIPIENT is set, the effective list is just that one address;
    the originals are returned so we can prepend a 'would have gone to' note.
    """
    override = (settings.email_test_recipient or "").strip()
    if override:
        return [override], list(real_recipients)
    return list(real_recipients), []


# ────────────────────────────────────────────────────────────
# Entry point
# ────────────────────────────────────────────────────────────
async def execute_action(action: dict, user_id: UUID | str) -> dict:
    sb = get_supabase()
    action_id = action["id"]

    # Validate payload before flipping status — keeps the row in its current state if malformed.
    payload_obj = validate_payload(action["type"], action.get("payload"))

    sb.table("actions").update({"status": "executing"}).eq("id", action_id).execute()
    _log(sb, action_id, str(action["org_id"]), "started", str(user_id))

    try:
        if action["type"] == "task":
            assert isinstance(payload_obj, TaskPayload)
            result = _execute_task(action, payload_obj)
        elif action["type"] == "email_send":
            assert isinstance(payload_obj, EmailPayload)
            result = await _execute_email(action, payload_obj)
        elif action["type"] == "pdf_report":
            assert isinstance(payload_obj, PdfReportPayload)
            result = _execute_pdf(action, payload_obj)
        elif action["type"] == "meeting_ics":
            assert isinstance(payload_obj, MeetingIcsPayload)
            result = await _execute_meeting_ics(action, payload_obj)
        else:
            raise ValueError(f"Unknown action type: {action['type']}")

        sb.table("actions").update({
            "status": "completed",
            "result": result,
            "executed_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", action_id).execute()
        _log(sb, action_id, str(action["org_id"]), "completed", str(user_id), result)
        return {"status": "completed", "result": result}

    except Exception as exc:
        # Persist a useful failure reason (visible in the modal/Failed tab/chat).
        sb.table("actions").update({
            "status": "failed",
            "rejected_reason": str(exc)[:500],
        }).eq("id", action_id).execute()
        _log(sb, action_id, str(action["org_id"]), "failed", str(user_id), {"error": str(exc)})
        raise


# ────────────────────────────────────────────────────────────
# Task
# ────────────────────────────────────────────────────────────
def _execute_task(action: dict, _payload: TaskPayload) -> dict:
    return {
        "tracked": True,
        "due_date": action.get("due_date"),
        "priority": action.get("priority"),
    }


# ────────────────────────────────────────────────────────────
# Email
# ────────────────────────────────────────────────────────────
async def _execute_email(action: dict, payload: EmailPayload) -> dict:
    if not settings.resend_api_key:
        raise RuntimeError("RESEND_API_KEY not set — cannot send email")

    real_recipients = [str(r) for r in payload.recipients]
    effective, original = _redirect_recipients(real_recipients)

    persona_from = RESEND_FROM_BY_PERSONA.get(payload.from_persona, RESEND_FROM_BY_PERSONA["system"])

    body_html = _markdown_to_html(payload.body_markdown)
    if original:
        # Prefix a small banner so the test recipient can see who this would have gone to.
        body_html = (
            f'<p style="background:#fef3c7;padding:8px;border-radius:4px;font-size:12px;color:#92400e;">'
            f'<strong>[Test mode]</strong> Original recipients: {", ".join(original)}'
            f'</p>'
            + body_html
        )

    body = {
        "from": persona_from,
        "to": effective,
        "subject": payload.subject,
        "html": body_html,
    }
    headers = {
        "Authorization": f"Bearer {settings.resend_api_key}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post("https://api.resend.com/emails", json=body, headers=headers)
        if resp.status_code >= 400:
            raise RuntimeError(f"Resend API error ({resp.status_code}): {resp.text}")
        data = resp.json()

    return {
        "email_message_id": data.get("id"),
        "recipients": effective,
        "original_recipients": original,
        "subject": payload.subject,
    }


def _markdown_to_html(md: str) -> str:
    """Tiny markdown→HTML converter — bold, italics, line breaks. Enough for emails."""
    html = md
    html = re.sub(r"\*\*([^\*]+)\*\*", r"<strong>\1</strong>", html)
    html = re.sub(r"\*([^\*]+)\*", r"<em>\1</em>", html)
    html = html.replace("\n\n", "</p><p>")
    html = html.replace("\n", "<br>")
    return f"<p>{html}</p>"


# ────────────────────────────────────────────────────────────
# PDF report (real, via reportlab)
# ────────────────────────────────────────────────────────────
def _execute_pdf(action: dict, payload: PdfReportPayload) -> dict:
    from reportlab.lib.pagesizes import LETTER
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.lib.colors import HexColor
    from reportlab.platypus import (
        SimpleDocTemplate,
        Paragraph,
        Spacer,
    )

    sb = get_supabase()
    buffer = io.BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=LETTER,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
        title=action.get("title", "StratIQ Report"),
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("Title", parent=styles["Title"], fontSize=20,
                                 textColor=HexColor("#1f2937"), spaceAfter=4)
    subtitle_style = ParagraphStyle("Subtitle", parent=styles["Normal"], fontSize=11,
                                    textColor=HexColor("#6b7280"), spaceAfter=18)
    heading_style = ParagraphStyle("Heading", parent=styles["Heading2"], fontSize=13,
                                   textColor=HexColor("#111827"), spaceBefore=12, spaceAfter=6)
    body_style = ParagraphStyle("Body", parent=styles["Normal"], fontSize=10, leading=14,
                                textColor=HexColor("#374151"))

    flow = [Paragraph(action.get("title") or "StratIQ Report", title_style)]
    if action.get("description"):
        flow.append(Paragraph(action["description"], subtitle_style))
    else:
        flow.append(Paragraph(
            f"Report type: {payload.report_type.replace('_', ' ').title()}", subtitle_style,
        ))
    flow.append(Spacer(1, 6))

    if payload.sections:
        for section in payload.sections:
            heading = section.get("heading") or "Section"
            body = section.get("body") or ""
            flow.append(Paragraph(heading, heading_style))
            for para in body.split("\n\n"):
                flow.append(Paragraph(para.replace("\n", "<br/>"), body_style))
                flow.append(Spacer(1, 6))
    else:
        flow.append(Paragraph(
            "This report has no sections — populate the action's payload.sections "
            "with [{heading, body}, ...] entries to render content.", body_style,
        ))

    flow.append(Spacer(1, 24))
    flow.append(Paragraph(
        f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
        ParagraphStyle("Footer", parent=body_style, fontSize=8, textColor=HexColor("#9ca3af")),
    ))

    doc.build(flow)
    pdf_bytes = buffer.getvalue()
    buffer.close()

    storage_path = f"{action['org_id']}/reports/{uuid.uuid4()}.pdf"
    sb.storage.from_("org-generated").upload(
        storage_path,
        pdf_bytes,
        {"content-type": "application/pdf"},
    )
    signed = sb.storage.from_("org-generated").create_signed_url(storage_path, expires_in=86400)
    now = datetime.now(timezone.utc).isoformat()

    generated_file = sb.table("generated_files").insert({
        "org_id": action["org_id"],
        "action_id": action["id"],
        "file_type": "pdf",
        "storage_path": storage_path,
        "signed_url": signed.get("signedURL"),
        "signed_url_expires_at": now,
        "refreshed_at": now,
        "file_size_bytes": len(pdf_bytes),
    }).execute().data[0]

    return {
        "file_id": generated_file["id"],
        "signed_url": signed.get("signedURL"),
        "report_type": payload.report_type,
        "size_bytes": len(pdf_bytes),
    }


# ────────────────────────────────────────────────────────────
# Meeting ICS (calendar invite)
# ────────────────────────────────────────────────────────────
def _format_ics_dt(dt: datetime) -> str:
    """Format as iCalendar UTC: YYYYMMDDTHHMMSSZ."""
    return dt.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def _ics_escape(text: str) -> str:
    """Escape per RFC 5545: commas, semicolons, backslashes, newlines."""
    return (text.replace("\\", "\\\\")
                .replace("\n", "\\n")
                .replace(",", "\\,")
                .replace(";", "\\;"))


def _build_ics(payload: MeetingIcsPayload) -> str:
    """Build a minimal iCalendar (RFC 5545) document for one event.

    Compatible with Google Calendar, Outlook, Apple Calendar.
    """
    start = datetime.fromisoformat(payload.start_iso.replace("Z", "+00:00"))
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    end = start + timedelta(minutes=payload.duration_minutes)

    organizer = payload.organizer_email or (
        settings.email_test_recipient or "noreply@stratiq.ai"
    )

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//StratIQ//Meeting//EN",
        "METHOD:REQUEST",
        "CALSCALE:GREGORIAN",
        "BEGIN:VEVENT",
        f"UID:{uuid.uuid4()}@stratiq.ai",
        f"DTSTAMP:{_format_ics_dt(datetime.now(timezone.utc))}",
        f"DTSTART:{_format_ics_dt(start)}",
        f"DTEND:{_format_ics_dt(end)}",
        f"SUMMARY:{_ics_escape(payload.title)}",
    ]
    if payload.description:
        lines.append(f"DESCRIPTION:{_ics_escape(payload.description)}")
    if payload.location:
        lines.append(f"LOCATION:{_ics_escape(payload.location)}")
    lines.append(f"ORGANIZER;CN=StratIQ:mailto:{organizer}")
    for attendee in payload.attendees:
        lines.append(
            f"ATTENDEE;CN={attendee};RSVP=TRUE;ROLE=REQ-PARTICIPANT;"
            f"PARTSTAT=NEEDS-ACTION:mailto:{attendee}"
        )
    lines.append("STATUS:CONFIRMED")
    lines.append("SEQUENCE:0")
    lines.append("END:VEVENT")
    lines.append("END:VCALENDAR")
    # iCalendar lines should end CRLF
    return "\r\n".join(lines) + "\r\n"


async def _execute_meeting_ics(action: dict, payload: MeetingIcsPayload) -> dict:
    """Generate the .ics, upload it to Storage. If payload.send_email, also email
    the .ics to attendees as an attachment via Resend."""
    sb = get_supabase()

    ics_content = _build_ics(payload)
    ics_bytes = ics_content.encode("utf-8")

    # Upload to Storage
    storage_path = f"{action['org_id']}/meetings/{uuid.uuid4()}.ics"
    sb.storage.from_("org-generated").upload(
        storage_path,
        ics_bytes,
        {"content-type": "text/calendar"},
    )
    signed = sb.storage.from_("org-generated").create_signed_url(storage_path, expires_in=86400)
    now = datetime.now(timezone.utc).isoformat()

    generated_file = sb.table("generated_files").insert({
        "org_id": action["org_id"],
        "action_id": action["id"],
        "file_type": "ics",
        "storage_path": storage_path,
        "signed_url": signed.get("signedURL"),
        "signed_url_expires_at": now,
        "refreshed_at": now,
        "file_size_bytes": len(ics_bytes),
    }).execute().data[0]

    sent_email_to: list[str] | None = None
    original_attendees: list[str] | None = None
    email_message_id: str | None = None

    if payload.send_email:
        if not settings.resend_api_key:
            raise RuntimeError("RESEND_API_KEY not set — cannot email the .ics")

        real_attendees = [str(a) for a in payload.attendees]
        effective, original = _redirect_recipients(real_attendees)
        sent_email_to = effective
        original_attendees = original or None

        start_human = datetime.fromisoformat(payload.start_iso.replace("Z", "+00:00")).strftime(
            "%a, %b %d, %Y at %H:%M UTC"
        )

        body_html_parts = []
        if original:
            body_html_parts.append(
                f'<p style="background:#fef3c7;padding:8px;border-radius:4px;font-size:12px;color:#92400e;">'
                f'<strong>[Test mode]</strong> Original attendees: {", ".join(original)}'
                f'</p>'
            )
        body_html_parts.append(f"<p>You're invited to <strong>{payload.title}</strong>.</p>")
        body_html_parts.append(f"<p><strong>When:</strong> {start_human} &middot; {payload.duration_minutes} min</p>")
        if payload.location:
            body_html_parts.append(f"<p><strong>Where:</strong> {payload.location}</p>")
        if payload.description:
            body_html_parts.append(f"<p><strong>Agenda:</strong><br>{payload.description.replace(chr(10), '<br>')}</p>")
        body_html_parts.append('<p>The .ics calendar invite is attached — open it to add this to your calendar.</p>')
        body_html = "".join(body_html_parts)

        body = {
            "from": RESEND_FROM_BY_PERSONA["system"],
            "to": effective,
            "subject": f"Invitation: {payload.title}",
            "html": body_html,
            "attachments": [{
                "filename": "meeting.ics",
                "content": base64.b64encode(ics_bytes).decode("ascii"),
                "content_type": "text/calendar; method=REQUEST",
            }],
        }
        headers = {
            "Authorization": f"Bearer {settings.resend_api_key}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post("https://api.resend.com/emails", json=body, headers=headers)
            if resp.status_code >= 400:
                raise RuntimeError(f"Resend API error ({resp.status_code}): {resp.text}")
            email_message_id = resp.json().get("id")

    return {
        "file_id": generated_file["id"],
        "signed_url": signed.get("signedURL"),
        "title": payload.title,
        "start_iso": payload.start_iso,
        "duration_minutes": payload.duration_minutes,
        "attendees": [str(a) for a in payload.attendees],
        "sent_email_to": sent_email_to,
        "original_attendees": original_attendees,
        "email_message_id": email_message_id,
        "size_bytes": len(ics_bytes),
    }


# ────────────────────────────────────────────────────────────
# Logging
# ────────────────────────────────────────────────────────────
def _log(sb, action_id: str, org_id: str, event: str, actor_id: str, detail: dict | None = None):
    sb.table("execution_logs").insert({
        "org_id": org_id,
        "action_id": action_id,
        "event": event,
        "actor_id": actor_id,
        "detail": detail or {},
    }).execute()
