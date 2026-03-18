'use client'

import { FileText, Mail, CheckSquare, Calendar, Clock, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useActions } from '@/lib/api/hooks'
import type { ApiAction } from '@/lib/api/types'
import Link from 'next/link'

const typeIcons: Record<string, React.ElementType> = {
  pdf_report: FileText,
  email_send: Mail,
  task: CheckSquare,
  meeting_ics: Calendar,
}

const statusConfig: Record<string, { color: string; label: string }> = {
  completed: { color: 'bg-emerald-50 text-emerald-800 border-emerald-200', label: 'Completed' },
  executing: { color: 'bg-indigo-50 text-indigo-800 border-indigo-200', label: 'Executing' },
  failed:    { color: 'bg-rose-50 text-rose-800 border-rose-200',         label: 'Failed' },
  approved:  { color: 'bg-blue-50 text-blue-800 border-blue-200',         label: 'Approved' },
}

const moduleLabel: Record<string, string> = {
  people: 'People Intelligence',
  retention: 'Customer Retention',
  dashboard: 'Executive KPI',
}

interface Props {
  onSelect?: (a: ApiAction) => void
}

export function RecentActions({ onSelect }: Props) {
  const { data: actions = [], isLoading } = useActions()

  const recent = actions
    .filter((a: ApiAction) => ['completed', 'executing', 'approved'].includes(a.status))
    .slice(0, 5)

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900">Recent Actions</h3>
        <Link href="/actions">
          <span className="text-xs text-gray-500 hover:text-gray-900 cursor-pointer">View all →</span>
        </Link>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-4 text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…
        </div>
      ) : (
        <div className="space-y-2">
          {recent.map((action: ApiAction) => {
            const Icon = typeIcons[action.type] ?? FileText
            const status = statusConfig[action.status] ?? statusConfig.completed
            const timeStr = new Date(action.executed_at ?? action.created_at).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric',
            })
            return (
              <button
                key={action.id}
                onClick={() => onSelect?.(action)}
                disabled={!onSelect}
                className="flex items-center gap-2.5 p-2 rounded-md hover:bg-gray-50 transition-colors w-full text-left"
              >
                <div className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center shrink-0">
                  <Icon className="w-3.5 h-3.5 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">{action.title}</p>
                  <p className="text-[10px] text-gray-500">
                    {moduleLabel[action.source_module ?? ''] ?? action.source_module}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className={cn('text-[10px] px-1.5 py-0 h-4', status.color)}>{status.label}</Badge>
                  <div className="flex items-center gap-0.5 text-[10px] text-gray-500">
                    <Clock className="w-2.5 h-2.5" />
                    {timeStr}
                  </div>
                </div>
              </button>
            )
          })}
          {recent.length === 0 && (
            <p className="text-xs text-gray-400 italic text-center py-2">No recent actions.</p>
          )}
        </div>
      )}
    </div>
  )
}
