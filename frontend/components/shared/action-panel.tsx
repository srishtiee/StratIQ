'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { ActionModal } from './action-modal'
import { FileText, Mail, CheckSquare, Calendar, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/store'
import type { ApiAction, ApiActionType } from '@/lib/api/types'

interface ActionSuggestion {
  type: ApiActionType
  title: string
  description: string
  source_module?: 'people' | 'retention' | 'dashboard'
}

interface ActionPanelProps {
  actions: ActionSuggestion[]
  className?: string
}

const typeIcons: Record<ApiActionType, React.ElementType> = {
  pdf_report: FileText,
  email_send: Mail,
  task: CheckSquare,
  meeting_ics: Calendar,
}

const typeColors: Record<ApiActionType, string> = {
  pdf_report: 'bg-gray-50 text-gray-700 border-gray-200',
  email_send: 'bg-gray-50 text-gray-700 border-gray-200',
  task: 'bg-gray-50 text-gray-700 border-gray-200',
  meeting_ics: 'bg-gray-50 text-gray-700 border-gray-200',
}

const typeLabels: Record<ApiActionType, string> = {
  pdf_report: 'PDF Report',
  email_send: 'Email',
  task: 'Task',
  meeting_ics: 'Meeting',
}

function buildPayload(suggestion: ActionSuggestion): Record<string, unknown> {
  if (suggestion.type === 'task') {
    return { notes: suggestion.description }
  }
  if (suggestion.type === 'email_send') {
    return {
      recipients: ['recipient@example.com'],
      subject: suggestion.title,
      body_markdown: suggestion.description,
      from_persona: 'system' as const,
    }
  }
  if (suggestion.type === 'meeting_ics') {
    // Caller will edit attendees + start before approving in the modal.
    return {
      title: suggestion.title,
      attendees: ['recipient@example.com'],
      start_iso: new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 19),
      duration_minutes: 30,
      description: suggestion.description,
      send_email: true,
    }
  }
  return {
    report_type: 'general' as const,
    sections: [{ heading: 'Summary', body: suggestion.description }],
  }
}

export function ActionPanel({ actions, className }: ActionPanelProps) {
  const auth = useAuth()
  const orgId = auth?.orgId ?? ''
  const userId = auth?.userId ?? ''
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [createdAction, setCreatedAction] = useState<ApiAction | null>(null)
  const [pendingIndex, setPendingIndex] = useState<number | null>(null)

  const createMutation = useMutation({
    mutationFn: (suggestion: ActionSuggestion) =>
      apiFetch<ApiAction>(`/actions/`, {
        method: 'POST',
        body: JSON.stringify({
          org_id: orgId,
          user_id: userId,
          type: suggestion.type,
          title: suggestion.title,
          description: suggestion.description,
          source_module: suggestion.source_module ?? 'dashboard',
          payload: buildPayload(suggestion),
        }),
      }),
    onSuccess: (action) => {
      queryClient.invalidateQueries({ queryKey: ['actions', orgId] })
      setCreatedAction(action)
      setModalOpen(true)
    },
    onSettled: () => setPendingIndex(null),
  })

  return (
    <>
      <div className={cn('flex flex-col gap-2', className)}>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Suggested Actions</p>
        {actions.map((action, i) => {
          const Icon = typeIcons[action.type]
          const colors = typeColors[action.type]
          const pending = pendingIndex === i && createMutation.isPending
          return (
            <div
              key={i}
              className="bg-gray-50 border border-[#e8e8ef] rounded-lg p-3 hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors"
            >
              <div className="flex items-start gap-2 mb-2">
                <div className={cn('w-6 h-6 rounded-md border flex items-center justify-center shrink-0 mt-0.5', colors)}>
                  <Icon className="w-3 h-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">{typeLabels[action.type]}</p>
                  <p className="text-xs font-medium text-gray-800 leading-tight">{action.title}</p>
                </div>
              </div>
              <p className="text-[11px] text-gray-500 mb-2.5 leading-relaxed">{action.description}</p>
              <Button
                size="sm"
                disabled={pending}
                className="w-full h-6 text-xs bg-white hover:bg-indigo-50 text-indigo-600 border border-indigo-200 hover:border-indigo-300 gap-1"
                onClick={() => {
                  setPendingIndex(i)
                  createMutation.mutate(action)
                }}
              >
                {pending ? (
                  <><Loader2 className="w-3 h-3 animate-spin" /> Drafting…</>
                ) : (
                  <>Execute <ChevronRight className="w-3 h-3" /></>
                )}
              </Button>
            </div>
          )
        })}
      </div>
      <ActionModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setCreatedAction(null) }}
        action={createdAction}
      />
    </>
  )
}
