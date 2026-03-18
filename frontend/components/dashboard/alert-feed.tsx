'use client'

import { useState } from 'react'
import { AlertTriangle, Zap, Clock, CheckCircle2, Upload, Loader2, Check } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { useAlerts } from '@/lib/api/hooks'
import { apiFetch } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/store'
import type { ApiNotification, ApiAction } from '@/lib/api/types'

const typeConfig: Record<string, { icon: React.ElementType; dot: string; text: string; bg: string; resolvable: boolean }> = {
  scores_updated:          { icon: AlertTriangle, dot: 'bg-red-500',    text: 'text-red-400',    bg: 'border-red-500/20',   resolvable: true },
  action_pending_approval: { icon: Zap,           dot: 'bg-amber-500',  text: 'text-amber-400',  bg: 'border-amber-500/20', resolvable: false },
  action_completed:        { icon: CheckCircle2,  dot: 'bg-green-500',  text: 'text-green-400',  bg: 'border-green-500/20', resolvable: false },
  action_failed:           { icon: AlertTriangle, dot: 'bg-red-500',    text: 'text-red-400',    bg: 'border-red-500/20',   resolvable: true },
  upload_complete:         { icon: Upload,        dot: 'bg-green-500',  text: 'text-green-400',  bg: 'border-green-500/20', resolvable: false },
}

const defaultConfig = { icon: AlertTriangle, dot: 'bg-gray-400', text: 'text-gray-400', bg: 'border-gray-200', resolvable: true }

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days > 1 ? 's' : ''} ago`
}

function useResolveAlert() {
  const auth = useAuth()
  const orgId = auth?.orgId ?? ''
  const userId = auth?.userId ?? ''
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (alert: ApiNotification) => {
      const created = await apiFetch<ApiAction>(`/actions/`, {
        method: 'POST',
        body: JSON.stringify({
          org_id: orgId,
          user_id: userId,
          type: 'task',
          title: `Follow up: ${(alert.message ?? '').slice(0, 80)}`,
          description: alert.message ?? '',
          source_module: 'dashboard',
          payload: { notes: alert.message ?? '' },
        }),
      })
      // Auto-execute task (low tier)
      return apiFetch<ApiAction>(
        `/actions/${created.id}/execute?org_id=${orgId}&user_id=${userId}`,
        { method: 'POST' }
      ).catch(() => created)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['actions', orgId] }),
  })
}

export function AlertFeed() {
  const { data: alerts = [], isLoading } = useAlerts()
  const { mutate: resolve, isPending } = useResolveAlert()
  const [resolved, setResolved] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState<string | null>(null)

  return (
    <div className="rounded-xl border border-[#e8e8ef] bg-white shadow-sm p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900">Alert Feed</h3>
        <span className="text-xs text-gray-400">{isLoading ? '…' : `${alerts.length} alerts`}</span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-6 text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading alerts…
          </div>
        ) : alerts.length === 0 ? (
          <p className="text-xs text-gray-400 py-4 text-center">No unread alerts.</p>
        ) : (
          alerts.map((alert: ApiNotification) => {
            const config = typeConfig[alert.type ?? ''] ?? defaultConfig
            const Icon = config.icon
            const isResolved = resolved.has(alert.id)
            const isPendingThis = pending === alert.id
            return (
              <div
                key={alert.id}
                className={cn('flex items-start gap-2.5 p-2.5 rounded-lg border border-[#e8e8ef]', config.bg)}
              >
                <div className="flex items-center gap-1.5 mt-0.5 shrink-0">
                  <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', config.dot)} />
                  <Icon className={cn('w-3.5 h-3.5', config.text)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-700 leading-snug">{alert.message}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="w-2.5 h-2.5 text-gray-400" />
                    <span className="text-[10px] text-gray-400">{relativeTime(alert.created_at)}</span>
                    {config.resolvable && !isResolved && (
                      <button
                        onClick={() => {
                          setPending(alert.id)
                          resolve(alert, {
                            onSuccess: () => {
                              setResolved(prev => new Set(prev).add(alert.id))
                              setPending(null)
                            },
                            onError: () => setPending(null),
                          })
                        }}
                        disabled={isPending || isPendingThis}
                        className="text-[10px] text-indigo-600 hover:text-indigo-700 hover:underline disabled:opacity-50 inline-flex items-center gap-0.5"
                      >
                        {isPendingThis ? (
                          <><Loader2 className="w-2.5 h-2.5 animate-spin" /> Resolving…</>
                        ) : (
                          'Resolve as task ▸'
                        )}
                      </button>
                    )}
                    {isResolved && (
                      <span className="text-[10px] text-green-600 inline-flex items-center gap-0.5">
                        <Check className="w-2.5 h-2.5" /> Task created
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
