'use client'

import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { ResponsiveContainer, AreaChart, Area } from 'recharts'

interface KpiCardProps {
  value: string | number
  label: string
  change?: number
  changeLabel?: string
  trend?: 'up' | 'down' | 'flat'
  sparklineData?: number[]
  status?: 'good' | 'warning' | 'danger' | 'neutral'
  prefix?: string
  suffix?: string
  className?: string
}

const statusColors = {
  good: { border: 'border-l-green-500', text: 'text-green-600', bg: 'stroke-green-500', fill: '#22c55e' },
  warning: { border: 'border-l-amber-500', text: 'text-amber-600', bg: 'stroke-amber-500', fill: '#f59e0b' },
  danger: { border: 'border-l-red-500', text: 'text-red-600', bg: 'stroke-red-500', fill: '#ef4444' },
  neutral: { border: 'border-l-indigo-500', text: 'text-indigo-600', bg: 'stroke-indigo-500', fill: '#6366f1' },
}

export function KpiCard({ value, label, change, changeLabel, trend, sparklineData, status = 'neutral', prefix, suffix, className }: KpiCardProps) {
  const colors = statusColors[status]
  const chartData = sparklineData?.map((v, i) => ({ v, i })) ?? []

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const trendColor = status === 'good' ? 'text-green-600' : status === 'danger' ? 'text-red-600' : status === 'warning' ? 'text-amber-600' : 'text-gray-500'

  return (
    <div className={cn(
      'rounded-xl border border-[#e8e8ef] p-4 border-l-2 bg-white shadow-sm',
      colors.border,
      className
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 mb-1 truncate">{label}</p>
          <p className="text-2xl font-semibold text-gray-900 tracking-tight">
            {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
          </p>
          {change !== undefined && (
            <div className={cn('flex items-center gap-1 mt-1 text-xs font-medium', trendColor)}>
              <TrendIcon className="w-3 h-3" />
              <span>{change > 0 ? '+' : ''}{change}%</span>
              {changeLabel && <span className="text-gray-400 font-normal">{changeLabel}</span>}
            </div>
          )}
        </div>
        {chartData.length > 0 && (
          <div className="w-16 h-10 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={colors.fill} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={colors.fill} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={colors.fill}
                  strokeWidth={1.5}
                  fill={`url(#grad-${label})`}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
