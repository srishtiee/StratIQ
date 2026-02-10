'use client'

import { ResponsiveContainer, AreaChart as ReAreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { cn } from '@/lib/utils'

interface AreaChartProps {
  data: Record<string, unknown>[]
  dataKey: string
  xKey?: string
  color?: string
  height?: number
  className?: string
  formatY?: (v: number) => string
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

export function AreaChartComponent({ data, dataKey, xKey = 'name', color = '#6366f1', height = 200, className, formatY }: AreaChartProps) {
  return (
    <div className={cn('', className)} style={{ width: '100%', minWidth: 0 }}>
      <ResponsiveContainer width="100%" height={height}>
        <ReAreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`area-grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f5" vertical={false} />
          <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={formatY} width={35} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fill={`url(#area-grad-${dataKey})`} dot={false} />
        </ReAreaChart>
      </ResponsiveContainer>
    </div>
  )
}
