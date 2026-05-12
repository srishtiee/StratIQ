'use client'

import { useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { FilterBar } from '@/components/shared/filter-bar'
import { PageHeader } from '@/components/shared/page-header'
import { KpiCard } from '@/components/shared/kpi-card'
import { EmployeeRiskTable } from '@/components/people/employee-risk-table'
import { AttritionChart } from '@/components/people/attrition-chart'
import { CompensationChart } from '@/components/people/compensation-chart'
import { ActionPanel } from '@/components/shared/action-panel'
import { RiskHeatmap } from '@/components/charts/risk-heatmap'
import { DonutChart } from '@/components/charts/donut-chart'
import { RiskBadge } from '@/components/shared/risk-badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { TakeActionMenu } from '@/components/shared/take-action-menu'
import { Badge } from '@/components/ui/badge'
import { Download, FileText, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useEmployees, useEmployee } from '@/lib/api/hooks'
import type { ApiEmployee } from '@/lib/api/types'

const suggestedActions = [
  { type: 'task' as const, title: 'Compensation Review: 5 Underpaid High Performers', description: 'Create a compensation adjustment task for HR to review 5 engineers with compa-ratio below 0.87.' },
  { type: 'pdf_report' as const, title: 'Generate Attrition Review Report', description: 'Full PDF analysis of Engineering attrition with root cause breakdown and recommendations.' },
  { type: 'email_send' as const, title: 'Send Retention Risk Alert to Managers', description: 'Notify people managers of their direct reports with high attrition risk scores.' },
]

const calculateTenureYears = (hireDate: string) => {
  const hire = new Date(hireDate)
  const now = new Date()
  return Math.floor((now.getTime() - hire.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
}

const calculateReadinessScore = (performanceScore: number, tenureYears: number): number => {
  return Math.round((performanceScore * 0.7) + (tenureYears * 5))
}

export default function PeoplePage() {
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab') ?? 'overview'
  const { data: employees = [], isLoading } = useEmployees()
  const [selectedEmployee, setSelectedEmployee] = useState<ApiEmployee | null>(null)
  const { data: employeeDetail } = useEmployee(selectedEmployee?.id ?? null)
  const [slideoverOpen, setSlideoverOpen] = useState(false)

  const handleRowClick = (employee: ApiEmployee) => {
    setSelectedEmployee(employee)
    setSlideoverOpen(true)
  }

  const totalHeadcount = employees.length
  const avgEngagement = useMemo(() => {
    if (!employees.length) return 0
    return Math.round(employees.reduce((s, e) => s + (e.latest_engagement_score ?? 0), 0) / employees.length)
  }, [employees])

  const avgCompa = useMemo(() => {
    if (!employees.length) return '0.00'
    const avg = employees.reduce((s, e) => s + (e.compensation?.compa_ratio ?? 0), 0) / employees.length
    return avg.toFixed(2)
  }, [employees])

  const riskDist = useMemo(() => [
    { name: 'High Risk (70+)', value: employees.filter(e => (e.latest_attrition_risk_score ?? 0) >= 70).length, color: '#ef4444' },
    { name: 'Medium Risk (40-69)', value: employees.filter(e => { const s = e.latest_attrition_risk_score ?? 0; return s >= 40 && s < 70 }).length, color: '#f59e0b' },
    { name: 'Low Risk (<40)', value: employees.filter(e => (e.latest_attrition_risk_score ?? 0) < 40).length, color: '#22c55e' },
  ], [employees])

  const topRisk = useMemo(
    () => [...employees].sort((a, b) => (b.latest_attrition_risk_score ?? 0) - (a.latest_attrition_risk_score ?? 0)).slice(0, 10),
    [employees]
  )

  const underpaidHighPerformers = useMemo(
    () => employees.filter(e => (e.latest_performance_score ?? 0) >= 80 && (e.compensation?.compa_ratio ?? 0) < 0.90),
    [employees]
  )

  const promotionCandidates = useMemo(
    () => employees.filter(e =>
      (e.latest_performance_score ?? 0) >= 85 &&
      (e.latest_engagement_score ?? 0) >= 60 &&
      calculateTenureYears(e.hire_date) >= 2
    ),
    [employees]
  )

  const topAttritionRisk = useMemo(
    () => [...employees].filter(e => (e.latest_attrition_risk_score ?? 0) >= 70)
      .sort((a, b) => (b.latest_attrition_risk_score ?? 0) - (a.latest_attrition_risk_score ?? 0))
      .slice(0, 2),
    [employees]
  )

  if (isLoading) {
    return (
      <div className="max-w-[1400px] mx-auto flex items-center justify-center py-20 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading People Intelligence…
      </div>
    )
  }

  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeader title="People Intelligence" description="Workforce analytics and attrition risk management" />

      <div className="mb-4">
        <FilterBar showDepartment showDateRange showRiskLevel />
      </div>

      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          <Tabs value={tab}>
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard value={totalHeadcount} label="Total Headcount" change={-8.4} changeLabel="vs plan" trend="down" sparklineData={[95, 93, 92, 91, 90, 89, 88, totalHeadcount]} status="warning" />
                <KpiCard value="18" suffix="%" label="Attrition Rate" change={50} changeLabel="vs target" trend="up" sparklineData={[9, 10, 11, 13, 15, 16, 17, 18]} status="danger" />
                <KpiCard value={avgEngagement} label="Avg Engagement" change={-17.3} changeLabel="vs target" trend="down" sparklineData={[78, 76, 74, 71, 69, 66, 64, avgEngagement]} status="danger" />
                <KpiCard value={avgCompa} suffix="x" label="Avg Compa Ratio" change={-4.2} changeLabel="vs target" trend="down" sparklineData={[0.97, 0.96, 0.95, 0.94, 0.93, 0.92, 0.91, parseFloat(avgCompa)]} status="warning" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2"><AttritionChart /></div>
                <div className="rounded-xl border border-[#e8e8ef] bg-white shadow-sm p-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Risk Distribution</h3>
                  <DonutChart data={riskDist} height={200} />
                </div>
              </div>

              <div className="rounded-xl border border-[#e8e8ef] bg-white shadow-sm p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Employee Risk Table</h3>
                <EmployeeRiskTable data={employees} onRowClick={handleRowClick} />
              </div>

              {underpaidHighPerformers.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-sm font-medium text-gray-900">Underpaid High Performers</h3>
                    <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-xs">{underpaidHighPerformers.length}</Badge>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-amber-200">
                          <th className="text-left py-2 px-3 text-gray-600 font-medium">Name</th>
                          <th className="text-left py-2 px-3 text-gray-600 font-medium">Dept</th>
                          <th className="text-left py-2 px-3 text-gray-600 font-medium">Performance</th>
                          <th className="text-left py-2 px-3 text-gray-600 font-medium">Compa-Ratio</th>
                          <th className="text-left py-2 px-3 text-gray-600 font-medium">Market Benchmark</th>
                          <th className="text-left py-2 px-3 text-gray-600 font-medium">Gap to Market</th>
                          <th className="text-left py-2 px-3 text-gray-600 font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {underpaidHighPerformers.map(e => {
                          const salary = e.compensation?.salary ?? 0
                          const benchmark = e.compensation?.market_benchmark ?? 0
                          const ratio = e.compensation?.compa_ratio ?? 0
                          return (
                            <tr key={e.id} className="border-b border-amber-100 hover:bg-white/50">
                              <td className="py-2.5 px-3 text-gray-800 font-medium">{e.name}</td>
                              <td className="py-2.5 px-3 text-gray-600">{e.department}</td>
                              <td className="py-2.5 px-3"><span className="text-green-600 font-medium">{e.latest_performance_score}</span></td>
                              <td className="py-2.5 px-3"><span className="text-amber-600 font-medium">{ratio.toFixed(2)}x</span></td>
                              <td className="py-2.5 px-3 text-gray-600">{formatCurrency(benchmark, true)}</td>
                              <td className="py-2.5 px-3"><span className="text-red-600 font-medium">{formatCurrency(benchmark - salary)}</span></td>
                              <td className="py-2.5 px-3">
                                <Button size="sm" className="h-6 text-[10px] bg-white hover:bg-amber-100 text-amber-700 border border-amber-300">
                                  Create Action
                                </Button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {promotionCandidates.length > 0 && (
                <div className="rounded-xl border border-[#e8e8ef] bg-white shadow-sm p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-sm font-medium text-gray-900">Promotion Candidates</h3>
                    <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 text-xs">{promotionCandidates.length}</Badge>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[#e8e8ef]">
                          <th className="text-left py-2 px-3 text-gray-600 font-medium">Name</th>
                          <th className="text-left py-2 px-3 text-gray-600 font-medium">Dept</th>
                          <th className="text-left py-2 px-3 text-gray-600 font-medium">Role</th>
                          <th className="text-left py-2 px-3 text-gray-600 font-medium">Tenure</th>
                          <th className="text-left py-2 px-3 text-gray-600 font-medium">Performance</th>
                          <th className="text-left py-2 px-3 text-gray-600 font-medium">Readiness</th>
                          <th className="text-left py-2 px-3 text-gray-600 font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {promotionCandidates.map(e => {
                          const tenure = calculateTenureYears(e.hire_date)
                          const readiness = calculateReadinessScore(e.latest_performance_score ?? 0, tenure)
                          return (
                            <tr key={e.id} className="border-b border-[#e8e8ef] hover:bg-gray-50/50">
                              <td className="py-2.5 px-3 text-gray-800 font-medium">{e.name}</td>
                              <td className="py-2.5 px-3 text-gray-600">{e.department}</td>
                              <td className="py-2.5 px-3 text-gray-600">{e.role}</td>
                              <td className="py-2.5 px-3 text-gray-600">{tenure} yrs</td>
                              <td className="py-2.5 px-3"><span className="text-green-600 font-medium">{e.latest_performance_score}</span></td>
                              <td className="py-2.5 px-3"><span className="text-indigo-600 font-medium">{readiness}/100</span></td>
                              <td className="py-2.5 px-3">
                                <Button size="sm" className="h-6 text-[10px] bg-white hover:bg-indigo-50 text-indigo-600 border border-indigo-200">
                                  View Profile
                                </Button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="risk" className="space-y-4">
              <div className="rounded-xl border border-[#e8e8ef] bg-white shadow-sm p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-4">Attrition Risk Heatmap — Department × Tenure</h3>
                <RiskHeatmap />
              </div>

              <div className="rounded-xl border border-[#e8e8ef] bg-white shadow-sm p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Top At-Risk Employees — Risk Factor Breakdown</h3>
                <div className="space-y-3">
                  {topRisk.map(e => {
                    const score = e.latest_attrition_risk_score ?? 0
                    const engagement = e.latest_engagement_score ?? 0
                    const ratio = e.compensation?.compa_ratio ?? 0
                    return (
                      <div key={e.id} className="flex items-center gap-4 p-3 rounded-lg bg-gray-50 border border-[#e8e8ef]">
                        <div className="w-40 shrink-0">
                          <p className="text-xs font-medium text-gray-800">{e.name}</p>
                          <p className="text-[10px] text-gray-400">{e.department} · {e.level}</p>
                        </div>
                        <RiskBadge score={score} showScore />
                        <div className="flex-1 grid grid-cols-4 gap-2">
                          {[
                            { label: 'Compensation', value: Math.round((1 - ratio) * 150) },
                            { label: 'Engagement', value: Math.round((1 - engagement / 100) * 100) },
                            { label: 'Performance', value: Math.round((e.latest_performance_score ?? 0) * 0.5) },
                            { label: 'Tenure Risk', value: Math.round(score * 0.4) },
                          ].map(f => (
                            <div key={f.label}>
                              <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
                                <span>{f.label}</span>
                                <span>{Math.min(f.value, 100)}%</span>
                              </div>
                              <Progress value={Math.min(f.value, 100)} className="h-1 bg-gray-100" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="compensation">
              <CompensationChart />
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="w-72 shrink-0 space-y-4">
          <ActionPanel actions={suggestedActions} />

          <div className="rounded-xl border border-[#e8e8ef] bg-white shadow-sm p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Export Options</p>
            <div className="space-y-2">
              <Button className="w-full h-8 text-xs bg-gray-50 hover:bg-gray-100 text-gray-700 border border-[#e8e8ef] gap-2">
                <Download className="w-3 h-3" /> Export as CSV
              </Button>
              <Button className="w-full h-8 text-xs bg-gray-50 hover:bg-gray-100 text-gray-700 border border-[#e8e8ef] gap-2">
                <FileText className="w-3 h-3" /> Export as PDF
              </Button>
            </div>
          </div>

          {topAttritionRisk.length > 0 && (
            <div className="rounded-xl border border-[#e8e8ef] bg-white shadow-sm p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Related Entities</p>
              <div className="space-y-2">
                {topAttritionRisk.map(e => (
                  <button
                    key={e.id}
                    onClick={() => handleRowClick(e)}
                    className="w-full text-left p-2.5 rounded-lg border border-[#e8e8ef] hover:bg-indigo-50/50 hover:border-indigo-200 transition-colors group"
                  >
                    <p className="text-xs font-medium text-gray-900 group-hover:text-indigo-600">{e.name}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-[10px] text-gray-400">{e.department}</p>
                      <RiskBadge score={e.latest_attrition_risk_score ?? 0} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <Sheet open={slideoverOpen} onOpenChange={setSlideoverOpen}>
        <SheetContent side="right" className="w-[500px] max-w-[90vw] p-0">
          {selectedEmployee && (
            <>
              <SheetHeader className="border-b border-[#e8e8ef] p-4 pr-12">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <SheetTitle className="text-base">{selectedEmployee.name}</SheetTitle>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="text-[10px]">{selectedEmployee.department}</Badge>
                      <p className="text-xs text-gray-500">{selectedEmployee.role}</p>
                    </div>
                  </div>
                  <TakeActionMenu
                    entityKind="employee"
                    entityId={selectedEmployee.id}
                    entityName={selectedEmployee.name}
                    entityEmail={selectedEmployee.email}
                  />
                </div>
              </SheetHeader>

              <div className="p-4 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 100px)' }}>
                <div className="grid grid-cols-2 gap-3">
                  <KpiCard value={selectedEmployee.latest_performance_score ?? 0} label="Performance Score" status="good" />
                  <KpiCard value={selectedEmployee.latest_engagement_score ?? 0} label="Engagement Score" status={(selectedEmployee.latest_engagement_score ?? 0) >= 65 ? 'good' : 'danger'} />
                  <KpiCard value={(selectedEmployee.compensation?.compa_ratio ?? 0).toFixed(2)} suffix="x" label="Compa-Ratio" status={(selectedEmployee.compensation?.compa_ratio ?? 0) >= 0.92 ? 'good' : 'warning'} />
                  <KpiCard value={selectedEmployee.latest_attrition_risk_score ?? 0} label="Risk Score" status={(selectedEmployee.latest_attrition_risk_score ?? 0) >= 70 ? 'danger' : 'warning'} />
                </div>

                {selectedEmployee.compensation && (
                  <div className="rounded-lg border border-[#e8e8ef] bg-gray-50 p-3">
                    <p className="text-xs text-gray-500 mb-2">Salary Information</p>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-600">Current Salary</span>
                        <span className="text-xs font-medium text-gray-900">{formatCurrency(selectedEmployee.compensation.salary)}</span>
                      </div>
                      {selectedEmployee.compensation.market_benchmark && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-xs text-gray-600">Market Benchmark</span>
                            <span className="text-xs font-medium text-gray-900">{formatCurrency(selectedEmployee.compensation.market_benchmark)}</span>
                          </div>
                          <div className="border-t border-[#e8e8ef] pt-2 flex justify-between">
                            <span className="text-xs font-medium text-gray-600">Gap</span>
                            <span className={`text-xs font-medium ${(selectedEmployee.compensation.market_benchmark - selectedEmployee.compensation.salary) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {formatCurrency(selectedEmployee.compensation.market_benchmark - selectedEmployee.compensation.salary)}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* AI Rationale — latest reasoning from ai_entity_reasoning */}
                {(employeeDetail?.ai_entity_reasoning?.[0]?.reasoning ||
                  employeeDetail?.employee_scores?.[0]?.ai_rationale) && (
                  <div className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-[10px] font-semibold text-indigo-700 uppercase tracking-wide">AI Rationale</span>
                      {employeeDetail?.ai_entity_reasoning?.[0]?.created_at && (
                        <span className="text-[10px] text-gray-400">
                          {new Date(employeeDetail.ai_entity_reasoning[0].created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed">
                      {employeeDetail?.ai_entity_reasoning?.[0]?.reasoning ||
                        employeeDetail?.employee_scores?.[0]?.ai_rationale}
                    </p>
                  </div>
                )}

                {/* Score History — last few re-scoring runs */}
                {employeeDetail?.employee_scores && employeeDetail.employee_scores.length > 0 && (
                  <div className="rounded-lg border border-[#e8e8ef] bg-white p-3">
                    <p className="text-xs text-gray-500 mb-2">Score History</p>
                    <div className="space-y-1.5">
                      {employeeDetail.employee_scores.slice(0, 4).map((s, i) => {
                        const prev = employeeDetail.employee_scores[i + 1]
                        const delta =
                          prev && s.attrition_risk_score != null && prev.attrition_risk_score != null
                            ? s.attrition_risk_score - prev.attrition_risk_score
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
                                Attrition {s.attrition_risk_score != null ? Math.round(Number(s.attrition_risk_score)) : '—'}
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

                <div className="flex gap-2">
                  <Button className="flex-1 h-8 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200">
                    Create Retention Action
                  </Button>
                  <Button className="flex-1 h-8 text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200">
                    Schedule 1:1
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
