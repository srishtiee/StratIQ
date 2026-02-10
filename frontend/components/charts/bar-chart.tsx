'use client'

import { ResponsiveContainer, BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts'
import { cn } from '@/lib/utils'

interface BarChartProps {
  data: Record<string, unknown>[]
  dataKey: string
  xKey?: string
  color?: string
  height?: number
  className?: string
  formatY?: (v: number) => string
  colorByValue?: boolean
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: {value: number}[]; label?: string }) => {
  if (active && payload?.length) {
    return (
      <div style={{ backgroundColor: '#fff', border: '1px solid #e8e8ef', borderRadius: '8px', color: '#111827' }} className="px-3 py-2 text-xs shadow-xl">
        <p className="text-gray-500 mb-0.5">{label}</p>
        <p className="text-gray-900 font-medium">{payload[0].value}</p>
      </div>
    )
  }
  return null
}

export function BarChartComponent({ data, dataKey, xKey = 'name', color = '#6366f1', height = 200, className, formatY, colorByValue }: BarChartProps) {
  return (
    <div className={cn('', className)} style={{ width: '100%', minWidth: 0 }}>
      <ResponsiveContainer width="100%" height={height}>
        <ReBarChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 0 }} barSize={20}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f5" vertical={false} />
          <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={formatY} width={35} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey={dataKey} radius={[3, 3, 0, 0]}>
            {data.map((entry, i) => {
              const val = entry[dataKey] as number
              const c = colorByValue
                ? (val >= 70 ? '#ef4444' : val >= 40 ? '#f59e0b' : '#22c55e')
                : color
              return <Cell key={i} fill={c} fillOpacity={0.85} />
            })}
          </Bar>
        </ReBarChart>
      </ResponsiveContainer>
    </div>
  )
}
