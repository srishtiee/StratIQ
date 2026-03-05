'use client'

import { useMemo } from 'react'
import { useEmployees } from '@/lib/api/hooks'
import { formatCurrency } from '@/lib/utils'

const DEPT_LABEL: Record<string, string> = { 'Customer Success': 'CS' }

type DeptRow = {
  name: string
  avgSalary: number
  avgBenchmark: number
  gap: number
}

export function CompensationChart() {
  const { data: employees = [], isLoading } = useEmployees()

  const { deptRows, underpaid } = useMemo(() => {
    const grouped = new Map<string, { salaries: number[]; benchmarks: number[] }>()
    for (const e of employees) {
      const salary = e.compensation?.salary
      const benchmark = e.compensation?.market_benchmark
      if (!e.department || !salary || !benchmark) continue
      const bucket = grouped.get(e.department) ?? { salaries: [], benchmarks: [] }
      bucket.salaries.push(salary)
      bucket.benchmarks.push(benchmark)
      grouped.set(e.department, bucket)
    }
    const rows: DeptRow[] = Array.from(grouped.entries())
      .map(([dept, b]) => {
        const avgSalary = b.salaries.reduce((s, n) => s + n, 0) / b.salaries.length
        const avgBenchmark = b.benchmarks.reduce((s, n) => s + n, 0) / b.benchmarks.length
        const gap = ((avgSalary - avgBenchmark) / avgBenchmark) * 100
        return {
          name: DEPT_LABEL[dept] ?? dept,
          avgSalary: Math.round(avgSalary),
          avgBenchmark: Math.round(avgBenchmark),
          gap: Math.round(gap),
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))

    const underpaidRows = employees.filter(e => {
      const perf = e.latest_performance_score
      const ratio = e.compensation?.compa_ratio
      return perf != null && ratio != null && perf > 85 && ratio < 0.88
    })

    return { deptRows: rows, underpaid: underpaidRows }
  }, [employees])

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#e8e8ef] bg-white shadow-sm p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Avg Salary vs Market Benchmark by Department</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#e8e8ef]">
                <th className="text-left text-gray-500 pb-2 font-medium">Department</th>
                <th className="text-right text-gray-500 pb-2 font-medium">Avg Salary</th>
                <th className="text-right text-gray-500 pb-2 font-medium">Market P50</th>
                <th className="text-right text-gray-500 pb-2 font-medium">Gap</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e8e8ef]">
              {isLoading && (
                <tr><td colSpan={4} className="py-6 text-center text-gray-400">Loading…</td></tr>
              )}
              {!isLoading && deptRows.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-gray-400">No compensation data yet.</td></tr>
              )}
              {deptRows.map(d => (
                <tr key={d.name} className="hover:bg-gray-50">
                  <td className="py-2 text-gray-700">{d.name}</td>
                  <td className="py-2 text-right text-gray-700">{formatCurrency(d.avgSalary, true)}</td>
                  <td className="py-2 text-right text-gray-500">{formatCurrency(d.avgBenchmark, true)}</td>
                  <td className={`py-2 text-right font-medium ${d.gap < -5 ? 'text-red-400' : d.gap < 0 ? 'text-amber-400' : 'text-green-400'}`}>
                    {d.gap > 0 ? '+' : ''}{d.gap}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-[#e8e8ef] bg-white shadow-sm p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Underpaid High Performers</h3>
        <p className="text-xs text-gray-400 mb-3">Employees with performance &gt; 85 and compa-ratio &lt; 0.88</p>
        <div className="space-y-2">
          {isLoading && <p className="text-xs text-gray-400">Loading…</p>}
          {!isLoading && underpaid.length === 0 && (
            <p className="text-xs text-gray-400">No matches — performance and compa data may not be loaded yet.</p>
          )}
          {underpaid.map(e => {
            const salary = e.compensation!.salary
            const benchmark = e.compensation!.market_benchmark!
            const gapPct = Math.round(((salary - benchmark) / benchmark) * 100)
            return (
              <div key={e.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-red-50 border border-red-100">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800">{e.name}</p>
                  <p className="text-[10px] text-gray-400">{e.role} · {e.department}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-700">{formatCurrency(salary, true)}</p>
                  <p className="text-[10px] text-gray-400">vs {formatCurrency(benchmark, true)} market</p>
                </div>
                <div className="text-right min-w-14">
                  <p className="text-xs text-red-400 font-medium">{gapPct}%</p>
                  <p className="text-[10px] text-zinc-500">gap</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
