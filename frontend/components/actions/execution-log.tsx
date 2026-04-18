'use client'

import { CheckCircle2, XCircle, Clock, Loader2, FileText, Mail, CheckSquare, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useActions } from '@/lib/api/hooks'
import type { ApiAction } from '@/lib/api/types'

const typeIcons: Record<string, React.ElementType> = {
  pdf_report: FileText,
  email_send: Mail,
  task: CheckSquare,
  meeting_ics: Calendar,
}

function statusIcon(status: string) {
  if (status === 'completed') return <CheckCircle2 className="w-3.5 h-3.5 text-gray-700" />
  if (status === 'failed' || status === 'rejected') return <XCircle className="w-3.5 h-3.5 text-gray-700" />
  if (status === 'executing') return <Loader2 className="w-3.5 h-3.5 text-gray-700 animate-spin" />
  return <Clock className="w-3.5 h-3.5 text-gray-700" />
}

function statusBg(status: string) {
  if (status === 'completed') return 'bg-emerald-50 border-emerald-200'
  if (status === 'failed' || status === 'rejected') return 'bg-rose-50 border-rose-200'
  if (status === 'executing') return 'bg-indigo-50 border-indigo-200'
  return 'bg-amber-50 border-amber-200'
}

function eventLabel(action: ApiAction): string {
  const labels: Record<string, Record<string, string>> = {
    completed: { email_send: 'Email sent', pdf_report: 'Report generated', task: 'Task created' },
    failed:    { email_send: 'Email failed', pdf_report: 'Report failed', task: 'Task failed' },
    executing: { email_send: 'Sending email…', pdf_report: 'Generating report…', task: 'Creating task…' },
  }
  return labels[action.status]?.[action.type] ?? 'Action created'
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const diffMs = Date.now() - d.getTime()
  const hours = Math.floor(diffMs / 3600000)
  if (hours < 24) return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

interface Props {
  onSelect?: (a: ApiAction) => void
}

export function ExecutionLog({ onSelect }: Props) {
  const { data: actions = [], isLoading } = useActions()

  const logEntries = actions
    .filter((a: ApiAction) => ['completed', 'failed', 'rejected', 'executing', 'pending_approval'].includes(a.status))
    .slice(0, 8)

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
      <h3 className="text-sm font-medium text-gray-900 mb-4">Execution Log</h3>
      {isLoading ? (
        <div className="flex items-center justify-center py-6 text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-[13px] top-0 bottom-0 w-px bg-gray-200" />
          <div className="space-y-3">
            {logEntries.map((action: ApiAction) => {
              const Icon = typeIcons[action.type] ?? FileText
              const interactive = !!onSelect
              return (
                <button
                  key={action.id}
                  onClick={() => onSelect?.(action)}
                  disabled={!interactive}
                  className={cn(
                    'flex gap-3 relative w-full text-left rounded-md',
                    interactive && 'hover:bg-gray-50 -mx-1 px-1 py-0.5 transition-colors cursor-pointer',
                  )}
                >
                  <div className={cn('w-6 h-6 rounded-full border flex items-center justify-center shrink-0 z-10', statusBg(action.status))}>
                    {statusIcon(action.status)}
                  </div>
                  <div className="flex-1 pb-2 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-gray-700 truncate">{eventLabel(action)}</span>
                      <span className="text-[10px] text-gray-500 shrink-0">{formatTime(action.executed_at ?? action.created_at)}</span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                      <Icon className="w-2.5 h-2.5 inline-block mr-1 align-baseline" />
                      {action.title}
                    </p>
                  </div>
                </button>
              )
            })}
            {logEntries.length === 0 && (
              <p className="text-xs text-gray-400 italic ml-9">No recent activity.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
