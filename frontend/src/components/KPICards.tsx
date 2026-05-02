'use client';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import clsx from 'clsx';
import type { KPIItem } from '@/lib/api';

const ICONS: Record<string, string> = {
  churn_rate: '📉', mrr_at_risk: '💰', nps_avg: '⭐',
  at_risk_count: '⚠️', churned_count: '🔴', retention_rate: '💚',
};
const LABELS: Record<string, string> = {
  churn_rate: 'Churn Rate', mrr_at_risk: 'MRR at Risk',
  nps_avg: 'Avg NPS', at_risk_count: 'At-Risk Customers',
  churned_count: 'Churned', retention_rate: 'Retention Rate',
};

function formatKpiValue(kpi: KPIItem) {
  const value = typeof kpi.value === 'number' ? kpi.value : Number(kpi.value);
  switch (kpi.unit) {
    case '%':
      return `${value.toFixed(1)}%`;
    case 'k_usd':
      return `$${value.toFixed(0)}k`;
    case 'customers':
      return `${value.toFixed(0)}`;
    case 'score_0_10':
      return value.toFixed(1);
    default:
      return typeof kpi.value === 'number' ? kpi.value.toFixed(0) : String(kpi.value);
  }
}

function formatKpiUnit(kpi: KPIItem) {
  switch (kpi.unit) {
    case 'k_usd':
      return 'at risk';
    case 'score_0_10':
      return 'out of 10';
    case 'customers':
      return 'accounts';
    case '%':
      return 'rate';
    default:
      return kpi.unit ?? '';
  }
}

interface Props { kpis: KPIItem[]; loading?: boolean; }

function Skeleton() {
  return (
    <div className="card card-glow p-5 animate-pulse">
      <div className="w-20 h-3 rounded-full bg-[#1e2d45] mb-4" />
      <div className="w-28 h-8 rounded-lg bg-[#1e2d45] mb-2" />
      <div className="w-16 h-3 rounded-full bg-[#1e2d45]" />
    </div>
  );
}

export default function KPICards({ kpis, loading }: Props) {
  if (loading) return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} />)}
    </div>
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {kpis.map((kpi, i) => {
        const trend = kpi.trend ?? (kpi.name.includes('churn') ? 'up' : 'stable');
        const isNegative = ['churn_rate', 'mrr_at_risk', 'at_risk_count', 'churned_count'].includes(kpi.name);
        const trendBad = isNegative ? trend === 'up' : trend === 'down';

        return (
          <div key={kpi.name}
            className="card card-glow group cursor-default p-5 animate-fade-up"
            style={{ animationDelay: `${i * 60}ms` }}>
            <div className="mb-4 flex items-start justify-between">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2">
                <span className="text-lg">{ICONS[kpi.name] ?? '📊'}</span>
              </div>
              {kpi.change_pct != null && (
                <span className={clsx('badge', trendBad ? 'badge-down' : 'badge-up')}>
                  {trend === 'up' ? <ArrowUpRight className="w-3 h-3 inline" /> : trend === 'down' ? <ArrowDownRight className="w-3 h-3 inline" /> : <Minus className="w-3 h-3 inline" />}
                  {Math.abs(kpi.change_pct).toFixed(1)}%
                </span>
              )}
            </div>
            <p className="mb-1 font-outfit text-3xl font-bold text-[#f4f7ff]">
              {formatKpiValue(kpi)}
            </p>
            <p className="text-sm font-medium text-[#d8e3ff]">{LABELS[kpi.name] ?? kpi.name}</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-[#5e739d]">{formatKpiUnit(kpi)}</p>
          </div>
        );
      })}
    </div>
  );
}
