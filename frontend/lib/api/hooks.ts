'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch, API_BASE } from './client'
import { useAuth } from '@/lib/auth/store'
import type { Source } from './query-stream'
import type {
  ApiEmployee,
  ApiEmployeeDetail,
  ApiCustomer,
  ApiCustomerDetail,
  ApiAction,
  ApiKpi,
  ApiKpiHistory,
  ApiNotification,
  ApiUploadedFile,
  PeopleSummary,
  RetentionSummary,
} from './types'

export function useEmployees(department?: string) {
  const auth = useAuth()
  const orgId = auth?.orgId ?? ''
  return useQuery({
    queryKey: ['employees', orgId, department],
    queryFn: () =>
      apiFetch<{ data: ApiEmployee[]; count: number }>(
        `/people/employees?org_id=${orgId}${department ? `&department=${encodeURIComponent(department)}` : ''}`
      ).then(r => r.data),
    enabled: !!orgId,
  })
}

export function useEmployee(employeeId: string | null) {
  const auth = useAuth()
  const orgId = auth?.orgId ?? ''
  return useQuery({
    queryKey: ['employee', employeeId, orgId],
    queryFn: () =>
      apiFetch<ApiEmployeeDetail>(
        `/people/employees/${employeeId}?org_id=${orgId}`
      ),
    enabled: !!employeeId && !!orgId,
  })
}

export function usePeopleSummary(department?: string) {
  const auth = useAuth()
  const orgId = auth?.orgId ?? ''
  return useQuery({
    queryKey: ['people-summary', orgId, department],
    queryFn: () =>
      apiFetch<PeopleSummary>(
        `/people/summary?org_id=${orgId}${department ? `&department=${encodeURIComponent(department)}` : ''}`
      ),
    enabled: !!orgId,
  })
}

export function useCustomers(segment?: string) {
  const auth = useAuth()
  const orgId = auth?.orgId ?? ''
  return useQuery({
    queryKey: ['customers', orgId, segment],
    queryFn: () =>
      apiFetch<{ data: ApiCustomer[]; count: number }>(
        `/retention/customers?org_id=${orgId}${segment ? `&segment=${encodeURIComponent(segment)}` : ''}`
      ).then(r => r.data),
    enabled: !!orgId,
  })
}

export function useCustomer(customerId: string | null) {
  const auth = useAuth()
  const orgId = auth?.orgId ?? ''
  return useQuery({
    queryKey: ['customer', customerId, orgId],
    queryFn: () =>
      apiFetch<ApiCustomerDetail>(
        `/retention/customers/${customerId}?org_id=${orgId}`
      ),
    enabled: !!customerId && !!orgId,
  })
}

export function useRetentionSummary() {
  const auth = useAuth()
  const orgId = auth?.orgId ?? ''
  return useQuery({
    queryKey: ['retention-summary', orgId],
    queryFn: () => apiFetch<RetentionSummary>(`/retention/summary?org_id=${orgId}`),
    enabled: !!orgId,
  })
}

export function useActions(status?: string) {
  const auth = useAuth()
  const orgId = auth?.orgId ?? ''
  return useQuery({
    queryKey: ['actions', orgId, status],
    queryFn: () =>
      apiFetch<ApiAction[]>(
        `/actions/?org_id=${orgId}${status ? `&status=${status}` : ''}`
      ),
    enabled: !!orgId,
  })
}

export function useAction(actionId: string | null) {
  const auth = useAuth()
  const orgId = auth?.orgId ?? ''
  return useQuery({
    queryKey: ['action', actionId],
    queryFn: () => apiFetch<ApiAction>(`/actions/${actionId}?org_id=${orgId}`),
    enabled: !!actionId && !!orgId,
    refetchInterval: (query) => {
      const data = query.state.data as ApiAction | undefined
      if (data?.status === 'executing') return 1500
      return false
    },
  })
}

type UpdateActionPayload = {
  title?: string
  description?: string
  payload?: Record<string, unknown>
  due_date?: string | null
  priority?: 'high' | 'medium' | 'low'
}

export function useUpdateAction() {
  const auth = useAuth()
  const orgId = auth?.orgId ?? ''
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ actionId, updates }: { actionId: string; updates: UpdateActionPayload }) =>
      apiFetch<ApiAction>(`/actions/${actionId}?org_id=${orgId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }),
    onSuccess: (action) => {
      queryClient.invalidateQueries({ queryKey: ['actions', orgId] })
      queryClient.setQueryData(['action', action.id], action)
    },
  })
}

export function useDashboardKpis() {
  const auth = useAuth()
  const orgId = auth?.orgId ?? ''
  return useQuery({
    queryKey: ['kpis', orgId],
    queryFn: () => apiFetch<ApiKpi[]>(`/dashboard/kpis?org_id=${orgId}`),
    enabled: !!orgId,
  })
}

export function useKpiHistory(name?: string) {
  const auth = useAuth()
  const orgId = auth?.orgId ?? ''
  return useQuery({
    queryKey: ['kpi-history', orgId, name],
    queryFn: () =>
      apiFetch<ApiKpiHistory[]>(
        `/dashboard/kpis/history?org_id=${orgId}${name ? `&name=${encodeURIComponent(name)}` : ''}`
      ),
    enabled: !!orgId,
  })
}

export function useAlerts() {
  const auth = useAuth()
  const orgId = auth?.orgId ?? ''
  return useQuery({
    queryKey: ['alerts', orgId],
    queryFn: () => apiFetch<ApiNotification[]>(`/dashboard/alerts?org_id=${orgId}`),
    enabled: !!orgId,
  })
}

export function useMorningBrief() {
  const auth = useAuth()
  const orgId = auth?.orgId ?? ''
  const userId = auth?.userId ?? ''
  return useQuery({
    queryKey: ['morning-brief', orgId, userId],
    queryFn: () =>
      apiFetch<{ content: string }>(
        `/dashboard/morning-brief?org_id=${orgId}&user_id=${userId}`
      ).then(r => r.content),
    enabled: !!orgId && !!userId,
    staleTime: 60 * 60 * 1000,
  })
}

export function useRefreshMorningBrief() {
  const auth = useAuth()
  const orgId = auth?.orgId ?? ''
  const userId = auth?.userId ?? ''
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<{ content: string }>(
        `/dashboard/morning-brief?org_id=${orgId}&user_id=${userId}&refresh=true`
      ).then(r => r.content),
    onSuccess: (content) => {
      queryClient.setQueryData(['morning-brief', orgId, userId], content)
    },
  })
}

export function useUploads() {
  const auth = useAuth()
  const orgId = auth?.orgId ?? ''
  return useQuery({
    queryKey: ['uploads', orgId],
    queryFn: () => apiFetch<ApiUploadedFile[]>(`/uploads/?org_id=${orgId}`),
    enabled: !!orgId,
  })
}

export function useUploadFile() {
  const auth = useAuth()
  const orgId = auth?.orgId ?? ''
  const userId = auth?.userId ?? ''
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ file, templateType }: { file: File; templateType: string }) => {
      const form = new FormData()
      form.append('file', file)
      form.append('template_type', templateType)
      form.append('org_id', orgId)
      form.append('user_id', userId)
      return fetch(`${API_BASE}/uploads/`, { method: 'POST', body: form }).then(async r => {
        if (!r.ok) throw new Error(`Upload failed: ${r.status}`)
        return r.json() as Promise<ApiUploadedFile>
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['uploads', orgId] }),
  })
}

export function useUploadStatus(fileId: string | null) {
  const auth = useAuth()
  const orgId = auth?.orgId ?? ''
  return useQuery({
    queryKey: ['upload-status', fileId],
    queryFn: () => apiFetch<ApiUploadedFile>(`/uploads/${fileId}?org_id=${orgId}`),
    enabled: !!fileId && !!orgId,
    refetchInterval: (query) => {
      const data = query.state.data as ApiUploadedFile | undefined
      if (data?.status === 'complete' || data?.status === 'error') return false
      return 2000
    },
  })
}

export type ChatSession = {
  id: string
  module: 'people' | 'retention'
  title: string | null
  created_at: string
  updated_at: string
}

export type ChatTurn = {
  id: string
  question: string
  response: { narrative?: string; suggested_actions?: unknown[] } | null
  sources: Source[] | null
  created_at: string
}

export function useChatSessions(module?: 'people' | 'retention') {
  const auth = useAuth()
  const orgId = auth?.orgId ?? ''
  const userId = auth?.userId ?? ''
  return useQuery({
    queryKey: ['chat-sessions', orgId, userId, module],
    queryFn: () =>
      apiFetch<ChatSession[]>(
        `/queries/sessions?org_id=${orgId}&user_id=${userId}${module ? `&module=${module}` : ''}`
      ),
    enabled: !!orgId && !!userId,
  })
}

export function useChatSession(sessionId: string | null) {
  const auth = useAuth()
  const orgId = auth?.orgId ?? ''
  return useQuery({
    queryKey: ['chat-session', sessionId],
    queryFn: () =>
      apiFetch<{ session: ChatSession; turns: ChatTurn[] }>(
        `/queries/sessions/${sessionId}?org_id=${orgId}`
      ),
    enabled: !!sessionId && !!orgId,
  })
}

export function useDeleteChatSession() {
  const auth = useAuth()
  const orgId = auth?.orgId ?? ''
  const userId = auth?.userId ?? ''
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: string) =>
      apiFetch<{ deleted: boolean }>(`/queries/sessions/${sessionId}?org_id=${orgId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chat-sessions', orgId, userId] }),
  })
}

export function useApproveAction() {
  const auth = useAuth()
  const orgId = auth?.orgId ?? ''
  const userId = auth?.userId ?? ''
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (actionId: string) =>
      apiFetch<ApiAction>(`/actions/${actionId}/approve?org_id=${orgId}&approved_by=${userId}`, {
        method: 'PATCH',
      }),
    onSuccess: (action) => {
      queryClient.invalidateQueries({ queryKey: ['actions', orgId] })
      queryClient.setQueryData(['action', action.id], action)
    },
  })
}

export function useRejectAction() {
  const auth = useAuth()
  const orgId = auth?.orgId ?? ''
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ actionId, reason }: { actionId: string; reason?: string }) =>
      apiFetch<ApiAction>(
        `/actions/${actionId}/reject?org_id=${orgId}&reason=${encodeURIComponent(reason ?? '')}`,
        { method: 'PATCH' }
      ),
    onSuccess: (action) => {
      queryClient.invalidateQueries({ queryKey: ['actions', orgId] })
      queryClient.setQueryData(['action', action.id], action)
    },
  })
}

export function useExecuteAction() {
  const auth = useAuth()
  const orgId = auth?.orgId ?? ''
  const userId = auth?.userId ?? ''
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (actionId: string) =>
      apiFetch<{ status: string; result?: Record<string, unknown> }>(
        `/actions/${actionId}/execute?org_id=${orgId}&user_id=${userId}`,
        { method: 'POST' }
      ),
    onSuccess: (_data, actionId) => {
      queryClient.invalidateQueries({ queryKey: ['actions', orgId] })
      queryClient.invalidateQueries({ queryKey: ['action', actionId] })
    },
  })
}

export function useDeleteAction() {
  const auth = useAuth()
  const orgId = auth?.orgId ?? ''
  const userId = auth?.userId ?? ''
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ actionId, reason }: { actionId: string; reason?: string }) => {
      const params = new URLSearchParams({ org_id: orgId, user_id: userId })
      if (reason) params.set('reason', reason)
      const res = await fetch(`${API_BASE}/actions/${actionId}?${params.toString()}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`Delete failed (${res.status}): ${body}`)
      }
      return actionId
    },
    onSuccess: (actionId) => {
      queryClient.invalidateQueries({ queryKey: ['actions', orgId] })
      queryClient.removeQueries({ queryKey: ['action', actionId] })
    },
  })
}

type CreateActionInput = {
  type: 'task' | 'email_send' | 'pdf_report' | 'meeting_ics'
  title: string
  description?: string
  source_module?: 'people' | 'retention' | 'dashboard'
  source_entity_type?: 'employee' | 'customer'
  source_entity_id?: string
  due_date?: string
  priority?: 'high' | 'medium' | 'low'
  payload?: Record<string, unknown>
}

export function useCreateAction() {
  const auth = useAuth()
  const orgId = auth?.orgId ?? ''
  const userId = auth?.userId ?? ''
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateActionInput) =>
      apiFetch<ApiAction>(`/actions/`, {
        method: 'POST',
        body: JSON.stringify({
          ...input,
          org_id: orgId,
          user_id: userId,
          payload: input.payload ?? {},
        }),
      }),
    onSuccess: (action) => {
      queryClient.invalidateQueries({ queryKey: ['actions', orgId] })
      queryClient.setQueryData(['action', action.id], action)
    },
  })
}
