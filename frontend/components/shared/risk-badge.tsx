'use client'

import { cn } from '@/lib/utils'

interface RiskBadgeProps {
  score: number
  showScore?: boolean
  size?: 'sm' | 'md'
}

export function RiskBadge({ score, showScore = false, size = 'md' }: RiskBadgeProps) {
  const level = score >= 70 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW'
  const colors = {
    HIGH: 'bg-red-500/15 text-red-400 border-red-500/25',
    MEDIUM: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
    LOW: 'bg-green-500/15 text-green-400 border-green-500/25',
  }
  const dotColors = {
    HIGH: 'bg-red-500',
    MEDIUM: 'bg-amber-500',
    LOW: 'bg-green-500',
  }

  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full border font-medium',
      colors[level],
      size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5'
    )}>
      <span className={cn('rounded-full shrink-0', dotColors[level], size === 'sm' ? 'w-1 h-1' : 'w-1.5 h-1.5')} />
      {level}{showScore ? ` (${score})` : ''}
    </span>
  )
}
