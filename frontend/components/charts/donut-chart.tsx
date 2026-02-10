'use client'

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts'
import { cn } from '@/lib/utils'

interface DonutChartProps {
  data: { name: string; value: number; color: string }[]
  height?: number
  className?: string
  innerRadius?: number
  outerRadius?: number
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: {name: string; value: number; payload: {color: string}}[] }) => {
  if (active && payload?.length) {
    return (
      <div style={{ backgroundColor: '#fff', border: '1px solid #e8e8ef', borderRadius: '8px', color: '#111827' }} className="px-3 py-2 text-xs shadow-xl">
        <p style={{ color: payload[0].payload.color }} className="font-medium">{payload[0].name}</p>
        <p className="text-gray-900">{payload[0].value}</p>
      </div>
    )
  }
  return null
}

export function DonutChart({ data, height = 200, className, innerRadius = 50, outerRadius = 80 }: DonutChartProps) {
  return (
    <div className={cn('', className)} style={{ width: '100%', minWidth: 0 }}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={innerRadius} outerRadius={outerRadius} dataKey="value" paddingAngle={2}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} fillOpacity={0.85} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: '10px', color: '#9ca3af' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
