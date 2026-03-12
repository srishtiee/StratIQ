'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { AlertTriangle, Mail, CheckSquare } from 'lucide-react'
import { Customer } from '@/lib/mock-data/customers'
import { AreaChartComponent } from '@/components/charts/area-chart'

interface CustomerDetailSlideoverProps {
  customer: Customer | null
  open: boolean
  onClose: () => void
}

export function CustomerDetailSlideover({
  customer,
  open,
  onClose,
}: CustomerDetailSlideoverProps) {
  if (!customer) return null

  // Determine churn score color
  const churnColor = customer.churn_score < 40
    ? 'text-green-600'
    : customer.churn_score < 70
      ? 'text-amber-600'
      : 'text-red-600'

  const churnBg = customer.churn_score < 40
    ? 'bg-green-50'
    : customer.churn_score < 70
      ? 'bg-amber-50'
      : 'bg-red-50'

  // Calculate days to renewal
  const renewalDate = new Date(customer.renewal_date)
  const today = new Date()
  const daysToRenewal = Math.ceil((renewalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  const renewalColor = daysToRenewal < 30 ? 'text-red-600' : daysToRenewal < 60 ? 'text-amber-600' : 'text-green-600'

  // Mock health score trend data (derived from health_score)
  const healthTrend = [
    { month: '6m ago', value: customer.health_score + 18 },
    { month: '5m ago', value: customer.health_score + 15 },
    { month: '4m ago', value: customer.health_score + 12 },
    { month: '3m ago', value: customer.health_score + 8 },
    { month: '2m ago', value: customer.health_score + 4 },
    { month: 'Current', value: customer.health_score },
  ].map(d => ({ ...d, value: Math.min(100, Math.max(0, d.value)) }))

  // Derive churn signals from churn_score
  const usageTrend = Math.max(0, 100 - customer.churn_score * 1.2)
  const npsScore = Math.max(0, 70 - customer.churn_score)
  const supportTickets = Math.round(customer.churn_score * 0.8)
  const loginFrequency = Math.max(0, 100 - customer.churn_score * 1.1)

  // Extract main intervention from signal_summary
  const signals = customer.signal_summary.split(', ').slice(0, 3)

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:w-[500px] overflow-y-auto bg-white border-l border-[#e8e8ef]">
        {/* Header */}
        <SheetHeader className="pb-4 border-b border-[#e8e8ef]">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <SheetTitle className="text-lg text-gray-900">{customer.name}</SheetTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="text-xs">
                  {customer.segment}
                </Badge>
                <span className="text-xs text-gray-500">CSM: {customer.csm}</span>
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-5 mt-5">
          {/* Churn Score Section */}
          <div className={cn('rounded-xl border border-[#e8e8ef] p-4', churnBg)}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 font-medium mb-1">Churn Score</p>
                <p className={cn('text-3xl font-bold tracking-tight', churnColor)}>
                  {customer.churn_score}
                </p>
              </div>
              <AlertTriangle className={cn('w-6 h-6', churnColor)} />
            </div>
            <p className="text-xs text-gray-600 mt-2">
              {customer.churn_score < 40
                ? 'Healthy account — low churn risk'
                : customer.churn_score < 70
                  ? 'Moderate risk — monitor closely'
                  : 'High risk — immediate intervention needed'}
            </p>
          </div>

          {/* ARR & Renewal */}
          <div className="rounded-xl border border-[#e8e8ef] bg-gray-50 p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-600 font-medium mb-1">Annual Recurring Revenue</p>
                <p className="text-2xl font-bold text-gray-900 tracking-tight">
                  ${(customer.arr / 1000).toFixed(0)}K
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium mb-1">Renewal</p>
                <p className={cn('text-lg font-bold tracking-tight', renewalColor)}>
                  {daysToRenewal} days
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {renewalDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
              </div>
            </div>
          </div>

          {/* Health Metrics */}
          <div>
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-3">Health Metrics</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Health Score</span>
                <span className={cn('font-semibold', customer.health_score > 70 ? 'text-green-600' : customer.health_score > 40 ? 'text-amber-600' : 'text-red-600')}>
                  {customer.health_score}/100
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Churn Risk</span>
                <span className={cn('font-semibold', churnColor)}>
                  {customer.churn_score}%
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Last Activity</span>
                <span className="font-medium text-gray-900">
                  {new Date(customer.last_activity).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            </div>
          </div>

          {/* Churn Signals */}
          <div>
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-3">Churn Signals</h3>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-700 font-medium">Usage Trend</span>
                  <span className="text-xs font-semibold text-gray-900">{Math.round(usageTrend)}/100</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className={cn('h-2 rounded-full', usageTrend > 70 ? 'bg-green-500' : usageTrend > 40 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${usageTrend}%` }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-700 font-medium">NPS Score</span>
                  <span className="text-xs font-semibold text-gray-900">{Math.round(npsScore)}/100</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className={cn('h-2 rounded-full', npsScore > 50 ? 'bg-green-500' : npsScore > 30 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${Math.min(100, npsScore)}%` }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-700 font-medium">Support Tickets</span>
                  <span className="text-xs font-semibold text-gray-900">{supportTickets}/100</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className={cn('h-2 rounded-full', supportTickets < 30 ? 'bg-green-500' : supportTickets < 70 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${supportTickets}%` }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-700 font-medium">Login Frequency</span>
                  <span className="text-xs font-semibold text-gray-900">{Math.round(loginFrequency)}/100</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className={cn('h-2 rounded-full', loginFrequency > 70 ? 'bg-green-500' : loginFrequency > 40 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${loginFrequency}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Health Score Trend */}
          <div>
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-3">Health Score Trend</h3>
            <div className="rounded-lg border border-[#e8e8ef] bg-gray-50 p-3">
              <AreaChartComponent
                data={healthTrend}
                dataKey="value"
                xKey="month"
                color="#6366f1"
                height={140}
              />
            </div>
          </div>

          {/* Recommended Interventions */}
          <div>
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-3">Recommended Interventions</h3>
            <div className="space-y-2">
              {signals.map((signal, i) => (
                <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg border border-[#e8e8ef] bg-gray-50">
                  <span className="text-amber-600 text-sm mt-0.5 flex-shrink-0">•</span>
                  <p className="text-xs text-gray-700 leading-relaxed">{signal}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button className="bg-indigo-500 hover:bg-indigo-600 text-white text-sm gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              Draft Email
            </Button>
            <Button variant="outline" className="border-[#e8e8ef] text-gray-700 hover:text-gray-900 text-sm gap-1.5">
              <CheckSquare className="w-3.5 h-3.5" />
              Create Task
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
