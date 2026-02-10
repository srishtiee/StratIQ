'use client'

import { ResponsiveContainer, LineChart as ReLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { cn } from '@/lib/utils'

interface LineConfig {
  key: string
  color: string
  label?: string
}

interface LineChartProps {
  data: Record<string, unknown>[]
  lines: LineConfig[]
  xKey?: string
  height?: number
  className?: string
  formatY?: (v: number) => string
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: {color: string; name: string; value: number}[]; label?: string }) => {
  if (active && payload?.length) {
    return (
      <div style={{ backgroundColor: '#fff', border: '1px solid #e8e8ef', borderRadius: '8px', color: '#111827' }} className="px-3 py-2 text-xs shadow-xl">
        <p className="text-gray-500 mb-1.5">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="font-medium" style={{ color: p.color }}>{p.name}: {p.value}</p>
        ))}
      </div>
    )
  }
  return null
}

export function LineChartComponent({ data, lines, xKey = 'name', height = 200, className, formatY }: LineChartProps) {
  return (
    <div className={cn('', className)} style={{ width: '100%', minWidth: 0 }}>
      <ResponsiveContainer width="100%" height={height}>
        <ReLineChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f5" vertical={false} />
          <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={formatY} width={35} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: '10px', color: '#9ca3af' }} />
          {lines.map(l => (
            <Line key={l.key} type="monotone" dataKey={l.key} stroke={l.color} strokeWidth={2} dot={false} name={l.label || l.key} />
          ))}
        </ReLineChart>
      </ResponsiveContainer>
    </div>
  )
}
