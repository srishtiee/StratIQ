'use client'

import { cn } from '@/lib/utils'

interface HeatmapCell {
  department: string
  tenure: string
  risk: number
  count: number
}

interface RiskHeatmapProps {
  className?: string
}

const DEPARTMENTS = ['Engineering', 'Sales', 'Marketing', 'Product', 'CS', 'Finance']
const TENURE_BANDS = ['0-1yr', '1-2yr', '2-3yr', '3-5yr', '5+yr']

const heatmapData: HeatmapCell[] = [
  { department: 'Engineering', tenure: '0-1yr', risk: 35, count: 2 },
  { department: 'Engineering', tenure: '1-2yr', risk: 58, count: 3 },
  { department: 'Engineering', tenure: '2-3yr', risk: 72, count: 4 },
  { department: 'Engineering', tenure: '3-5yr', risk: 81, count: 2 },
  { department: 'Engineering', tenure: '5+yr', risk: 76, count: 1 },
  { department: 'Sales', tenure: '0-1yr', risk: 28, count: 2 },
  { department: 'Sales', tenure: '1-2yr', risk: 42, count: 2 },
  { department: 'Sales', tenure: '2-3yr', risk: 38, count: 1 },
  { department: 'Sales', tenure: '3-5yr', risk: 52, count: 1 },
  { department: 'Sales', tenure: '5+yr', risk: 30, count: 1 },
  { department: 'Marketing', tenure: '0-1yr', risk: 22, count: 1 },
  { department: 'Marketing', tenure: '1-2yr', risk: 35, count: 1 },
  { department: 'Marketing', tenure: '2-3yr', risk: 40, count: 1 },
  { department: 'Marketing', tenure: '3-5yr', risk: 44, count: 1 },
  { department: 'Marketing', tenure: '5+yr', risk: 38, count: 0 },
  { department: 'Product', tenure: '0-1yr', risk: 20, count: 1 },
  { department: 'Product', tenure: '1-2yr', risk: 32, count: 1 },
  { department: 'Product', tenure: '2-3yr', risk: 58, count: 1 },
  { department: 'Product', tenure: '3-5yr', risk: 45, count: 1 },
  { department: 'Product', tenure: '5+yr', risk: 28, count: 0 },
  { department: 'CS', tenure: '0-1yr', risk: 18, count: 2 },
  { department: 'CS', tenure: '1-2yr', risk: 25, count: 1 },
  { department: 'CS', tenure: '2-3yr', risk: 30, count: 1 },
  { department: 'CS', tenure: '3-5yr', risk: 35, count: 1 },
  { department: 'CS', tenure: '5+yr', risk: 38, count: 1 },
  { department: 'Finance', tenure: '0-1yr', risk: 24, count: 1 },
  { department: 'Finance', tenure: '1-2yr', risk: 32, count: 1 },
  { department: 'Finance', tenure: '2-3yr', risk: 44, count: 1 },
  { department: 'Finance', tenure: '3-5yr', risk: 35, count: 0 },
  { department: 'Finance', tenure: '5+yr', risk: 30, count: 1 },
]

function getRiskColor(risk: number): string {
  if (risk >= 70) return 'rgba(239,68,68,0.7)'
  if (risk >= 50) return 'rgba(245,158,11,0.6)'
  if (risk >= 35) return 'rgba(245,158,11,0.35)'
  return 'rgba(34,197,94,0.3)'
}

export function RiskHeatmap({ className }: RiskHeatmapProps) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="text-left text-gray-500 font-medium pb-2 pr-3 w-28">Dept / Tenure</th>
            {TENURE_BANDS.map(t => (
              <th key={t} className="text-center text-gray-500 font-medium pb-2 px-1">{t}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DEPARTMENTS.map(dept => (
            <tr key={dept}>
              <td className="text-gray-500 pr-3 py-1 text-xs font-medium">{dept}</td>
              {TENURE_BANDS.map(tenure => {
                const cell = heatmapData.find(d => d.department === dept && d.tenure === tenure)
                return (
                  <td key={tenure} className="px-1 py-1 text-center">
                    {cell ? (
                      <div
                        className="rounded w-full h-8 flex items-center justify-center text-white font-medium cursor-default transition-transform hover:scale-105"
                        style={{ backgroundColor: getRiskColor(cell.risk) }}
                        title={`${dept} ${tenure}: Risk ${cell.risk}, Count ${cell.count}`}
                      >
                        {cell.risk}
                      </div>
                    ) : (
                      <div className="rounded w-full h-8 bg-gray-100" />
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-3 mt-3 text-[10px] text-gray-500">
        <span>Risk Score:</span>
        {[
          { label: 'Low (<35)', color: 'rgba(34,197,94,0.3)' },
          { label: 'Med (35-49)', color: 'rgba(245,158,11,0.35)' },
          { label: 'High (50-69)', color: 'rgba(245,158,11,0.6)' },
          { label: 'Critical (70+)', color: 'rgba(239,68,68,0.7)' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: l.color }} />
            <span>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
