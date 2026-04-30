'use client'

import { Users, Building2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EntityCard, EntityCardScore, EntityCardTier } from '@/lib/api/query-stream'

const RISK_TIER_STYLE: Record<string, string> = {
  critical: 'bg-red-50 text-red-700 border-red-200',
  high:     'bg-amber-50 text-amber-800 border-amber-200',
  moderate: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  low:      'bg-emerald-50 text-emerald-700 border-emerald-200',
  strong:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  ok:       'bg-yellow-50 text-yellow-800 border-yellow-200',
}

function tierClass(tier: EntityCardTier): string {
  if (!tier) return 'bg-gray-50 text-gray-700 border-gray-200'
  return RISK_TIER_STYLE[tier] ?? 'bg-gray-50 text-gray-700 border-gray-200'
}

function tierLabel(tier: EntityCardTier): string {
  if (!tier) return ''
  return tier[0].toUpperCase() + tier.slice(1)
}

function ScorePill({ score }: { score: EntityCardScore | null }) {
  if (!score) return null
  return (
    <div className="flex flex-col items-end shrink-0">
      <span className="text-[9px] font-medium text-gray-500 uppercase tracking-wide">{score.label}</span>
      <span
        className={cn(
          'text-xs font-semibold px-2 py-0.5 rounded-md border mt-0.5',
          tierClass(score.tier)
        )}
      >
        {score.value}
        {score.tier && (
          <span className="ml-1 opacity-70 font-normal">{tierLabel(score.tier)}</span>
        )}
      </span>
    </div>
  )
}

export function EntityCardList({ cards }: { cards: EntityCard[] }) {
  if (cards.length === 0) return null
  const isEmployee = cards[0].entity_type === 'employee'
  const Icon = isEmployee ? Users : Building2
  return (
    <div className="space-y-2 mb-2">
      <div className="flex items-center gap-1.5 text-[10px] font-medium text-gray-500 uppercase tracking-wide">
        <Icon className="w-3 h-3" />
        {cards.length} {isEmployee ? 'employee' : 'customer'}{cards.length === 1 ? '' : 's'}
      </div>
      {cards.map(card => (
        <EntityCardRow key={card.entity_id} card={card} />
      ))}
    </div>
  )
}

function EntityCardRow({ card }: { card: EntityCard }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 hover:border-indigo-200 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 truncate">{card.name}</p>
          {card.subtitle && (
            <p className="text-[11px] text-gray-500 truncate">{card.subtitle}</p>
          )}
        </div>
        <ScorePill score={card.primary_score} />
      </div>

      {(card.secondary_score || card.stat || card.revenue_at_risk) && (
        <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-600">
          {card.secondary_score && (
            <span className="flex items-center gap-1">
              <span className="text-gray-400">{card.secondary_score.label}:</span>
              <span className={cn('font-medium', card.secondary_score.tier ? 'text-gray-800' : 'text-gray-700')}>
                {card.secondary_score.value}
              </span>
            </span>
          )}
          {card.stat && (
            <span className="flex items-center gap-1">
              <span className="text-gray-400">{card.stat.label}:</span>
              <span className="font-medium text-gray-800">{card.stat.value}</span>
            </span>
          )}
          {card.revenue_at_risk && (
            <span className="flex items-center gap-1 text-red-600">
              <AlertTriangle className="w-3 h-3" />
              <span className="font-medium">{card.revenue_at_risk} at risk</span>
            </span>
          )}
        </div>
      )}

      {card.rationale && (
        <p className="text-[11px] text-gray-600 leading-snug mt-2 italic">
          “{card.rationale}”
        </p>
      )}
    </div>
  )
}
