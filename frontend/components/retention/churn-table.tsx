'use client'

import type { ApiCustomer } from '@/lib/api/types'
import { RiskBadge } from '@/components/shared/risk-badge'
import { DataTable } from '@/components/shared/data-table'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { Mail, CheckSquare, ExternalLink } from 'lucide-react'

interface ChurnTableProps {
  data: ApiCustomer[]
  onRowClick?: (customer: ApiCustomer) => void
}

export function ChurnTable({ data, onRowClick }: ChurnTableProps) {
  const sorted = [...data].sort(
    (a, b) => (b.latest_churn_score ?? 0) - (a.latest_churn_score ?? 0)
  )

  const columns = [
    {
      key: 'name',
      header: 'Account',
      cell: (c: ApiCustomer) => (
        <div>
          <p className="text-gray-800 font-medium text-xs">{c.name}</p>
          <p className="text-[10px] text-gray-400">{c.segment}</p>
        </div>
      ),
    },
    {
      key: 'arr',
      header: 'ARR',
      cell: (c: ApiCustomer) => (
        <span className="text-xs text-gray-700">{formatCurrency(c.arr, true)}</span>
      ),
    },
    {
      key: 'churn_score',
      header: 'Churn Risk',
      cell: (c: ApiCustomer) => {
        const score = c.latest_churn_score ?? 0
        return (
          <div className="flex items-center gap-2">
            <RiskBadge score={score} />
            <Progress value={score} className="w-12 h-1 bg-gray-100" />
          </div>
        )
      },
    },
    {
      key: 'health_score',
      header: 'Health',
      cell: (c: ApiCustomer) => {
        const score = c.latest_health_score ?? 0
        return (
          <span className={`text-xs ${score < 40 ? 'text-red-400' : score < 60 ? 'text-amber-400' : 'text-green-400'}`}>
            {score}
          </span>
        )
      },
    },
    {
      key: 'csm',
      header: 'CSM',
      cell: (c: ApiCustomer) => (
        <span className="text-xs text-gray-500 truncate">
          {c.user_profiles?.name?.split(' ')[0] ?? 'CSM'}
        </span>
      ),
    },
    {
      key: 'renewal_date',
      header: 'Renewal',
      cell: (c: ApiCustomer) => (
        <span className="text-xs text-gray-400">
          {new Date(c.renewal_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      cell: () => (
        <div className="flex gap-1">
          <Button size="sm" className="h-5 w-5 p-0 bg-gray-50 hover:bg-gray-100 text-gray-500">
            <Mail className="w-2.5 h-2.5" />
          </Button>
          <Button size="sm" className="h-5 w-5 p-0 bg-gray-50 hover:bg-gray-100 text-gray-500">
            <CheckSquare className="w-2.5 h-2.5" />
          </Button>
          <Button size="sm" className="h-5 w-5 p-0 bg-gray-50 hover:bg-gray-100 text-gray-500">
            <ExternalLink className="w-2.5 h-2.5" />
          </Button>
        </div>
      ),
    },
  ]

  return <DataTable columns={columns} data={sorted} onRowClick={onRowClick} />
}
