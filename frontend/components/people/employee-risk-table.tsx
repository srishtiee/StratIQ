'use client'

import type { ApiEmployee } from '@/lib/api/types'
import { RiskBadge } from '@/components/shared/risk-badge'
import { DataTable } from '@/components/shared/data-table'
import { Progress } from '@/components/ui/progress'
import { formatCurrency } from '@/lib/utils'

interface EmployeeRiskTableProps {
  data: ApiEmployee[]
  onRowClick?: (employee: ApiEmployee) => void
}

export function EmployeeRiskTable({ data, onRowClick }: EmployeeRiskTableProps) {
  const sorted = [...data].sort(
    (a, b) => (b.latest_attrition_risk_score ?? 0) - (a.latest_attrition_risk_score ?? 0)
  )

  const columns = [
    {
      key: 'name',
      header: 'Employee',
      cell: (e: ApiEmployee) => (
        <div>
          <p className="text-gray-800 font-medium text-xs">{e.name}</p>
          <p className="text-[10px] text-gray-400">{e.role}</p>
        </div>
      ),
    },
    {
      key: 'department',
      header: 'Dept',
      cell: (e: ApiEmployee) => <span className="text-xs text-gray-500">{e.department}</span>,
    },
    {
      key: 'attrition_risk_score',
      header: 'Attrition Risk',
      cell: (e: ApiEmployee) => {
        const score = e.latest_attrition_risk_score ?? 0
        return (
          <div className="flex items-center gap-2">
            <RiskBadge score={score} />
            <Progress value={score} className="w-12 h-1 bg-gray-100" />
          </div>
        )
      },
    },
    {
      key: 'engagement_score',
      header: 'Engagement',
      cell: (e: ApiEmployee) => {
        const score = e.latest_engagement_score ?? 0
        return (
          <span className={`text-xs ${score < 50 ? 'text-red-400' : score < 65 ? 'text-amber-400' : 'text-green-400'}`}>
            {score}
          </span>
        )
      },
    },
    {
      key: 'compa_ratio',
      header: 'Compa Ratio',
      cell: (e: ApiEmployee) => {
        const ratio = e.compensation?.compa_ratio ?? 0
        return (
          <span className={`text-xs ${ratio < 0.87 ? 'text-red-400' : ratio < 0.92 ? 'text-amber-400' : 'text-green-400'}`}>
            {ratio.toFixed(2)}x
          </span>
        )
      },
    },
    {
      key: 'salary',
      header: 'Salary',
      cell: (e: ApiEmployee) => (
        <span className="text-xs text-gray-500">
          {formatCurrency(e.compensation?.salary ?? 0, true)}
        </span>
      ),
    },
    {
      key: 'last_review',
      header: 'Last Review',
      cell: (e: ApiEmployee) => {
        const date = e.compensation?.last_review_date
        return (
          <span className="text-xs text-gray-400">
            {date
              ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : '—'}
          </span>
        )
      },
    },
  ]

  return <DataTable columns={columns} data={sorted} onRowClick={onRowClick} collapsedRows={5} />
}
