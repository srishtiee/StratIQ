'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  FileText, Mail, CheckSquare, Calendar, Download, X,
  CheckCircle2, Loader2, AlertCircle, Plus, Trash2, RotateCcw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  useAction,
  useUpdateAction,
  useApproveAction,
  useExecuteAction,
  useDeleteAction,
  useCreateAction,
} from '@/lib/api/hooks'
import type { ApiAction, ApiActionType } from '@/lib/api/types'

// ──────────────────────────────────────────────────────────────────────
// Button classes — neutral, no coloured text. Primary = solid dark,
// Secondary = white outline, Subtle = ghost. Destructive uses Secondary
// styling and relies on confirmation step for safety.
// ──────────────────────────────────────────────────────────────────────
const BTN_BASE = 'inline-flex items-center justify-center gap-1.5 text-xs font-medium rounded-md px-3 py-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
const BTN_PRIMARY = `${BTN_BASE} bg-gray-900 text-white border border-gray-900 hover:bg-gray-800`
const BTN_SECONDARY = `${BTN_BASE} bg-white text-gray-700 border border-gray-200 hover:bg-gray-50`
const BTN_SUBTLE = `${BTN_BASE} bg-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-100 border border-transparent`

const typeIcons: Record<ApiActionType, React.ElementType> = {
  pdf_report: FileText, email_send: Mail, task: CheckSquare, meeting_ics: Calendar,
}

const typeLabels: Record<ApiActionType, string> = {
  pdf_report: 'PDF Report', email_send: 'Email', task: 'Task', meeting_ics: 'Meeting',
}

const REPORT_TYPES = ['comp_review', 'engagement_deep_dive', 'retention_plan', 'qbr_brief', 'save_plan', 'general'] as const
const EMAIL_PERSONAS = ['ceo', 'manager', 'csm', 'system'] as const
const PRIORITIES = ['low', 'medium', 'high'] as const

type Section = { heading: string; body: string }

type EmailDraft = {
  recipientsText: string
  subject: string
  body_markdown: string
  from_persona: typeof EMAIL_PERSONAS[number]
}

type TaskDraft = {
  notes: string
  due_date: string
  priority: typeof PRIORITIES[number] | ''
}

type PdfDraft = {
  report_type: typeof REPORT_TYPES[number]
  sections: Section[]
}

type MeetingDraft = {
  attendeesText: string
  start_iso: string         // datetime-local string format (YYYY-MM-DDTHH:MM)
  duration_minutes: number
  description: string
  location: string
  send_email: boolean
}

interface ActionModalProps {
  open: boolean
  onClose: () => void
  action: ApiAction | null
  /** When true and `action` is null, opens in create mode (type picker → form). */
  mode?: 'view' | 'create'
}

const EDITABLE_STATUSES = new Set<ApiAction['status']>(['draft', 'pending_approval'])
const TERMINAL_FAILED = new Set<ApiAction['status']>(['failed', 'rejected'])

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

const EMPTY_EMAIL: EmailDraft = { recipientsText: '', subject: '', body_markdown: '', from_persona: 'system' }
const EMPTY_TASK: TaskDraft = { notes: '', due_date: '', priority: '' }
const EMPTY_PDF: PdfDraft = { report_type: 'general', sections: [] }
const EMPTY_MEETING: MeetingDraft = {
  attendeesText: '', start_iso: '', duration_minutes: 30, description: '', location: '', send_email: true,
}

// Server stores `start_iso` as a full ISO 8601 string. <input type="datetime-local">
// expects "YYYY-MM-DDTHH:MM". Convert in both directions.
function isoToLocalDatetime(iso: string): string {
  if (!iso) return ''
  // Strip seconds + tz: "2026-05-08T15:00:00+00:00" → "2026-05-08T15:00"
  const m = iso.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/)
  return m ? m[1] : ''
}
function localDatetimeToIso(local: string): string {
  if (!local) return ''
  // Treat as local time, append ":00" seconds. The server's iCalendar gen will normalize to UTC.
  return /:\d{2}$/.test(local) ? local : `${local}:00`
}

export function ActionModal({ open, onClose, action: initialAction, mode = 'view' }: ActionModalProps) {
  const isCreate = mode === 'create' && !initialAction

  // Live action — polls every 1.5s while executing. Skipped in create mode.
  const { data: liveAction } = useAction(open && !isCreate ? initialAction?.id ?? null : null)
  const action = liveAction ?? initialAction

  const updateMutation = useUpdateAction()
  const approveMutation = useApproveAction()
  const executeMutation = useExecuteAction()
  const deleteMutation = useDeleteAction()
  const createMutation = useCreateAction()

  const [createType, setCreateType] = useState<ApiActionType | null>(null)
  const effectiveType: ApiActionType | null = action?.type ?? createType

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [emailDraft, setEmailDraft] = useState<EmailDraft>(EMPTY_EMAIL)
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(EMPTY_TASK)
  const [pdfDraft, setPdfDraft] = useState<PdfDraft>(EMPTY_PDF)
  const [meetingDraft, setMeetingDraft] = useState<MeetingDraft>(EMPTY_MEETING)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [hydratedFor, setHydratedFor] = useState<string | null>(null)

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteReason, setDeleteReason] = useState('')

  // Hydrate local state from a real action
  useEffect(() => {
    if (!action || isCreate) return
    if (hydratedFor === action.id) return

    setTitle(action.title ?? '')
    setDescription(action.description ?? '')
    setErrorMsg(null)
    setShowDeleteConfirm(false)
    setDeleteReason('')

    const p = (action.payload ?? {}) as Record<string, unknown>
    if (action.type === 'email_send') {
      const recipients = Array.isArray(p.recipients) ? (p.recipients as string[]) : []
      setEmailDraft({
        recipientsText: recipients.join(', '),
        subject: typeof p.subject === 'string' ? p.subject : '',
        body_markdown: typeof p.body_markdown === 'string' ? p.body_markdown : '',
        from_persona: (EMAIL_PERSONAS as readonly string[]).includes(String(p.from_persona))
          ? (p.from_persona as EmailDraft['from_persona']) : 'system',
      })
    } else if (action.type === 'task') {
      setTaskDraft({
        notes: typeof p.notes === 'string' ? p.notes : '',
        due_date: typeof action.due_date === 'string' ? action.due_date : '',
        priority: (PRIORITIES as readonly string[]).includes(String(action.priority))
          ? (action.priority as TaskDraft['priority']) : '',
      })
    } else if (action.type === 'pdf_report') {
      setPdfDraft({
        report_type: (REPORT_TYPES as readonly string[]).includes(String(p.report_type))
          ? (p.report_type as PdfDraft['report_type']) : 'general',
        sections: Array.isArray(p.sections)
          ? (p.sections as Section[]).map(s => ({ heading: s?.heading ?? '', body: s?.body ?? '' }))
          : [],
      })
    } else if (action.type === 'meeting_ics') {
      const attendees = Array.isArray(p.attendees) ? (p.attendees as string[]) : []
      setMeetingDraft({
        attendeesText: attendees.join(', '),
        start_iso: isoToLocalDatetime(typeof p.start_iso === 'string' ? p.start_iso : ''),
        duration_minutes: typeof p.duration_minutes === 'number' ? p.duration_minutes : 30,
        description: typeof p.description === 'string' ? p.description : '',
        location: typeof p.location === 'string' ? p.location : '',
        send_email: typeof p.send_email === 'boolean' ? p.send_email : true,
      })
    }
    setHydratedFor(action.id)
  }, [action, hydratedFor, isCreate])

  // Hydrate empty fields when a type is picked in create mode
  useEffect(() => {
    if (!isCreate) return
    setTitle('')
    setDescription('')
    setErrorMsg(null)
    if (createType === 'email_send') setEmailDraft(EMPTY_EMAIL)
    if (createType === 'task') setTaskDraft(EMPTY_TASK)
    if (createType === 'pdf_report') setPdfDraft(EMPTY_PDF)
    if (createType === 'meeting_ics') setMeetingDraft(EMPTY_MEETING)
  }, [isCreate, createType])

  // Reset on close
  useEffect(() => {
    if (open) return
    setHydratedFor(null)
    setCreateType(null)
    setShowDeleteConfirm(false)
    setDeleteReason('')
    setErrorMsg(null)
  }, [open])

  const editable = !!action && EDITABLE_STATUSES.has(action.status)
  const isExecuting = executeMutation.isPending || action?.status === 'executing'

  // Build the payload from local state. Returns { payload, due_date, priority } parts
  // so callers can shape the request appropriately for create vs update.
  const buildFields = useMemo(() => {
    return () => {
      const t = effectiveType
      if (!t) return null
      const out: {
        payload: Record<string, unknown>
        due_date?: string | null
        priority?: 'high' | 'medium' | 'low'
      } = { payload: {} }

      if (t === 'email_send') {
        const recipients = emailDraft.recipientsText.split(',').map(s => s.trim()).filter(Boolean)
        out.payload = {
          recipients,
          subject: emailDraft.subject,
          body_markdown: emailDraft.body_markdown,
          from_persona: emailDraft.from_persona,
        }
      } else if (t === 'task') {
        out.payload = { notes: taskDraft.notes }
        out.due_date = taskDraft.due_date || null
        if (taskDraft.priority) out.priority = taskDraft.priority
      } else if (t === 'pdf_report') {
        out.payload = {
          report_type: pdfDraft.report_type,
          sections: pdfDraft.sections.filter(s => s.heading || s.body),
        }
      } else if (t === 'meeting_ics') {
        const attendees = meetingDraft.attendeesText.split(',').map(s => s.trim()).filter(Boolean)
        out.payload = {
          title: title || 'Meeting',
          attendees,
          start_iso: localDatetimeToIso(meetingDraft.start_iso),
          duration_minutes: meetingDraft.duration_minutes,
          description: meetingDraft.description || null,
          location: meetingDraft.location || null,
          send_email: meetingDraft.send_email,
        }
      }
      return out
    }
  }, [effectiveType, title, emailDraft, taskDraft, pdfDraft, meetingDraft])

  // Existing-action update payload (only changed fields)
  function buildUpdates() {
    if (!action) return null
    const fields = buildFields()
    if (!fields) return null
    const updates: Record<string, unknown> = {}
    if (title !== (action.title ?? '')) updates.title = title
    if (description !== (action.description ?? '')) updates.description = description
    updates.payload = fields.payload
    if (action.type === 'task') {
      if (fields.due_date !== undefined && fields.due_date !== (action.due_date ?? null)) {
        updates.due_date = fields.due_date
      }
      if (fields.priority && fields.priority !== action.priority) {
        updates.priority = fields.priority
      }
    }
    return updates
  }

  // Handlers ────────────────────────────────────────────────────

  async function handlePrimary() {
    if (!action) return
    setErrorMsg(null)
    try {
      const updates = buildUpdates()
      if (updates && Object.keys(updates).length > 0 && editable) {
        await updateMutation.mutateAsync({ actionId: action.id, updates })
      }
      if (action.status === 'pending_approval') {
        await approveMutation.mutateAsync(action.id)
      }
      // Tasks are tracked todos — "Create Task" saves them as a draft; the
      // user marks them done later. Other action types execute on confirm.
      if (action.type !== 'task') {
        await executeMutation.mutateAsync(action.id)
      }
    } catch (exc) {
      setErrorMsg(exc instanceof Error ? exc.message : 'Something went wrong')
    }
  }

  async function handleMarkDone() {
    if (!action) return
    setErrorMsg(null)
    try {
      await executeMutation.mutateAsync(action.id)
    } catch (exc) {
      setErrorMsg(exc instanceof Error ? exc.message : 'Something went wrong')
    }
  }

  async function handleSaveDraft() {
    if (!action) return
    setErrorMsg(null)
    try {
      const updates = buildUpdates()
      if (updates && Object.keys(updates).length > 0) {
        await updateMutation.mutateAsync({ actionId: action.id, updates })
        setHydratedFor(null)
      }
    } catch (exc) {
      setErrorMsg(exc instanceof Error ? exc.message : 'Something went wrong')
    }
  }

  async function handleDelete() {
    if (!action) return
    setErrorMsg(null)
    try {
      await deleteMutation.mutateAsync({ actionId: action.id, reason: deleteReason || undefined })
      onClose()
    } catch (exc) {
      setErrorMsg(exc instanceof Error ? exc.message : 'Something went wrong')
      setShowDeleteConfirm(false)
    }
  }

  async function handleRetry() {
    if (!action) return
    setErrorMsg(null)
    try {
      const fields = buildFields()
      if (!fields) return
      await createMutation.mutateAsync({
        type: action.type,
        title: action.title || `Retry — ${typeLabels[action.type]}`,
        description: action.description ?? undefined,
        source_module: action.source_module ?? undefined,
        source_entity_type: (action.source_entity_type as 'employee' | 'customer' | undefined) ?? undefined,
        source_entity_id: action.source_entity_id ?? undefined,
        due_date: fields.due_date ?? undefined,
        priority: fields.priority,
        payload: fields.payload,
      })
      onClose()
    } catch (exc) {
      setErrorMsg(exc instanceof Error ? exc.message : 'Something went wrong')
    }
  }

  async function handleCreate() {
    if (!createType) return
    if (!title.trim()) {
      setErrorMsg('Title is required.')
      return
    }
    setErrorMsg(null)
    try {
      const fields = buildFields()
      if (!fields) return
      await createMutation.mutateAsync({
        type: createType,
        title: title.trim(),
        description: description.trim() || undefined,
        due_date: fields.due_date ?? undefined,
        priority: fields.priority,
        payload: fields.payload,
      })
      onClose()
    } catch (exc) {
      setErrorMsg(exc instanceof Error ? exc.message : 'Something went wrong')
    }
  }

  function handleClose() {
    setErrorMsg(null)
    setHydratedFor(null)
    onClose()
  }

  // Empty state
  if (!action && !isCreate) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md border-[#e8e8ef] p-6 bg-white text-sm text-gray-500">
          No action selected.
        </DialogContent>
      </Dialog>
    )
  }

  // Create-mode type picker
  if (isCreate && !createType) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent showCloseButton={false} className="max-w-md border-[#e8e8ef] p-0 overflow-hidden bg-white">
          <div className="px-5 pt-5 pb-3 flex items-start justify-between">
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">New Action</p>
              <h2 className="text-sm font-medium text-gray-900 mt-0.5">Pick a type</h2>
            </div>
            <button onClick={handleClose} className={cn(BTN_SUBTLE, 'h-7 w-7 p-0')}>
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="px-5 pb-5 space-y-2">
            {(['task', 'email_send', 'meeting_ics', 'pdf_report'] as ApiActionType[]).map(t => {
              const Icon = typeIcons[t]
              return (
                <button
                  key={t}
                  onClick={() => setCreateType(t)}
                  className="w-full text-left flex items-center gap-3 p-3 rounded-md border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{typeLabels[t]}</p>
                    <p className="text-[11px] text-gray-500">
                      {t === 'task' && 'Track a follow-up or todo. No external side effect.'}
                      {t === 'email_send' && 'Compose an email; needs approval before sending.'}
                      {t === 'meeting_ics' && 'Schedule a meeting; generates a calendar invite (.ics) and emails it.'}
                      {t === 'pdf_report' && 'Generate a PDF with sections and download a signed URL.'}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // From here: render the body. effectiveType is guaranteed non-null.
  const Icon = effectiveType ? typeIcons[effectiveType] : FileText
  const typeLabel = effectiveType ? typeLabels[effectiveType] : 'Action'

  // Primary button label, by mode + status
  const primaryLabel = (() => {
    if (isCreate) return 'Save Draft'
    if (!action) return ''
    if (TERMINAL_FAILED.has(action.status)) return 'Retry as Draft'
    if (action.status === 'pending_approval') return 'Approve & Send'
    if (action.type === 'email_send') return 'Send Email'
    if (action.type === 'meeting_ics') return 'Send Invite'
    if (action.type === 'task') return 'Create Task'
    return 'Generate'
  })()

  const showFieldsView = (
    isCreate ||
    (action && !isExecuting && !TERMINAL_FAILED.has(action.status) && action.status !== 'completed')
  )

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent showCloseButton={false} className="max-w-lg border-gray-200 p-0 overflow-hidden bg-white">
        {/* Header */}
        <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3 border-b border-gray-100">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-md bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-gray-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">
                {isCreate ? 'New ' + typeLabel : typeLabel}
              </p>
              {action && (
                <Badge className={cn('text-[10px] mt-0.5 font-medium', statusBadgeClass(action.status))}>
                  {action.status.replace('_', ' ')}
                </Badge>
              )}
            </div>
          </div>
          <button onClick={handleClose} className={cn(BTN_SUBTLE, 'h-7 w-7 p-0')}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 max-h-[68vh] overflow-y-auto">
          <AnimatePresence mode="wait">
            {/* Executing */}
            {action && isExecuting && action.status !== 'completed' && (
              <motion.div
                key="executing"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="py-8 text-center"
              >
                <div className="w-12 h-12 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center mx-auto mb-3">
                  <Loader2 className="w-6 h-6 text-gray-600 animate-spin" />
                </div>
                <h3 className="font-medium text-gray-900 mb-1">
                  {action.type === 'pdf_report' ? 'Generating report…' :
                    action.type === 'email_send' ? 'Sending email…' :
                    action.type === 'meeting_ics' ? 'Creating calendar invite…' :
                    'Creating task…'}
                </h3>
                <p className="text-xs text-gray-500">Usually takes a few seconds.</p>
              </motion.div>
            )}

            {/* Completed */}
            {action && !isExecuting && action.status === 'completed' && (
              <motion.div
                key="completed"
                initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
                className="space-y-3"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-gray-700" />
                  <p className="text-sm font-medium text-gray-900">
                    {action.type === 'pdf_report' ? 'Report generated' :
                      action.type === 'email_send' ? 'Email sent' :
                      action.type === 'meeting_ics' ? 'Calendar invite sent' :
                      'Task tracked'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-800">{action.title}</p>
                  {action.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{action.description}</p>
                  )}
                </div>

                {action.type === 'pdf_report' && (action.result as Record<string, unknown> | null)?.signed_url ? (
                  <a
                    href={(action.result as Record<string, unknown>).signed_url as string}
                    target="_blank"
                    rel="noreferrer"
                    className={BTN_PRIMARY + ' w-fit'}
                  >
                    <Download className="w-3.5 h-3.5" /> Download PDF
                  </a>
                ) : action.type === 'email_send' && action.result ? (
                  <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700 space-y-1">
                    <p>
                      Sent to <span className="font-medium">
                        {Array.isArray((action.result as Record<string, unknown>).recipients)
                          ? ((action.result as Record<string, unknown>).recipients as string[]).join(', ')
                          : '—'}
                      </span>
                    </p>
                    {typeof (action.result as Record<string, unknown>).subject === 'string' && (
                      <p className="text-gray-500">Subject: {(action.result as Record<string, unknown>).subject as string}</p>
                    )}
                  </div>
                ) : action.type === 'meeting_ics' && action.result ? (
                  <div className="space-y-2">
                    <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700 space-y-1">
                      <p>
                        Invited <span className="font-medium">
                          {Array.isArray((action.result as Record<string, unknown>).attendees)
                            ? ((action.result as Record<string, unknown>).attendees as string[]).join(', ')
                            : '—'}
                        </span>
                      </p>
                      {typeof (action.result as Record<string, unknown>).start_iso === 'string' && (
                        <p className="text-gray-500">
                          When: {(action.result as Record<string, unknown>).start_iso as string}
                          {' · '}
                          {(action.result as Record<string, unknown>).duration_minutes as number} min
                        </p>
                      )}
                    </div>
                    {(action.result as Record<string, unknown>).signed_url ? (
                      <a
                        href={(action.result as Record<string, unknown>).signed_url as string}
                        target="_blank"
                        rel="noreferrer"
                        className={BTN_SECONDARY + ' w-fit'}
                      >
                        <Download className="w-3.5 h-3.5" /> Download .ics
                      </a>
                    ) : null}
                  </div>
                ) : action.type === 'task' ? (
                  <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
                    Task tracked. {action.due_date && <>Due {action.due_date}.</>}{' '}
                    {action.priority && <>Priority: {action.priority}.</>}
                  </div>
                ) : null}
              </motion.div>
            )}

            {/* Failed / Rejected */}
            {action && !isExecuting && TERMINAL_FAILED.has(action.status) && (
              <motion.div
                key="failed"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="space-y-3"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-gray-700" />
                  <p className="text-sm font-medium text-gray-900">
                    {action.status === 'rejected' ? 'Rejected' : 'Failed'}
                  </p>
                </div>
                <p className="text-xs font-medium text-gray-800">{action.title}</p>
                {action.rejected_reason && (
                  <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
                    {action.rejected_reason}
                  </div>
                )}
              </motion.div>
            )}

            {/* Editable / create form */}
            {showFieldsView && effectiveType && (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="space-y-3"
              >
                <div>
                  <Label className="text-xs text-gray-500 mb-1 block">Title</Label>
                  <Input
                    value={title}
                    disabled={!isCreate && !editable}
                    onChange={e => setTitle(e.target.value)}
                    className="bg-white border-gray-200 text-sm"
                  />
                </div>

                {(isCreate || description) && (
                  <div>
                    <Label className="text-xs text-gray-500 mb-1 block">Description</Label>
                    <Textarea
                      value={description}
                      disabled={!isCreate && !editable}
                      rows={2}
                      onChange={e => setDescription(e.target.value)}
                      className="bg-white border-gray-200 text-sm resize-y"
                    />
                  </div>
                )}

                {effectiveType === 'email_send' && (
                  <>
                    <div>
                      <Label className="text-xs text-gray-500 mb-1 block">Recipients (comma-separated)</Label>
                      <Input
                        value={emailDraft.recipientsText}
                        disabled={!isCreate && !editable}
                        onChange={e => setEmailDraft({ ...emailDraft, recipientsText: e.target.value })}
                        placeholder="recipient@example.com"
                        className="bg-white border-gray-200 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 mb-1 block">Subject</Label>
                      <Input
                        value={emailDraft.subject}
                        disabled={!isCreate && !editable}
                        onChange={e => setEmailDraft({ ...emailDraft, subject: e.target.value })}
                        className="bg-white border-gray-200 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 mb-1 block">Body (markdown)</Label>
                      <Textarea
                        value={emailDraft.body_markdown}
                        disabled={!isCreate && !editable}
                        rows={6}
                        onChange={e => setEmailDraft({ ...emailDraft, body_markdown: e.target.value })}
                        className="bg-white border-gray-200 text-sm resize-y font-mono"
                      />
                    </div>
                  </>
                )}

                {effectiveType === 'meeting_ics' && (
                  <>
                    <div>
                      <Label className="text-xs text-gray-500 mb-1 block">Attendees (comma-separated emails)</Label>
                      <Input
                        value={meetingDraft.attendeesText}
                        disabled={!isCreate && !editable}
                        onChange={e => setMeetingDraft({ ...meetingDraft, attendeesText: e.target.value })}
                        placeholder="alice@example.com, bob@example.com"
                        className="bg-white border-gray-200 text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-gray-500 mb-1 block">Start (date & time)</Label>
                        <Input
                          type="datetime-local"
                          value={meetingDraft.start_iso}
                          disabled={!isCreate && !editable}
                          onChange={e => setMeetingDraft({ ...meetingDraft, start_iso: e.target.value })}
                          className="bg-white border-gray-200 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500 mb-1 block">Duration (minutes)</Label>
                        <Input
                          type="number"
                          min={5}
                          max={480}
                          step={5}
                          value={meetingDraft.duration_minutes}
                          disabled={!isCreate && !editable}
                          onChange={e => setMeetingDraft({ ...meetingDraft, duration_minutes: Number(e.target.value) || 30 })}
                          className="bg-white border-gray-200 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 mb-1 block">Location (optional)</Label>
                      <Input
                        value={meetingDraft.location}
                        disabled={!isCreate && !editable}
                        onChange={e => setMeetingDraft({ ...meetingDraft, location: e.target.value })}
                        placeholder="Google Meet, Zoom, conference room…"
                        className="bg-white border-gray-200 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 mb-1 block">Agenda / description</Label>
                      <Textarea
                        value={meetingDraft.description}
                        disabled={!isCreate && !editable}
                        rows={4}
                        onChange={e => setMeetingDraft({ ...meetingDraft, description: e.target.value })}
                        className="bg-white border-gray-200 text-sm resize-y"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={meetingDraft.send_email}
                        disabled={!isCreate && !editable}
                        onChange={e => setMeetingDraft({ ...meetingDraft, send_email: e.target.checked })}
                      />
                      Email the .ics invite to attendees on approval
                    </label>
                  </>
                )}

                {effectiveType === 'task' && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-gray-500 mb-1 block">Due date</Label>
                        <Input
                          type="date"
                          value={taskDraft.due_date}
                          disabled={!isCreate && !editable}
                          onChange={e => setTaskDraft({ ...taskDraft, due_date: e.target.value })}
                          className="bg-white border-gray-200 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500 mb-1 block">Priority</Label>
                        <select
                          value={taskDraft.priority || ''}
                          disabled={!isCreate && !editable}
                          onChange={e => setTaskDraft({ ...taskDraft, priority: e.target.value as TaskDraft['priority'] })}
                          className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white"
                        >
                          <option value="">—</option>
                          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 mb-1 block">Notes</Label>
                      <Textarea
                        value={taskDraft.notes}
                        disabled={!isCreate && !editable}
                        rows={4}
                        onChange={e => setTaskDraft({ ...taskDraft, notes: e.target.value })}
                        className="bg-white border-gray-200 text-sm resize-y"
                      />
                    </div>
                  </>
                )}

                {effectiveType === 'pdf_report' && (
                  <>
                    <div>
                      <Label className="text-xs text-gray-500 mb-1 block">Report type</Label>
                      <select
                        value={pdfDraft.report_type}
                        disabled={!isCreate && !editable}
                        onChange={e => setPdfDraft({ ...pdfDraft, report_type: e.target.value as PdfDraft['report_type'] })}
                        className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white"
                      >
                        {REPORT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                      </select>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label className="text-xs text-gray-500">Sections</Label>
                        {(isCreate || editable) && (
                          <button
                            className={cn(BTN_SECONDARY, 'h-6 px-2 text-[11px]')}
                            onClick={() => setPdfDraft({
                              ...pdfDraft,
                              sections: [...pdfDraft.sections, { heading: '', body: '' }],
                            })}
                          >
                            <Plus className="w-3 h-3" /> Add section
                          </button>
                        )}
                      </div>
                      <div className="space-y-2">
                        {pdfDraft.sections.length === 0 && (
                          <p className="text-xs text-gray-400 italic">No sections yet.</p>
                        )}
                        {pdfDraft.sections.map((section, i) => (
                          <div key={i} className="border border-gray-200 rounded-md p-2 space-y-1.5 bg-gray-50">
                            <div className="flex items-start gap-2">
                              <Input
                                value={section.heading}
                                disabled={!isCreate && !editable}
                                placeholder="Heading"
                                onChange={e => {
                                  const next = [...pdfDraft.sections]
                                  next[i] = { ...next[i], heading: e.target.value }
                                  setPdfDraft({ ...pdfDraft, sections: next })
                                }}
                                className="bg-white border-gray-200 text-sm h-7"
                              />
                              {(isCreate || editable) && (
                                <button
                                  onClick={() => setPdfDraft({ ...pdfDraft, sections: pdfDraft.sections.filter((_, j) => j !== i) })}
                                  className={cn(BTN_SUBTLE, 'h-7 w-7 p-0')}
                                  aria-label="Remove section"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                            <Textarea
                              value={section.body}
                              disabled={!isCreate && !editable}
                              rows={3}
                              placeholder="Body…"
                              onChange={e => {
                                const next = [...pdfDraft.sections]
                                next[i] = { ...next[i], body: e.target.value }
                                setPdfDraft({ ...pdfDraft, sections: next })
                              }}
                              className="bg-white border-gray-200 text-sm resize-y"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {errorMsg && (
            <div className="mt-3 rounded-md border border-gray-300 bg-gray-50 p-2 text-xs text-gray-700">
              {errorMsg}
            </div>
          )}

          {/* Delete confirm — soft delete, optional reason */}
          {action && showDeleteConfirm && (
            <div className="mt-3 border-t border-gray-100 pt-3 space-y-2">
              <p className="text-xs text-gray-700">
                Delete this action? It will be hidden from all views and logged.
              </p>
              <Label className="text-xs text-gray-500 block">Reason (optional)</Label>
              <Textarea
                value={deleteReason}
                rows={2}
                onChange={e => setDeleteReason(e.target.value)}
                placeholder="Why are you deleting this?"
                className="bg-white border-gray-200 text-sm resize-y"
              />
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setShowDeleteConfirm(false); setDeleteReason('') }} className={BTN_SECONDARY}>
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  className={BTN_PRIMARY}
                >
                  {deleteMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  Confirm delete
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/40 flex items-center justify-between gap-2">
          {/* Left — Delete (only when not in confirm flow) */}
          <div className="flex gap-2">
            {action && !isExecuting && action.status !== 'executing' && !showDeleteConfirm && (
              <button onClick={() => setShowDeleteConfirm(true)} className={BTN_SECONDARY}>
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            )}
          </div>

          {/* Right — primary path */}
          <div className="flex gap-2">
            {action && editable && !showDeleteConfirm && (
              <button
                onClick={handleSaveDraft}
                disabled={updateMutation.isPending}
                className={BTN_SECONDARY}
              >
                {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                Save
              </button>
            )}

            {!showDeleteConfirm && (
              <>
                {isCreate && (
                  <button
                    onClick={handleCreate}
                    disabled={createMutation.isPending}
                    className={BTN_PRIMARY}
                  >
                    {createMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                    {primaryLabel}
                  </button>
                )}
                {!isCreate && action && TERMINAL_FAILED.has(action.status) && (
                  <button
                    onClick={handleRetry}
                    disabled={createMutation.isPending}
                    className={BTN_PRIMARY}
                  >
                    {createMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                    {primaryLabel}
                  </button>
                )}
                {!isCreate && action && action.status === 'completed' && (
                  <button onClick={handleClose} className={BTN_SECONDARY}>
                    Close
                  </button>
                )}
                {!isCreate && action && !TERMINAL_FAILED.has(action.status) && action.status !== 'completed' && (
                  <>
                    {action.type === 'task' && action.status === 'draft' && (
                      <button
                        onClick={handleMarkDone}
                        disabled={executeMutation.isPending || isExecuting}
                        className={BTN_SECONDARY}
                      >
                        {executeMutation.isPending || isExecuting ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3" />
                        )}
                        Mark Done
                      </button>
                    )}
                    <button
                      onClick={handlePrimary}
                      disabled={
                        isExecuting ||
                        updateMutation.isPending ||
                        approveMutation.isPending ||
                        executeMutation.isPending
                      }
                      className={BTN_PRIMARY}
                    >
                      {(updateMutation.isPending || approveMutation.isPending || executeMutation.isPending || isExecuting) && (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      )}
                      {primaryLabel}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
