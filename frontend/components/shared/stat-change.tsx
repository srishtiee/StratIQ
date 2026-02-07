'use client'

import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatChangeProps {
  value: number
  invert?: boolean
  suffix?: string
}

export function StatChange({ value, invert = false, suffix = '%' }: StatChangeProps) {
  const isGood = invert ? value < 0 : value > 0
  const color = isGood ? 'text-green-400' : 'text-red-400'
  const Icon = value > 0 ? TrendingUp : TrendingDown

  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium', color)}>
      <Icon className="w-3 h-3" />
      {value > 0 ? '+' : ''}{value}{suffix}
    </span>
  )
}
