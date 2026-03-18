'use client'

import { FileText, Mail, CheckSquare, Calendar, Loader2, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useActions } from '@/lib/api/hooks'
import type { ApiAction } from '@/lib/api/types'

const typeIcons: Record<string, React.ElementType> = {
  pdf_report: FileText,
  email_send: Mail,
  task: CheckSquare,
  meeting_ics: Calendar,
}

const moduleLabel: Record<string, string> = {
  people: 'People Intelligence',
  retention: 'Customer Retention',
  dashboard: 'Executive KPI',
}

interface Props {
  onSelect?: (a: ApiAction) => void
}

export function PendingApprovals({ onSelect }: Props) {
  const { data: actions = [], isLoading } = useActions()
  const pending = actions.filter((a: ApiAction) => a.status === 'pending_approval')

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900">Pending Approvals</h3>
        <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-[10px]">
          {isLoading ? '…' : `${pending.length} pending`}
        </Badge>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-4 text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…
        </div>
      ) : pending.length === 0 ? (
        <p className="text-xs text-gray-400 py-2 text-center">No pending approvals.</p>
      ) : (
        <div className="space-y-2">
          {pending.map((action: ApiAction) => {
            const Icon = typeIcons[action.type] ?? FileText
            return (
              <button
                key={action.id}
                onClick={() => onSelect?.(action)}
                disabled={!onSelect}
                className="flex items-center gap-3 p-3 rounded-md border border-gray-200 hover:bg-gray-50 transition-colors w-full text-left"
              >
                <div className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center shrink-0">
                  <Icon className="w-3.5 h-3.5 text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">{action.title}</p>
                  <p className="text-[10px] text-gray-500">
                    {moduleLabel[action.source_module ?? ''] ?? action.source_module}
                  </p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
