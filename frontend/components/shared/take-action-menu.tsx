'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Mail, FileText, CheckSquare, Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/store'
import type { ApiAction, ApiActionType } from '@/lib/api/types'

type EntityKind = 'employee' | 'customer'

type Template = {
  type: ApiActionType
  label: string
  icon: typeof Mail
  buildPayload: (ctx: { name: string | null; email?: string | null }) => Record<string, unknown>
  buildTitle: (ctx: { name: string | null }) => string
  buildDescription: (ctx: { name: string | null }) => string
}

const PEOPLE_TEMPLATES: Template[] = [
  {
    type: 'task',
    label: 'Schedule 1:1',
    icon: CheckSquare,
    buildPayload: ({ name }) => ({ notes: `Schedule a retention conversation with ${name ?? 'this employee'} this week.` }),
    buildTitle: ({ name }) => `Schedule 1:1 with ${name ?? 'employee'}`,
    buildDescription: ({ name }) => `Reach out to ${name ?? 'this employee'} for a retention check-in.`,
  },
  {
    type: 'email_send',
    label: 'Send retention email',
    icon: Mail,
    buildPayload: ({ name, email }) => ({
      recipients: email ? [email] : ['recipient@example.com'],
      subject: 'Quick check-in',
      body_markdown: `Hi${name ? ' ' + name.split(' ')[0] : ''},\n\nI wanted to make time to chat about how things are going. **Could you grab 30 minutes this week?**\n\n— StratIQ`,
      from_persona: 'manager',
    }),
    buildTitle: ({ name }) => `Email ${name ?? 'employee'}`,
    buildDescription: () => 'Personalized retention check-in email.',
  },
  {
    type: 'pdf_report',
    label: 'Generate comp review packet',
    icon: FileText,
    buildPayload: ({ name }) => ({
      report_type: 'comp_review',
      sections: [
        { heading: 'Compensation snapshot', body: `Current package and market positioning for ${name ?? 'this employee'}.` },
        { heading: 'Recommendation', body: 'Recommended adjustment and timeline.' },
      ],
    }),
    buildTitle: ({ name }) => `Comp review packet — ${name ?? 'employee'}`,
    buildDescription: () => 'PDF summarizing current comp vs market with adjustment recommendation.',
  },
]

const RETENTION_TEMPLATES: Template[] = [
  {
    type: 'task',
    label: 'Create save plan',
    icon: CheckSquare,
    buildPayload: ({ name }) => ({ notes: `Build a save plan for ${name ?? 'this customer'} — owner, timeline, success metrics.` }),
    buildTitle: ({ name }) => `Save plan — ${name ?? 'customer'}`,
    buildDescription: ({ name }) => `Draft a structured save plan for ${name ?? 'this customer'}.`,
  },
  {
    type: 'email_send',
    label: 'Email champion',
    icon: Mail,
    buildPayload: ({ name }) => ({
      recipients: ['champion@example.com'],
      subject: `Quick check-in on your ${name ?? 'account'}`,
      body_markdown: `Hi,\n\nWe noticed some changes on your end and want to make sure you're getting the value you expected. **Could we set up time this week?**\n\n— StratIQ`,
      from_persona: 'csm',
    }),
    buildTitle: ({ name }) => `Email champion at ${name ?? 'customer'}`,
    buildDescription: () => 'Re-engagement email to the customer champion.',
  },
  {
    type: 'pdf_report',
    label: 'Generate QBR brief',
    icon: FileText,
    buildPayload: ({ name }) => ({
      report_type: 'qbr_brief',
      sections: [
        { heading: 'Account health', body: `Current health, churn risk, and signals for ${name ?? 'this customer'}.` },
        { heading: 'Action plan', body: 'Recommended next steps to mitigate risk.' },
      ],
    }),
    buildTitle: ({ name }) => `QBR brief — ${name ?? 'customer'}`,
    buildDescription: () => 'Structured QBR brief with health snapshot and recommended actions.',
  },
]


type CreateRequest = {
  type: ApiActionType
  title: string
  description: string
  payload: Record<string, unknown>
  source_module: 'people' | 'retention'
  source_entity_type: EntityKind
  source_entity_id: string
}

function useCreateAndExecute() {
  const auth = useAuth()
  const orgId = auth?.orgId ?? ''
  const userId = auth?.userId ?? ''
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (req: CreateRequest) => {
      const created = await apiFetch<ApiAction>(`/actions/`, {
        method: 'POST',
        body: JSON.stringify({
          ...req,
          org_id: orgId,
          user_id: userId,
        }),
      })
      // Auto-execute low-tier (task / pdf_report) — mid-tier (email) waits for approval.
      if (created.approval_tier === 'low') {
        return apiFetch<ApiAction>(
          `/actions/${created.id}/execute?org_id=${orgId}&user_id=${userId}`,
          { method: 'POST' }
        ).catch(() => created)
      }
      return created
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actions', orgId] })
    },
  })
}


type Props = {
  entityKind: EntityKind
  entityId: string
  entityName: string | null
  entityEmail?: string | null
  className?: string
}

export function TakeActionMenu({ entityKind, entityId, entityName, entityEmail, className }: Props) {
  const [open, setOpen] = useState(false)
  const [pendingType, setPendingType] = useState<ApiActionType | null>(null)
  const [done, setDone] = useState<{ type: ApiActionType; tier: 'low' | 'mid' | 'high' } | null>(null)
  const { mutate, isPending } = useCreateAndExecute()

  const templates = entityKind === 'employee' ? PEOPLE_TEMPLATES : RETENTION_TEMPLATES
  const sourceModule: 'people' | 'retention' = entityKind === 'employee' ? 'people' : 'retention'

  const handlePick = (tpl: Template) => {
    setPendingType(tpl.type)
    setOpen(false)
    mutate(
      {
        type: tpl.type,
        title: tpl.buildTitle({ name: entityName }),
        description: tpl.buildDescription({ name: entityName }),
        payload: tpl.buildPayload({ name: entityName, email: entityEmail }),
        source_module: sourceModule,
        source_entity_type: entityKind,
        source_entity_id: entityId,
      },
      {
        onSuccess: (action) => {
          setPendingType(null)
          setDone({ type: tpl.type, tier: action.approval_tier })
          setTimeout(() => setDone(null), 4000)
        },
        onError: () => setPendingType(null),
      }
    )
  }

  return (
    <div className={cn('relative', className)}>
      <Button
        size="sm"
        onClick={() => setOpen(o => !o)}
        disabled={isPending}
        className="bg-indigo-500 hover:bg-indigo-600 text-white text-xs h-7 gap-1"
      >
        {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronDown className="w-3 h-3" />}
        Take action
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 w-60 rounded-lg border border-[#e8e8ef] bg-white shadow-lg overflow-hidden">
            {templates.map((tpl) => {
              const Icon = tpl.icon
              return (
                <button
                  key={tpl.type + tpl.label}
                  onClick={() => handlePick(tpl)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 text-left"
                >
                  <Icon className="w-3.5 h-3.5 text-gray-400" />
                  {tpl.label}
                </button>
              )
            })}
          </div>
        </>
      )}

      {pendingType && (
        <div className="absolute right-0 top-full mt-1 text-[10px] text-gray-500 flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" /> Creating…
        </div>
      )}

      {done && (
        <div className="absolute right-0 top-full mt-1 text-[10px] text-green-600 flex items-center gap-1 whitespace-nowrap">
          <Check className="w-3 h-3" />
          {done.tier === 'low' ? 'Done' : 'Sent for approval'}
        </div>
      )}
    </div>
  )
}
