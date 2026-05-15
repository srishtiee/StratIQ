'use client'

/**
 * Inline approval form rendered inside the chat. The AI fills in fields via the
 * planner; the user reviews, edits, then Approves (save → approve → execute) or
 * Cancels (soft-delete). One form per draft. Multi-action requests render N forms.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  Mail, FileText, CheckSquare, Calendar, Loader2,
  CheckCircle2, AlertCircle, Plus, Trash2, Download,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  useAction, useUpdateAction, useApproveAction, useExecuteAction, useDeleteAction,
} from '@/lib/api/hooks'
import type { ApiAction, ApiActionType } from '@/lib/api/types'

const BTN_BASE = 'inline-flex items-center justify-center gap-1.5 text-xs font-medium rounded-md px-3 py-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
const BTN_PRIMARY = `${BTN_BASE} bg-gray-900 text-white border border-gray-900 hover:bg-gray-800`
const BTN_SECONDARY = `${BTN_BASE} bg-white text-gray-700 border border-gray-200 hover:bg-gray-50`

const TYPE_ICONS: Record<ApiActionType, React.ElementType> = {
  email_send: Mail, pdf_report: FileText, task: CheckSquare, meeting_ics: Calendar,
}
const TYPE_LABELS: Record<ApiActionType, string> = {
  email_send: 'Email', pdf_report: 'PDF Report', task: 'Task', meeting_ics: 'Meeting',
}

const REPORT_TYPES = ['comp_review', 'engagement_deep_dive', 'retention_plan', 'qbr_brief', 'save_plan', 'general'] as const
const EMAIL_PERSONAS = ['ceo', 'manager', 'csm', 'system'] as const
const PRIORITIES = ['low', 'medium', 'high'] as const

type Section = { heading: string; body: string }

type EmailFields = { recipientsText: string; subject: string; body_markdown: string; from_persona: typeof EMAIL_PERSONAS[number] }
type TaskFields = { notes: string; due_date: string; priority: typeof PRIORITIES[number] | '' }
type PdfFields = { report_type: typeof REPORT_TYPES[number]; sections: Section[] }
type MeetingFields = { attendeesText: string; start_iso: string; duration_minutes: number; description: string; location: string; send_email: boolean }

function isoToLocal(iso: string): string {
  const m = iso.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/)
  return m ? m[1] : ''
}
function localToIso(local: string): string {
  if (!local) return ''
  return /:\d{2}$/.test(local) ? local : `${local}:00`
}

function statusBadgeClass(status: ApiAction['status']): string {
  const map: Record<ApiAction['status'], string> = {
    draft: 'bg-gray-100 text-gray-700 border-gray-200',
    pending_approval: 'bg-amber-50 text-amber-800 border-amber-200',
    approved: 'bg-blue-50 text-blue-800 border-blue-200',
    executing: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    completed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    failed: 'bg-rose-50 text-rose-800 border-rose-200',
    rejected: 'bg-rose-50 text-rose-800 border-rose-200',
  }
  return map[status] ?? 'bg-gray-100 text-gray-700'
}

interface Props {
  initialAction: ApiAction
}

export function ActionInlineForm({ initialAction }: Props) {
  const { data: live } = useAction(initialAction.id)
  const action = live ?? initialAction

  const updateMutation = useUpdateAction()
  const approveMutation = useApproveAction()
  const executeMutation = useExecuteAction()
  const deleteMutation = useDeleteAction()

  const [title, setTitle] = useState(action.title ?? '')
  const [emailFields, setEmailFields] = useState<EmailFields>(() => emailFromPayload(action))
  const [taskFields, setTaskFields] = useState<TaskFields>(() => taskFromPayload(action))
  const [pdfFields, setPdfFields] = useState<PdfFields>(() => pdfFromPayload(action))
  const [meetingFields, setMeetingFields] = useState<MeetingFields>(() => meetingFromPayload(action))
  const [hydratedFor, setHydratedFor] = useState<string | null>(action.id)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [cancelled, setCancelled] = useState(false)

  // Re-hydrate when action.id changes (or after a save flush). Polling keeps us
  // current without clobbering in-flight edits.
  useEffect(() => {
    if (hydratedFor === action.id) return
    setTitle(action.title ?? '')
    setEmailFields(emailFromPayload(action))
    setTaskFields(taskFromPayload(action))
    setPdfFields(pdfFromPayload(action))
    setMeetingFields(meetingFromPayload(action))
    setHydratedFor(action.id)
  }, [action, hydratedFor])

  const editable = action.status === 'draft' || action.status === 'pending_approval'
  const isExecuting = action.status === 'executing' || executeMutation.isPending
  const isTerminal = ['completed', 'failed', 'rejected'].includes(action.status)
  const Icon = TYPE_ICONS[action.type] ?? CheckSquare

  // Transient "Saved" indicator shown right after a successful save.
  const [savedFlash, setSavedFlash] = useState(false)

  // Whether the local form has unsaved edits relative to the persisted action.
  // For non-task types, the primary button is the "send/generate/invite" trigger,
  // so it should always be visible — we only gate visibility for tasks where
  // the primary button is just a save (no execute).
  const isDirty = useMemo(() => {
    if (title !== (action.title ?? '')) return true
    const payload = (action.payload ?? {}) as Record<string, unknown>
    if (action.type === 'task') {
      if (taskFields.notes !== ((payload.notes as string) ?? '')) return true
      if (taskFields.due_date !== (action.due_date ?? '')) return true
      if (taskFields.priority !== ((action.priority ?? '') as string)) return true
      return false
    }
    return true
  }, [action, title, taskFields])

  // Build current payload from local state.
  const buildUpdates = useMemo(() => {
    return () => {
      const updates: Record<string, unknown> = {}
      if (title !== (action.title ?? '')) updates.title = title

      if (action.type === 'email_send') {
        const recipients = emailFields.recipientsText.split(',').map(s => s.trim()).filter(Boolean)
        updates.payload = {
          recipients,
          subject: emailFields.subject,
          body_markdown: emailFields.body_markdown,
          from_persona: emailFields.from_persona,
        }
      } else if (action.type === 'task') {
        updates.payload = { notes: taskFields.notes }
        if (taskFields.due_date !== (action.due_date ?? '')) updates.due_date = taskFields.due_date || null
        if (taskFields.priority && taskFields.priority !== action.priority) updates.priority = taskFields.priority
      } else if (action.type === 'pdf_report') {
        updates.payload = {
          report_type: pdfFields.report_type,
          sections: pdfFields.sections.filter(s => s.heading || s.body),
        }
      } else if (action.type === 'meeting_ics') {
        const attendees = meetingFields.attendeesText.split(',').map(s => s.trim()).filter(Boolean)
        updates.payload = {
          title: title || 'Meeting',
          attendees,
          start_iso: localToIso(meetingFields.start_iso),
          duration_minutes: meetingFields.duration_minutes,
          description: meetingFields.description || null,
          location: meetingFields.location || null,
          send_email: meetingFields.send_email,
        }
      }
      return updates
    }
  }, [action, title, emailFields, taskFields, pdfFields, meetingFields])

  async function handleApprove() {
    setErrorMsg(null)
    try {
      const updates = buildUpdates()
      if (Object.keys(updates).length > 0 && editable) {
        await updateMutation.mutateAsync({ actionId: action.id, updates })
      }
      if (action.status === 'pending_approval') {
        await approveMutation.mutateAsync(action.id)
      }
      // Tasks are tracked todos — "Save changes" saves them, it doesn't execute
      // and complete them. The user marks them done later via the Mark Done
      // button below or from the Actions Center.
      if (action.type !== 'task') {
        await executeMutation.mutateAsync(action.id)
      } else {
        // Flash a "Saved" indicator so the user sees that their edits stuck.
        setSavedFlash(true)
        setTimeout(() => setSavedFlash(false), 2500)
      }
    } catch (exc) {
      setErrorMsg(exc instanceof Error ? exc.message : 'Something went wrong')
    }
  }

  async function handleMarkDone() {
    setErrorMsg(null)
    try {
      await executeMutation.mutateAsync(action.id)
    } catch (exc) {
      setErrorMsg(exc instanceof Error ? exc.message : 'Something went wrong')
    }
  }

  async function handleCancel() {
    setErrorMsg(null)
    try {
      await deleteMutation.mutateAsync({ actionId: action.id })
      setCancelled(true)
    } catch (exc) {
      setErrorMsg(exc instanceof Error ? exc.message : 'Something went wrong')
    }
  }

  if (cancelled) {
    return (
      <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
        Cancelled.
      </div>
    )
  }

  const result = (action.result ?? {}) as Record<string, unknown>
  const pdfUrl = action.type === 'pdf_report' && action.status === 'completed'
    ? (result.signed_url as string | undefined)
    : undefined
  const icsUrl = action.type === 'meeting_ics' && action.status === 'completed'
    ? (result.signed_url as string | undefined)
    : undefined

  const primaryLabel = (() => {
    if (action.status === 'pending_approval') return 'Approve & Send'
    if (action.type === 'email_send') return 'Send Email'
    if (action.type === 'meeting_ics') return 'Send Invite'
    // Tasks: the action row is created on AI draft. Subsequent presses save edits.
    if (action.type === 'task') return 'Save changes'
    if (action.type === 'pdf_report') return 'Generate'
    return 'Approve'
  })()

  // Tasks only show the primary "Save changes" button when there are unsaved edits.
  // Other action types always show their primary button (it's the execute trigger).
  const showPrimary = action.type !== 'task' || isDirty

  return (
    <div className="mt-3 rounded-lg border border-gray-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50/40">
        <div className="w-6 h-6 rounded-md bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5 text-gray-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">{TYPE_LABELS[action.type]}</p>
        </div>
        <Badge className={cn('text-[10px] shrink-0 font-medium', statusBadgeClass(action.status))}>
          {action.status.replace('_', ' ')}
        </Badge>
      </div>

      {/* Body — terminal state OR editable form */}
      {isTerminal ? (
        <div className="px-3 py-3 space-y-2">
          <div className="flex items-center gap-2">
            {action.status === 'completed'
              ? <CheckCircle2 className="w-4 h-4 text-gray-700" />
              : <AlertCircle className="w-4 h-4 text-gray-700" />}
            <p className="text-sm font-medium text-gray-900">
              {action.status === 'completed'
                ? action.type === 'pdf_report' ? 'Report generated'
                  : action.type === 'email_send' ? 'Email sent'
                  : action.type === 'meeting_ics' ? 'Invite sent'
                  : 'Task tracked'
                : action.status === 'rejected' ? 'Rejected' : 'Failed'}
            </p>
          </div>
          <p className="text-xs font-medium text-gray-800">{action.title}</p>
          {action.rejected_reason && (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-2 text-xs text-gray-700">
              {action.rejected_reason}
            </div>
          )}
          {pdfUrl && (
            <a href={pdfUrl} target="_blank" rel="noreferrer" className={BTN_SECONDARY + ' w-fit'}>
              <Download className="w-3.5 h-3.5" /> Download PDF
            </a>
          )}
          {icsUrl && (
            <a href={icsUrl} target="_blank" rel="noreferrer" className={BTN_SECONDARY + ' w-fit'}>
              <Download className="w-3.5 h-3.5" /> Download .ics
            </a>
          )}
          {action.type === 'email_send' && action.status === 'completed' && (
            <div className="text-xs text-gray-600">
              Sent to {Array.isArray(result.recipients) ? (result.recipients as string[]).join(', ') : '—'}
            </div>
          )}
          {action.type === 'meeting_ics' && action.status === 'completed' && (
            <div className="text-xs text-gray-600">
              Invited {Array.isArray(result.attendees) ? (result.attendees as string[]).join(', ') : '—'}
              {' '}for {String(result.start_iso ?? '')}
            </div>
          )}
        </div>
      ) : isExecuting ? (
        <div className="px-3 py-4 text-center">
          <Loader2 className="w-5 h-5 text-gray-600 animate-spin mx-auto mb-1.5" />
          <p className="text-xs text-gray-500">
            {action.type === 'pdf_report' ? 'Generating report…' :
              action.type === 'email_send' ? 'Sending email…' :
              action.type === 'meeting_ics' ? 'Creating calendar invite…' :
              'Working…'}
          </p>
        </div>
      ) : (
        <div className="px-3 py-3 space-y-2.5">
          <div>
            <Label className="text-[10px] text-gray-500 mb-0.5 block">Title</Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              disabled={!editable}
              className="bg-white border-gray-200 text-xs h-7"
            />
          </div>

          {action.type === 'email_send' && (
            <>
              <FieldEmail editable={editable} fields={emailFields} onChange={setEmailFields} />
            </>
          )}
          {action.type === 'task' && (
            <FieldTask editable={editable} fields={taskFields} onChange={setTaskFields} />
          )}
          {action.type === 'pdf_report' && (
            <FieldPdf editable={editable} fields={pdfFields} onChange={setPdfFields} />
          )}
          {action.type === 'meeting_ics' && (
            <FieldMeeting editable={editable} fields={meetingFields} onChange={setMeetingFields} />
          )}

          {errorMsg && (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-2 text-xs text-gray-700">
              {errorMsg}
            </div>
          )}

          <div className="flex items-center gap-1.5 pt-1">
            {showPrimary && (
              <button
                onClick={handleApprove}
                disabled={
                  updateMutation.isPending ||
                  approveMutation.isPending ||
                  executeMutation.isPending
                }
                className={BTN_PRIMARY + ' h-7'}
              >
                {(updateMutation.isPending || approveMutation.isPending || executeMutation.isPending) ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : null}
                {primaryLabel}
              </button>
            )}
            {action.type === 'task' && action.status === 'draft' && (
              <button
                onClick={handleMarkDone}
                disabled={executeMutation.isPending}
                className={BTN_SECONDARY + ' h-7'}
              >
                {executeMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                Mark Done
              </button>
            )}
            <button
              onClick={handleCancel}
              disabled={deleteMutation.isPending}
              className={BTN_SECONDARY + ' h-7'}
            >
              {deleteMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              Cancel
            </button>
            {savedFlash && (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 ml-auto">
                <CheckCircle2 className="w-3 h-3" /> Saved
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}


// ──────────────────────────────────────────────────────────────────────
// Per-type field groups
// ──────────────────────────────────────────────────────────────────────
function FieldEmail({ editable, fields, onChange }: { editable: boolean; fields: EmailFields; onChange: (f: EmailFields) => void }) {
  return (
    <>
      <div>
        <Label className="text-[10px] text-gray-500 mb-0.5 block">Recipients</Label>
        <Input
          value={fields.recipientsText}
          disabled={!editable}
          onChange={e => onChange({ ...fields, recipientsText: e.target.value })}
          placeholder="alice@example.com, bob@example.com"
          className="bg-white border-gray-200 text-xs h-7"
        />
      </div>
      <div>
        <Label className="text-[10px] text-gray-500 mb-0.5 block">Subject</Label>
        <Input
          value={fields.subject}
          disabled={!editable}
          onChange={e => onChange({ ...fields, subject: e.target.value })}
          className="bg-white border-gray-200 text-xs h-7"
        />
      </div>
      <div>
        <Label className="text-[10px] text-gray-500 mb-0.5 block">Body</Label>
        <Textarea
          value={fields.body_markdown}
          disabled={!editable}
          rows={5}
          onChange={e => onChange({ ...fields, body_markdown: e.target.value })}
          className="bg-white border-gray-200 text-xs resize-y font-mono"
        />
      </div>
    </>
  )
}

function FieldTask({ editable, fields, onChange }: { editable: boolean; fields: TaskFields; onChange: (f: TaskFields) => void }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px] text-gray-500 mb-0.5 block">Due date</Label>
          <Input
            type="date" value={fields.due_date} disabled={!editable}
            onChange={e => onChange({ ...fields, due_date: e.target.value })}
            className="bg-white border-gray-200 text-xs h-7"
          />
        </div>
        <div>
          <Label className="text-[10px] text-gray-500 mb-0.5 block">Priority</Label>
          <select
            value={fields.priority || ''}
            disabled={!editable}
            onChange={e => onChange({ ...fields, priority: e.target.value as TaskFields['priority'] })}
            className="w-full text-xs border border-gray-200 rounded-md px-2 py-1 bg-white h-7"
          >
            <option value="">—</option>
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>
      <div>
        <Label className="text-[10px] text-gray-500 mb-0.5 block">Notes</Label>
        <Textarea
          value={fields.notes} disabled={!editable} rows={3}
          onChange={e => onChange({ ...fields, notes: e.target.value })}
          className="bg-white border-gray-200 text-xs resize-y"
        />
      </div>
    </>
  )
}

function FieldPdf({ editable, fields, onChange }: { editable: boolean; fields: PdfFields; onChange: (f: PdfFields) => void }) {
  return (
    <>
      <div>
        <Label className="text-[10px] text-gray-500 mb-0.5 block">Report type</Label>
        <select
          value={fields.report_type}
          disabled={!editable}
          onChange={e => onChange({ ...fields, report_type: e.target.value as PdfFields['report_type'] })}
          className="w-full text-xs border border-gray-200 rounded-md px-2 py-1 bg-white h-7"
        >
          {REPORT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <Label className="text-[10px] text-gray-500">Sections</Label>
          {editable && (
            <button
              className={BTN_SECONDARY + ' h-6 px-2 text-[10px]'}
              onClick={() => onChange({ ...fields, sections: [...fields.sections, { heading: '', body: '' }] })}
            >
              <Plus className="w-3 h-3" /> Add
            </button>
          )}
        </div>
        <div className="space-y-1.5">
          {fields.sections.map((s, i) => (
            <div key={i} className="border border-gray-200 rounded-md p-1.5 space-y-1 bg-gray-50">
              <div className="flex gap-1.5">
                <Input
                  value={s.heading} disabled={!editable}
                  placeholder="Heading"
                  onChange={e => {
                    const next = [...fields.sections]; next[i] = { ...next[i], heading: e.target.value }
                    onChange({ ...fields, sections: next })
                  }}
                  className="bg-white border-gray-200 text-xs h-7"
                />
                {editable && (
                  <button
                    onClick={() => onChange({ ...fields, sections: fields.sections.filter((_, j) => j !== i) })}
                    className="p-1 text-gray-400 hover:text-gray-700"
                    aria-label="Remove section"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
              <Textarea
                value={s.body} disabled={!editable} rows={2}
                onChange={e => {
                  const next = [...fields.sections]; next[i] = { ...next[i], body: e.target.value }
                  onChange({ ...fields, sections: next })
                }}
                className="bg-white border-gray-200 text-xs resize-y"
              />
            </div>
          ))}
          {fields.sections.length === 0 && (
            <p className="text-[10px] text-gray-400 italic">No sections.</p>
          )}
        </div>
      </div>
    </>
  )
}

function FieldMeeting({ editable, fields, onChange }: { editable: boolean; fields: MeetingFields; onChange: (f: MeetingFields) => void }) {
  return (
    <>
      <div>
        <Label className="text-[10px] text-gray-500 mb-0.5 block">Attendees</Label>
        <Input
          value={fields.attendeesText} disabled={!editable}
          onChange={e => onChange({ ...fields, attendeesText: e.target.value })}
          placeholder="alice@example.com, bob@example.com"
          className="bg-white border-gray-200 text-xs h-7"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px] text-gray-500 mb-0.5 block">Start</Label>
          <Input
            type="datetime-local" value={fields.start_iso} disabled={!editable}
            onChange={e => onChange({ ...fields, start_iso: e.target.value })}
            className="bg-white border-gray-200 text-xs h-7"
          />
        </div>
        <div>
          <Label className="text-[10px] text-gray-500 mb-0.5 block">Duration (min)</Label>
          <Input
            type="number" min={5} max={480} step={5}
            value={fields.duration_minutes} disabled={!editable}
            onChange={e => onChange({ ...fields, duration_minutes: Number(e.target.value) || 30 })}
            className="bg-white border-gray-200 text-xs h-7"
          />
        </div>
      </div>
      <div>
        <Label className="text-[10px] text-gray-500 mb-0.5 block">Location (optional)</Label>
        <Input
          value={fields.location} disabled={!editable}
          onChange={e => onChange({ ...fields, location: e.target.value })}
          placeholder="Google Meet, Zoom, conference room…"
          className="bg-white border-gray-200 text-xs h-7"
        />
      </div>
      <div>
        <Label className="text-[10px] text-gray-500 mb-0.5 block">Agenda</Label>
        <Textarea
          value={fields.description} disabled={!editable} rows={3}
          onChange={e => onChange({ ...fields, description: e.target.value })}
          className="bg-white border-gray-200 text-xs resize-y"
        />
      </div>
      <label className="flex items-center gap-1.5 text-[11px] text-gray-600">
        <input
          type="checkbox" checked={fields.send_email} disabled={!editable}
          onChange={e => onChange({ ...fields, send_email: e.target.checked })}
        />
        Email the .ics invite to attendees on approval
      </label>
    </>
  )
}


// ──────────────────────────────────────────────────────────────────────
// Hydration helpers — read fields out of the action.payload safely.
// ──────────────────────────────────────────────────────────────────────
function emailFromPayload(action: ApiAction): EmailFields {
  const p = (action.payload ?? {}) as Record<string, unknown>
  const recipients = Array.isArray(p.recipients) ? (p.recipients as string[]) : []
  return {
    recipientsText: recipients.join(', '),
    subject: typeof p.subject === 'string' ? p.subject : '',
    body_markdown: typeof p.body_markdown === 'string' ? p.body_markdown : '',
    from_persona: (EMAIL_PERSONAS as readonly string[]).includes(String(p.from_persona))
      ? (p.from_persona as EmailFields['from_persona']) : 'system',
  }
}

function taskFromPayload(action: ApiAction): TaskFields {
  const p = (action.payload ?? {}) as Record<string, unknown>
  return {
    notes: typeof p.notes === 'string' ? p.notes : '',
    due_date: typeof action.due_date === 'string' ? action.due_date : '',
    priority: (PRIORITIES as readonly string[]).includes(String(action.priority))
      ? (action.priority as TaskFields['priority']) : '',
  }
}

function pdfFromPayload(action: ApiAction): PdfFields {
  const p = (action.payload ?? {}) as Record<string, unknown>
  return {
    report_type: (REPORT_TYPES as readonly string[]).includes(String(p.report_type))
      ? (p.report_type as PdfFields['report_type']) : 'general',
    sections: Array.isArray(p.sections)
      ? (p.sections as Section[]).map(s => ({ heading: s?.heading ?? '', body: s?.body ?? '' }))
      : [],
  }
}

function meetingFromPayload(action: ApiAction): MeetingFields {
  const p = (action.payload ?? {}) as Record<string, unknown>
  const attendees = Array.isArray(p.attendees) ? (p.attendees as string[]) : []
  return {
    attendeesText: attendees.join(', '),
    start_iso: isoToLocal(typeof p.start_iso === 'string' ? p.start_iso : ''),
    duration_minutes: typeof p.duration_minutes === 'number' ? p.duration_minutes : 30,
    description: typeof p.description === 'string' ? p.description : '',
    location: typeof p.location === 'string' ? p.location : '',
    send_email: typeof p.send_email === 'boolean' ? p.send_email : true,
  }
}
