'use client'

import { useMemo } from 'react'
import { useCustomers } from '@/lib/api/hooks'
import { formatCurrency } from '@/lib/utils'

export function RevenueAtRisk() {
  const { data: customers = [], isLoading } = useCustomers()

  const segments = useMemo(() => {
    const high = customers
      .filter(c => (c.latest_churn_score ?? 0) >= 70)
      .reduce((s, c) => s + (c.arr ?? 0), 0)
    const medium = customers
      .filter(c => (c.latest_churn_score ?? 0) >= 40 && (c.latest_churn_score ?? 0) < 70)
      .reduce((s, c) => s + (c.arr ?? 0), 0)
    const low = customers
      .filter(c => (c.latest_churn_score ?? 0) < 40)
      .reduce((s, c) => s + (c.arr ?? 0), 0)
    const total = high + medium + low

    return [
      { label: 'High Risk (70+)', value: high, color: '#ef4444', pct: total ? (high / total) * 100 : 0 },
      { label: 'Medium Risk (40-69)', value: medium, color: '#f59e0b', pct: total ? (medium / total) * 100 : 0 },
      { label: 'Low Risk (<40)', value: low, color: '#22c55e', pct: total ? (low / total) * 100 : 0 },
    ]
  }, [customers])

  const hasData = segments.some(s => s.value > 0)

  return (
    <div className="rounded-xl border border-[#e8e8ef] bg-white shadow-sm p-4">
      <h3 className="text-sm font-medium text-gray-900 mb-3">Revenue at Risk Distribution</h3>
      {isLoading ? (
        <p className="text-xs text-gray-400 py-3">Loading…</p>
      ) : !hasData ? (
        <p className="text-xs text-gray-400 py-3">No customer ARR data yet.</p>
      ) : (
        <>
          <div className="flex rounded-full overflow-hidden h-6 mb-3">
            {segments.map(s => (
              <div key={s.label} className="h-full transition-all" style={{ width: `${s.pct}%`, backgroundColor: s.color, opacity: 0.8 }} />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {segments.map(s => (
              <div key={s.label} className="text-center">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-[10px] text-gray-500">{s.label}</span>
                </div>
                <p className="text-sm font-semibold text-gray-900">{formatCurrency(s.value, true)}</p>
                <p className="text-[10px] text-gray-400">{s.pct.toFixed(1)}% of ARR</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
