'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/shared/page-header'
import { ExecutionLog } from '@/components/actions/execution-log'
import { ActionModal } from '@/components/shared/action-modal'
import { KpiCard } from '@/components/shared/kpi-card'
import { Badge } from '@/components/ui/badge'
import { FileText, Mail, CheckSquare, Calendar, Loader2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useActions } from '@/lib/api/hooks'
import type { ApiAction } from '@/lib/api/types'

const typeLabels: Record<string, string> = {
  pdf_report: 'PDF Report',
  email_send: 'Email',
  task: 'Task',
  meeting_ics: 'Meeting',
}

const typeIcons: Record<string, React.ElementType> = {
  pdf_report: FileText,
  email_send: Mail,
  task: CheckSquare,
  meeting_ics: Calendar,
}

const statusBadge: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
  pending_approval: 'bg-amber-50 text-amber-800 border-amber-200',
  approved: 'bg-blue-50 text-blue-800 border-blue-200',
  executing: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  completed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  failed: 'bg-rose-50 text-rose-800 border-rose-200',
  rejected: 'bg-rose-50 text-rose-800 border-rose-200',
}

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  executing: 'Executing',
  completed: 'Completed',
  failed: 'Failed',
  rejected: 'Rejected',
}

const moduleLabel: Record<string, string> = {
  people: 'People Intelligence',
  retention: 'Customer Retention',
  dashboard: 'Executive KPI',
}

const BTN_PRIMARY = 'inline-flex items-center justify-center gap-1.5 text-xs font-medium rounded-md px-3 py-1.5 bg-gray-900 text-white border border-gray-900 hover:bg-gray-800 transition-colors'

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

interface RowsProps {
  rows: ApiAction[]
  emptyText: string
  onSelect: (a: ApiAction) => void
  showStatus?: boolean
}

function ActionRows({ rows, emptyText, onSelect, showStatus = false }: RowsProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50/50">
            <th className="text-left py-2.5 px-3 text-gray-500 font-medium">Title</th>
            <th className="text-left py-2.5 px-3 text-gray-500 font-medium">Type</th>
            <th className="text-left py-2.5 px-3 text-gray-500 font-medium">Source</th>
            {showStatus && (
              <th className="text-left py-2.5 px-3 text-gray-500 font-medium">Status</th>
            )}
            <th className="text-left py-2.5 px-3 text-gray-500 font-medium">Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((action) => {
            const Icon = typeIcons[action.type] ?? FileText
            return (
              <tr
                key={action.id}
                onClick={() => onSelect(action)}
                className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <td className="py-2.5 px-3 text-gray-900">
                  <div className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="truncate">{action.title}</span>
                  </div>
                </td>
                <td className="py-2.5 px-3 text-gray-600">{typeLabels[action.type]}</td>
                <td className="py-2.5 px-3 text-gray-600">
                  {moduleLabel[action.source_module ?? ''] ?? action.source_module ?? '—'}
                </td>
                {showStatus && (
                  <td className="py-2.5 px-3">
                    <Badge className={cn('text-[10px]', statusBadge[action.status])}>
                      {statusLabels[action.status]}
                    </Badge>
                  </td>
                )}
                <td className="py-2.5 px-3 text-gray-500">
                  {fmtDate(action.executed_at ?? action.created_at)}
                </td>
              </tr>
            )
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={showStatus ? 5 : 4} className="py-8 text-center text-gray-400 text-xs">
                {emptyText}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export default function ActionsPage() {
  const { data: actions = [], isLoading } = useActions()

  const [modalOpen, setModalOpen] = useState(false)
  const [selectedAction, setSelectedAction] = useState<ApiAction | null>(null)
  const [createMode, setCreateMode] = useState(false)

  const drafts    = actions.filter((a: ApiAction) => a.status === 'draft')
  const pending   = actions.filter((a: ApiAction) => a.status === 'pending_approval')
  const inProgress = actions.filter((a: ApiAction) => a.status === 'approved' || a.status === 'executing')
  const completed = actions.filter((a: ApiAction) => a.status === 'completed')
  const failed    = actions.filter((a: ApiAction) => ['failed', 'rejected'].includes(a.status))

  function openAction(a: ApiAction) {
    setCreateMode(false)
    setSelectedAction(a)
    setModalOpen(true)
  }

  function openCreate() {
    setSelectedAction(null)
    setCreateMode(true)
    setModalOpen(true)
  }

  function handleClose() {
    setModalOpen(false)
    setSelectedAction(null)
    setCreateMode(false)
  }

  return (
    <>
      <div className="max-w-[1200px] mx-auto">
        <div className="flex items-start justify-between mb-4">
          <PageHeader title="Actions Center" description="Manage and track all AI-generated actions" />
          <button onClick={openCreate} className={BTN_PRIMARY}>
            <Plus className="w-3.5 h-3.5" /> New Action
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <KpiCard value={isLoading ? '—' : actions.length}    label="Total Actions"      sparklineData={[8, 10, 11, 12, 13, 14, 15, actions.length]} status="neutral" trend="up" />
          <KpiCard value={isLoading ? '—' : pending.length}    label="Pending Approval"   sparklineData={[1, 2, 2, 3, 3, 3, 3, pending.length]} status="warning" trend="flat" />
          <KpiCard value={isLoading ? '—' : completed.length}  label="Completed"          sparklineData={[2, 3, 4, 5, 6, 6, 7, completed.length]} status="good" trend="up" />
          <KpiCard value={isLoading ? '—' : failed.length}     label="Failed / Rejected"  sparklineData={[0, 0, 0, 0, 1, 1, 1, failed.length]} status="danger" trend="flat" />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading actions…
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Tabs defaultValue="drafts">
                <TabsList className="bg-gray-50 border border-gray-200 mb-4 flex flex-wrap h-auto gap-0.5">
                  <TabsTrigger value="drafts" className="text-xs">Drafts ({drafts.length})</TabsTrigger>
                  <TabsTrigger value="pending_approval" className="text-xs">Pending ({pending.length})</TabsTrigger>
                  <TabsTrigger value="in_progress" className="text-xs">In Progress ({inProgress.length})</TabsTrigger>
                  <TabsTrigger value="completed" className="text-xs">Completed ({completed.length})</TabsTrigger>
                  <TabsTrigger value="failed" className="text-xs">Failed ({failed.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="drafts">
                  <ActionRows rows={drafts} emptyText="No draft actions." onSelect={openAction} />
                </TabsContent>
                <TabsContent value="pending_approval">
                  <ActionRows rows={pending} emptyText="No pending approvals." onSelect={openAction} />
                </TabsContent>
                <TabsContent value="in_progress">
                  <ActionRows rows={inProgress} emptyText="No actions in progress." onSelect={openAction} showStatus />
                </TabsContent>
                <TabsContent value="completed">
                  <ActionRows rows={completed} emptyText="No completed actions." onSelect={openAction} />
                </TabsContent>
                <TabsContent value="failed">
                  <ActionRows rows={failed} emptyText="No failed actions." onSelect={openAction} showStatus />
                </TabsContent>
              </Tabs>
            </div>

            <ExecutionLog onSelect={openAction} />
          </div>
        )}
      </div>

      <ActionModal
        open={modalOpen}
        onClose={handleClose}
        action={selectedAction}
        mode={createMode ? 'create' : 'view'}
      />
    </>
  )
}
