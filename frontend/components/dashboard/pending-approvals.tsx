'use client'

import { useState } from 'react'
import { FileText, Mail, CheckSquare, Calendar, Loader2, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react'
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

const COLLAPSED_COUNT = 4

interface Props {
  onSelect?: (a: ApiAction) => void
}

export function PendingApprovals({ onSelect }: Props) {
  const { data: actions = [], isLoading } = useActions()
  const pending = actions.filter((a: ApiAction) => a.status === 'pending_approval')
  const [expanded, setExpanded] = useState(false)

  const visible = expanded ? pending : pending.slice(0, COLLAPSED_COUNT)
  const hiddenCount = Math.max(pending.length - COLLAPSED_COUNT, 0)

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 self-start">
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
        <>
          <div className={expanded ? 'space-y-2 max-h-[480px] overflow-y-auto pr-1' : 'space-y-2'}>
            {visible.map((action: ApiAction) => {
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
          {hiddenCount > 0 && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="mt-2 w-full flex items-center justify-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-700 font-medium py-1.5 rounded-md hover:bg-indigo-50/50 transition-colors"
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-3 h-3" /> Show less
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" /> See more ({hiddenCount})
                </>
              )}
            </button>
          )}
        </>
      )}
    </div>
  )
}
