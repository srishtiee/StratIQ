'use client'

import { useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { PageHeader } from '@/components/shared/page-header'
import { FilterBar } from '@/components/shared/filter-bar'
import { KpiCard } from '@/components/shared/kpi-card'
import { ChurnTable } from '@/components/retention/churn-table'
import { HealthChart } from '@/components/retention/health-chart'
import { RevenueAtRisk } from '@/components/retention/revenue-at-risk'
import { ActionPanel } from '@/components/shared/action-panel'
import { DonutChart } from '@/components/charts/donut-chart'
import { BarChartComponent } from '@/components/charts/bar-chart'
import { RiskBadge } from '@/components/shared/risk-badge'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { TakeActionMenu } from '@/components/shared/take-action-menu'
import { formatCurrency } from '@/lib/utils'
import { Mail, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { useCustomers, useRetentionSummary, useCustomer } from '@/lib/api/hooks'
import type { ApiCustomer } from '@/lib/api/types'

const suggestedActions = [
  { type: 'pdf_report' as const, title: 'Generate At-Risk Account Report', description: 'Full PDF analysis of 5 at-risk accounts with intervention strategies.' },
  { type: 'email_send' as const, title: 'Send Intervention Emails', description: 'Personalized emails to executive contacts at TechCorp and Meridian Health.' },
  { type: 'task' as const, title: 'Create Intervention Tasks', description: 'Assign urgent intervention tasks to CSMs for all high-risk accounts.' },
]

const churnSignalData = [
  { name: 'Usage Drop', value: 68 },
  { name: 'Low NPS', value: 52 },
  { name: 'Support Tickets', value: 45 },
  { name: 'Login Inactivity', value: 38 },
]

const calculateDaysToRenewal = (renewalDate: string): number => {
  const now = new Date()
  const renewal = new Date(renewalDate)
  return Math.ceil((renewal.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

const generateHealthTrendData = (baseScore: number) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
  return months.map((month, i) => ({
    month,
    score: Math.max(20, Math.min(100, baseScore + (i - 3) * 3 + (Math.random() - 0.5) * 5)),
  }))
}

export default function RetentionPage() {
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab') ?? 'overview'
  const { data: customers = [], isLoading } = useCustomers()
  const { data: summary } = useRetentionSummary()
  const [selectedCustomer, setSelectedCustomer] = useState<ApiCustomer | null>(null)
  const { data: customerDetail } = useCustomer(selectedCustomer?.id ?? null)
  const [slideoverOpen, setSlideoverOpen] = useState(false)
  const [topAtRiskExpanded, setTopAtRiskExpanded] = useState(false)

  const handleRowClick = (customer: ApiCustomer) => {
    setSelectedCustomer(customer)
    setSlideoverOpen(true)
  }

  const avgHealth = useMemo(() => {
    if (!customers.length) return 0
    return Math.round(customers.reduce((s, c) => s + (c.latest_health_score ?? 0), 0) / customers.length)
  }, [customers])

  const highRiskCount = useMemo(
    () => customers.filter(c => (c.latest_churn_score ?? 0) >= 70).length,
    [customers]
  )

  const atRiskAccounts = useMemo(
    () => customers.filter(c => (c.latest_churn_score ?? 0) >= 70),
    [customers]
  )

  const totalARR = summary?.total_arr ?? customers.reduce((s, c) => s + c.arr, 0)
  const atRiskARR = summary?.arr_at_risk ?? atRiskAccounts.reduce((s, c) => s + c.arr, 0)

  const highRiskARR = atRiskAccounts.reduce((sum, c) => sum + c.arr, 0)
  const avgChurnScore = atRiskAccounts.length
    ? Math.round(atRiskAccounts.reduce((sum, c) => sum + (c.latest_churn_score ?? 0), 0) / atRiskAccounts.length)
    : 0
  const avgDaysToRenewal = atRiskAccounts.length
    ? Math.round(atRiskAccounts.reduce((sum, c) => sum + calculateDaysToRenewal(c.renewal_date), 0) / atRiskAccounts.length)
    : 0

  const healthDist = useMemo(() => [
    { name: 'Healthy (70+)', value: customers.filter(c => (c.latest_health_score ?? 0) >= 70).length, color: '#22c55e' },
    { name: 'Neutral (40-69)', value: customers.filter(c => { const s = c.latest_health_score ?? 0; return s >= 40 && s < 70 }).length, color: '#f59e0b' },
    { name: 'At Risk (<40)', value: customers.filter(c => (c.latest_health_score ?? 0) < 40).length, color: '#ef4444' },
  ], [customers])

  const topAtRisk = useMemo(
    () => [...customers].filter(c => (c.latest_churn_score ?? 0) >= 60)
      .sort((a, b) => (b.latest_churn_score ?? 0) - (a.latest_churn_score ?? 0)),
    [customers]
  )

  if (isLoading) {
    return (
      <div className="max-w-[1400px] mx-auto flex items-center justify-center py-20 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading Customer Retention…
      </div>
    )
  }

  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeader title="Customer Retention" description="Customer health monitoring and churn prevention" />

      <div className="mb-4">
        <FilterBar showDateRange />
      </div>

      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          <Tabs value={tab}>
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard value={formatCurrency(totalARR, true)} label="Total ARR" change={2.4} changeLabel="vs plan" trend="up" sparklineData={[3800, 3900, 4000, 4100, 4150, 4180, 4200, totalARR / 1000]} status="good" />
                <KpiCard value={formatCurrency(atRiskARR, true)} label="ARR at Risk" change={40} changeLabel="vs Q1" trend="up" sparklineData={[400, 480, 560, 620, 700, 760, 800, atRiskARR / 1000]} status="danger" />
                <KpiCard value={avgHealth} label="Avg Health Score" change={Math.round(((avgHealth - 70) / 70) * 100)} changeLabel="vs target" trend={avgHealth >= 70 ? 'up' : 'down'} sparklineData={[72, 71, 70, 69, 68, 66, 65, avgHealth]} status={avgHealth >= 70 ? 'good' : 'warning'} />
                <KpiCard value={highRiskCount} label="High-Risk Accounts" change={66.7} changeLabel="vs Q1" trend="up" sparklineData={[2, 2, 3, 3, 4, 4, 5, highRiskCount]} status="danger" />
              </div>

              <RevenueAtRisk />

              <div className="rounded-xl border border-[#e8e8ef] bg-white shadow-sm p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Churn Signal Breakdown</h3>
                <BarChartComponent data={churnSignalData} dataKey="value" xKey="name" color="#ef4444" height={240} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="rounded-xl border border-[#e8e8ef] bg-white shadow-sm p-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Health Distribution</h3>
                  <DonutChart data={healthDist} height={200} />
                </div>

                <div className="lg:col-span-2 rounded-xl border border-[#e8e8ef] bg-white shadow-sm p-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Top At-Risk Accounts</h3>
                  <div className="space-y-2">
                    {(topAtRiskExpanded ? topAtRisk : topAtRisk.slice(0, 5)).map(c => (
                      <button
                        key={c.id}
                        onClick={() => handleRowClick(c)}
                        className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-red-50 border border-red-100 hover:bg-red-100/50 transition-colors text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-800">{c.name}</p>
                          <p className="text-[10px] text-gray-400">
                            {c.segment} · CSM: {c.user_profiles?.name?.split(' ')[0] ?? 'N/A'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-700 font-medium">{formatCurrency(c.arr, true)}</p>
                          <p className="text-[10px] text-gray-400">
                            Renews {new Date(c.renewal_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                        <RiskBadge score={c.latest_churn_score ?? 0} />
                        <Mail className="w-3 h-3 text-gray-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                  {topAtRisk.length > 5 && (
                    <button
                      onClick={() => setTopAtRiskExpanded(e => !e)}
                      className="mt-2 w-full flex items-center justify-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-700 font-medium py-1.5 rounded-md hover:bg-indigo-50/50 transition-colors"
                    >
                      {topAtRiskExpanded ? (
                        <>
                          <ChevronUp className="w-3 h-3" /> Show less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3 h-3" /> See more ({topAtRisk.length - 5})
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="at-risk" className="space-y-4">
              <div className="rounded-xl border border-[#e8e8ef] bg-white shadow-sm p-4">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">High-Risk Accounts</p>
                    <p className="text-2xl font-semibold text-gray-900">{atRiskAccounts.length}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">ARR at Risk</p>
                    <p className="text-2xl font-semibold text-gray-900">{formatCurrency(highRiskARR, true)}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Avg Churn Score</p>
                    <p className="text-2xl font-semibold text-gray-900">{avgChurnScore}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Days to Renewal (avg)</p>
                    <p className="text-2xl font-semibold text-gray-900">{avgDaysToRenewal}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[#e8e8ef] bg-white shadow-sm p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">At-Risk Account Details</h3>
                <ChurnTable data={customers} onRowClick={handleRowClick} />
              </div>
            </TabsContent>

            <TabsContent value="health">
              <HealthChart />
            </TabsContent>
          </Tabs>
        </div>

        <div className="w-72 shrink-0">
          <ActionPanel actions={suggestedActions} />
        </div>
      </div>

      <Sheet open={slideoverOpen} onOpenChange={setSlideoverOpen}>
        <SheetContent side="right" className="w-[500px] max-w-[90vw] p-0">
          {selectedCustomer && (
            <>
              <SheetHeader className="border-b border-[#e8e8ef] p-4 pr-12">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <SheetTitle className="text-base">{selectedCustomer.name}</SheetTitle>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="text-[10px]">{selectedCustomer.segment}</Badge>
                      <p className="text-xs text-gray-500">
                        CSM: {selectedCustomer.user_profiles?.name ?? 'N/A'}
                      </p>
                    </div>
                  </div>
                  <TakeActionMenu
                    entityKind="customer"
                    entityId={selectedCustomer.id}
                    entityName={selectedCustomer.name}
                  />
                </div>
              </SheetHeader>

              <div className="p-4 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 120px)' }}>
                <div className="rounded-lg border-2 border-red-200 bg-red-50/50 p-4">
                  <div className="flex items-baseline justify-between">
                    <p className="text-xs text-red-700 uppercase font-medium tracking-wide">Churn Score</p>
                    <p className="text-3xl font-bold text-red-600">{selectedCustomer.latest_churn_score ?? 0}</p>
                  </div>
                  <p className="text-[11px] text-red-600 mt-2">
                    {(selectedCustomer.latest_churn_score ?? 0) >= 70
                      ? 'High Risk — Immediate intervention needed'
                      : 'Moderate Risk — Monitor closely'}
                  </p>
                </div>

                <div className="rounded-lg border border-[#e8e8ef] bg-gray-50 p-3">
                  <p className="text-xs text-gray-500 mb-3">Account Details</p>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-600">Annual Recurring Revenue (ARR)</span>
                      <span className="text-xs font-medium text-gray-900">{formatCurrency(selectedCustomer.arr)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-600">Renewal Date</span>
                      <span className="text-xs font-medium text-gray-900">
                        {new Date(selectedCustomer.renewal_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-600">Days Until Renewal</span>
                      <span className={`text-xs font-medium ${calculateDaysToRenewal(selectedCustomer.renewal_date) < 30 ? 'text-red-600' : 'text-gray-900'}`}>
                        {calculateDaysToRenewal(selectedCustomer.renewal_date)} days
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-600">Health Score</span>
                      <span className={`text-xs font-medium ${(selectedCustomer.latest_health_score ?? 0) >= 70 ? 'text-green-600' : (selectedCustomer.latest_health_score ?? 0) >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                        {selectedCustomer.latest_health_score ?? '—'}
                      </span>
                    </div>
                    {selectedCustomer.latest_revenue_at_risk != null && selectedCustomer.latest_revenue_at_risk > 0 && (
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-600">Revenue at Risk</span>
                        <span className="text-xs font-medium text-red-600">{formatCurrency(selectedCustomer.latest_revenue_at_risk)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* AI Rationale — latest reasoning from ai_entity_reasoning */}
                {(customerDetail?.ai_entity_reasoning?.[0]?.reasoning ||
                  customerDetail?.customer_scores?.[0]?.ai_rationale) && (
                  <div className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-[10px] font-semibold text-indigo-700 uppercase tracking-wide">AI Rationale</span>
                      {customerDetail?.ai_entity_reasoning?.[0]?.created_at && (
                        <span className="text-[10px] text-gray-400">
                          {new Date(customerDetail.ai_entity_reasoning[0].created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed">
                      {customerDetail?.ai_entity_reasoning?.[0]?.reasoning ||
                        customerDetail?.customer_scores?.[0]?.ai_rationale}
                    </p>
                  </div>
                )}

                {/* Score History — last few re-scoring runs */}
                {customerDetail?.customer_scores && customerDetail.customer_scores.length > 0 && (
                  <div className="rounded-lg border border-[#e8e8ef] bg-white p-3">
                    <p className="text-xs text-gray-500 mb-2">Score History</p>
                    <div className="space-y-1.5">
                      {customerDetail.customer_scores.slice(0, 4).map((s, i) => {
                        const prev = customerDetail.customer_scores[i + 1]
                        const delta =
                          prev && s.churn_score != null && prev.churn_score != null
                            ? Number(s.churn_score) - Number(prev.churn_score)
                            : null
                        return (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span className="text-gray-500">
                              {new Date(s.scored_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              {s.trigger_type && (
                                <span className="ml-1.5 text-[10px] text-gray-400">· {s.trigger_type}</span>
                              )}
                            </span>
                            <span className="flex items-center gap-2">
                              <span className="font-medium text-gray-800">
                                Churn {s.churn_score != null ? Math.round(Number(s.churn_score)) : '—'}
                              </span>
                              {delta != null && delta !== 0 && (
                                <span className={`text-[10px] font-medium ${delta > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                  {delta > 0 ? '+' : ''}{Math.round(delta)}
                                </span>
                              )}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="rounded-lg border border-[#e8e8ef] bg-white p-3">
                  <p className="text-xs text-gray-500 mb-3 font-medium">6-Month Health Trend</p>
                  <ResponsiveContainer width="100%" height={150}>
                    <LineChart data={generateHealthTrendData(selectedCustomer.latest_health_score ?? 50)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f5" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#9ca3af' }} width={30} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #e8e8ef', borderRadius: '8px' }}
                        formatter={(value) => [(value as number).toFixed(0), 'Score']}
                      />
                      <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', r: 3 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <SheetFooter className="border-t border-[#e8e8ef] p-4">
                <div className="flex gap-2 w-full">
                  <Button className="flex-1 h-8 text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200">
                    Draft Email
                  </Button>
                  <Button className="flex-1 h-8 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200">
                    Create Task
                  </Button>
                </div>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
