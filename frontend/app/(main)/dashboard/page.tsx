'use client'

import { useMemo, useState } from 'react'
import { MorningBrief } from '@/components/dashboard/morning-brief'
import { AlertFeed } from '@/components/dashboard/alert-feed'
import { PendingApprovals } from '@/components/dashboard/pending-approvals'
import { RecentActions } from '@/components/dashboard/recent-actions'
import { KpiCard } from '@/components/shared/kpi-card'
import { ActionModal } from '@/components/shared/action-modal'
import { AreaChartComponent } from '@/components/charts/area-chart'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn, formatCurrency } from '@/lib/utils'
import { ArrowRight, Loader2 } from 'lucide-react'
import { useRetentionSummary, usePeopleSummary, useKpiHistory, useActions } from '@/lib/api/hooks'
import type { ApiAction } from '@/lib/api/types'

const moduleLabel: Record<string, string> = {
  people: 'People Intelligence',
  retention: 'Customer Retention',
  dashboard: 'Executive KPI',
}
const moduleColor: Record<string, string> = {
  people: 'bg-purple-100 text-purple-700',
  retention: 'bg-blue-100 text-blue-700',
  dashboard: 'bg-gray-100 text-gray-600',
}

export default function DashboardPage() {
  const [actionModalOpen, setActionModalOpen] = useState(false)
  const [selectedAction, setSelectedAction] = useState<ApiAction | null>(null)

  const { data: peopleSummary, isLoading: peopleLoading } = usePeopleSummary()
  const { data: retentionSummary, isLoading: retentionLoading } = useRetentionSummary()
  const { data: allHistory = [], isLoading: historyLoading } = useKpiHistory()
  const { data: allActions = [] } = useActions()

  const recommendedActions = allActions
    .filter((a: ApiAction) => ['draft', 'pending_approval'].includes(a.status))
    .slice(0, 3)

  const historyByName = useMemo(() => {
    const map: Record<string, { month: string; value: number }[]> = {}
    for (const row of allHistory) {
      if (!map[row.name]) map[row.name] = []
      map[row.name].push({ month: row.period, value: row.value })
    }
    return map
  }, [allHistory])

  const mrrData = historyByName['Monthly Recurring Revenue'] ?? []
  const attritionData = historyByName['Attrition Rate'] ?? []
  const healthScoreData = historyByName['Avg Customer Health Score'] ?? []
  const arrAtRiskData = historyByName['ARR at Risk'] ?? []

  const mrrSparkline = mrrData.map(d => d.value / 1000)
  const attritionSparkline = attritionData.map(d => d.value)
  const healthSparkline = healthScoreData.map(d => d.value)
  const arrSparkline = arrAtRiskData.map(d => d.value / 1000)

  const latestMrr = mrrData[mrrData.length - 1]?.value ?? 0
  const latestAttrition = attritionData[attritionData.length - 1]?.value ?? 0
  const latestHealth = retentionSummary?.avg_health_score ?? 0
  const latestArrRisk = retentionSummary?.arr_at_risk ?? 0
  const totalArr = retentionSummary?.total_arr ?? 0
  const headcount = peopleSummary?.total_employees ?? 0

  const openAction = (action: ApiAction) => {
    setSelectedAction(action)
    setActionModalOpen(true)
  }

  const isLoading = peopleLoading || retentionLoading || historyLoading

  return (
    <div className="max-w-[1400px] mx-auto space-y-4">
      {/* Row 1: Morning Brief */}
      <MorningBrief />

      {/* Row 2: KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <KpiCard
          value={formatCurrency(totalArr, true)}
          label="Total ARR"
          change={2.4}
          changeLabel="vs plan"
          trend="up"
          sparklineData={[3800, 3900, 4000, 4050, 4100, 4150, 4180, totalArr / 1000]}
          status="good"
        />
        <KpiCard
          value={Math.round(latestMrr / 1000)}
          suffix="K"
          label="Monthly Recurring Revenue"
          change={Math.round(((latestMrr - 364000) / 364000) * 100)}
          changeLabel="vs target"
          trend={latestMrr >= 364000 ? 'up' : 'down'}
          sparklineData={mrrSparkline.length ? mrrSparkline : [310, 325, 340, 350, 365, 358, 348, 342]}
          status={latestMrr >= 364000 ? 'good' : 'warning'}
          prefix="$"
        />
        <KpiCard
          value={headcount}
          label="Headcount"
          change={-8.4}
          changeLabel="vs plan"
          trend="down"
          sparklineData={[91, 92, 93, 91, 90, 89, 88, headcount]}
          status="warning"
        />
        <KpiCard
          value={latestAttrition}
          suffix="%"
          label="Attrition Rate"
          change={Math.round(((latestAttrition - 12) / 12) * 100)}
          changeLabel="vs target"
          trend={latestAttrition > 12 ? 'up' : 'down'}
          sparklineData={attritionSparkline.length ? attritionSparkline : [9, 10, 11, 12, 14, 15, 17, 18]}
          status={latestAttrition <= 12 ? 'good' : 'danger'}
        />
        <KpiCard
          value={Math.round(latestHealth)}
          label="Avg Health Score"
          change={Math.round(((latestHealth - 70) / 70) * 100)}
          changeLabel="vs target"
          trend={latestHealth >= 70 ? 'up' : 'down'}
          sparklineData={healthSparkline.length ? healthSparkline : [72, 71, 70, 69, 68, 66, 65, 64]}
          status={latestHealth >= 70 ? 'good' : 'warning'}
        />
        <KpiCard
          value={formatCurrency(latestArrRisk, true)}
          label="ARR at Risk"
          change={64}
          changeLabel="vs last qtr"
          trend="up"
          sparklineData={arrSparkline.length ? arrSparkline : [520, 540, 600, 620, 710, 765, 795, 820]}
          status="danger"
        />
      </div>

      {/* Row 3: Alert Feed & Pending Approvals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <AlertFeed />
        </div>
        <div>
          <PendingApprovals onSelect={openAction} />
        </div>
      </div>

      {/* Row 4: Recommended Actions */}
      {recommendedActions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Recommended Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {recommendedActions.map((action: ApiAction) => (
              <button
                key={action.id}
                onClick={() => openAction(action)}
                className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 flex flex-col text-left hover:bg-gray-50 transition-colors"
              >
                <div className="mb-3">
                  <h4 className="text-sm font-semibold text-gray-900 leading-tight mb-1">{action.title}</h4>
                  <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">{action.description}</p>
                </div>
                <div className="flex-1 flex items-end justify-between gap-2">
                  <Badge
                    variant="outline"
                    className={cn('text-xs', moduleColor[action.source_module ?? ''] ?? 'bg-gray-100 text-gray-600')}
                  >
                    {moduleLabel[action.source_module ?? ''] ?? action.source_module}
                  </Badge>
                  <ArrowRight className="w-3 h-3 text-gray-400" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Row 5: Recent Actions */}
      <RecentActions onSelect={openAction} />

      {/* Row 6: KPI Trend Charts */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">KPI Trends</h3>
        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading charts…
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-[#e8e8ef] bg-white shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-900">Monthly Recurring Revenue</h4>
                <span className="text-xs text-gray-400">{mrrData.length} months</span>
              </div>
              <AreaChartComponent
                data={mrrData.map(d => ({ month: d.month, value: Math.round(d.value / 1000) }))}
                dataKey="value"
                xKey="month"
                color="#6366f1"
                height={160}
                formatY={(v) => `$${v}K`}
              />
            </div>

            <div className="rounded-xl border border-[#e8e8ef] bg-white shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-900">Attrition Rate</h4>
                <span className="text-xs text-gray-400">{attritionData.length} months</span>
              </div>
              <AreaChartComponent
                data={attritionData}
                dataKey="value"
                xKey="month"
                color="#ef4444"
                height={160}
                formatY={(v) => `${v}%`}
              />
            </div>

            <div className="rounded-xl border border-[#e8e8ef] bg-white shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-900">Average Health Score</h4>
                <span className="text-xs text-gray-400">{healthScoreData.length} months</span>
              </div>
              <AreaChartComponent
                data={healthScoreData}
                dataKey="value"
                xKey="month"
                color="#f59e0b"
                height={160}
                formatY={(v) => `${v}`}
              />
            </div>

            <div className="rounded-xl border border-[#e8e8ef] bg-white shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-900">ARR at Risk</h4>
                <span className="text-xs text-gray-400">{arrAtRiskData.length} months</span>
              </div>
              <AreaChartComponent
                data={arrAtRiskData.map(d => ({ month: d.month, value: Math.round(d.value / 1000) }))}
                dataKey="value"
                xKey="month"
                color="#ef4444"
                height={160}
                formatY={(v) => `$${v}K`}
              />
            </div>
          </div>
        )}
      </div>

      <ActionModal
        open={actionModalOpen}
        onClose={() => setActionModalOpen(false)}
        action={selectedAction}
      />
    </div>
  )
}
