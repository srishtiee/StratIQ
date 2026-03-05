'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Calendar, Mail, MessageSquare, AlertTriangle } from 'lucide-react'
import { Employee } from '@/lib/mock-data/employees'

interface EmployeeDetailSlideoverProps {
  employee: Employee | null
  open: boolean
  onClose: () => void
}

export function EmployeeDetailSlideover({
  employee,
  open,
  onClose,
}: EmployeeDetailSlideoverProps) {
  if (!employee) return null

  // Calculate tenure in years
  const hireDate = new Date(employee.hire_date)
  const today = new Date()
  const tenure = Math.floor((today.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25))

  // Determine risk score color
  const riskColor = employee.attrition_risk_score < 40
    ? 'text-green-600'
    : employee.attrition_risk_score < 70
      ? 'text-amber-600'
      : 'text-red-600'

  const riskBg = employee.attrition_risk_score < 40
    ? 'bg-green-50'
    : employee.attrition_risk_score < 70
      ? 'bg-amber-50'
      : 'bg-red-50'

  // Calculate attrition risk factors
  const compensationGap = Math.round(((employee.market_benchmark - employee.salary) / employee.market_benchmark) * 100)
  const engagementRisk = Math.max(0, Math.min(100, (100 - employee.engagement_score) * 1.5))
  const tenureRisk = Math.max(0, Math.min(100, tenure > 3 ? 45 : 30))

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:w-[500px] overflow-y-auto bg-white border-l border-[#e8e8ef]">
        {/* Header */}
        <SheetHeader className="pb-4 border-b border-[#e8e8ef]">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <SheetTitle className="text-lg text-gray-900">{employee.name}</SheetTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="text-xs">
                  {employee.department}
                </Badge>
                <span className="text-xs text-gray-500">{employee.role}</span>
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-5 mt-5">
          {/* Risk Score Section */}
          <div className={cn('rounded-xl border border-[#e8e8ef] p-4', riskBg)}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 font-medium mb-1">Attrition Risk Score</p>
                <p className={cn('text-3xl font-bold tracking-tight', riskColor)}>
                  {employee.attrition_risk_score}
                </p>
              </div>
              <AlertTriangle className={cn('w-6 h-6', riskColor)} />
            </div>
            <p className="text-xs text-gray-600 mt-2">
              {employee.attrition_risk_score < 40
                ? 'Low risk — stable engagement'
                : employee.attrition_risk_score < 70
                  ? 'Moderate risk — monitor closely'
                  : 'High risk — immediate action recommended'}
            </p>
          </div>

          {/* Profile Section */}
          <div>
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-3">Profile</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Level</span>
                <span className="font-medium text-gray-900">{employee.level}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Tenure</span>
                <span className="font-medium text-gray-900">{tenure} years</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Email</span>
                <span className="font-medium text-gray-900">{employee.email}</span>
              </div>
            </div>
          </div>

          {/* Performance Metrics */}
          <div>
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-3">Performance Metrics</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-[#e8e8ef] bg-gray-50 p-3">
                <p className="text-xs text-gray-600 mb-1">Performance Score</p>
                <p className="text-2xl font-semibold text-gray-900 tracking-tight">{employee.performance_score}</p>
              </div>
              <div className="rounded-lg border border-[#e8e8ef] bg-gray-50 p-3">
                <p className="text-xs text-gray-600 mb-1">Engagement Score</p>
                <p className={cn('text-2xl font-semibold tracking-tight', employee.engagement_score < 50 ? 'text-red-600' : 'text-green-600')}>
                  {employee.engagement_score}
                </p>
              </div>
              <div className="rounded-lg border border-[#e8e8ef] bg-gray-50 p-3">
                <p className="text-xs text-gray-600 mb-1">Compa-Ratio</p>
                <p className={cn('text-2xl font-semibold tracking-tight', employee.compa_ratio < 0.90 ? 'text-red-600' : 'text-green-600')}>
                  {employee.compa_ratio.toFixed(2)}x
                </p>
              </div>
              <div className="rounded-lg border border-[#e8e8ef] bg-gray-50 p-3">
                <p className="text-xs text-gray-600 mb-1">Attrition Risk</p>
                <p className={cn('text-2xl font-semibold tracking-tight', riskColor)}>
                  {employee.attrition_risk_score}
                </p>
              </div>
            </div>
          </div>

          {/* Compensation */}
          <div>
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-3">Compensation</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Current Salary</span>
                <span className="font-mono font-semibold text-gray-900">${(employee.salary / 1000).toFixed(0)}K</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Market Benchmark</span>
                <span className="font-mono font-semibold text-gray-900">${(employee.market_benchmark / 1000).toFixed(0)}K</span>
              </div>
              <div className={cn('rounded-lg border border-[#e8e8ef] bg-red-50 p-2.5', compensationGap > 15 ? 'bg-red-50' : 'bg-amber-50')}>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-700 font-medium">Gap to Market</span>
                  <span className={cn('text-sm font-semibold', compensationGap > 15 ? 'text-red-600' : 'text-amber-600')}>
                    ${((employee.market_benchmark - employee.salary) / 1000).toFixed(0)}K ({compensationGap}%)
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Last Review Date</span>
                <span className="font-medium text-gray-900">{new Date(employee.last_review_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
              </div>
            </div>
          </div>

          {/* Attrition Risk Factors */}
          <div>
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-3">Attrition Risk Factors</h3>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-700 font-medium">Compensation Gap</span>
                  <span className="text-xs font-semibold text-gray-900">{compensationGap}/100</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-red-500 h-2 rounded-full" style={{ width: `${compensationGap}%` }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-700 font-medium">Low Engagement</span>
                  <span className="text-xs font-semibold text-gray-900">{Math.round(engagementRisk)}/100</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${engagementRisk}%` }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-700 font-medium">Tenure Risk</span>
                  <span className="text-xs font-semibold text-gray-900">{tenureRisk}/100</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full" style={{ width: `${tenureRisk}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Recent Events */}
          <div>
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-3">Recent Events</h3>
            <div className="space-y-2">
              <div className="flex items-start gap-3 p-2.5 rounded-lg border border-[#e8e8ef] bg-gray-50">
                <Calendar className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900">Salary Review Completed</p>
                  <p className="text-[11px] text-gray-500">January 15, 2024</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-2.5 rounded-lg border border-[#e8e8ef] bg-gray-50">
                <Calendar className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900">Performance Review</p>
                  <p className="text-[11px] text-gray-500">January 15, 2024</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-2.5 rounded-lg border border-[#e8e8ef] bg-gray-50">
                <Calendar className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900">Engagement Survey Response</p>
                  <p className="text-[11px] text-gray-500">February 2024</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button className="bg-indigo-500 hover:bg-indigo-600 text-white text-sm gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Create Action
            </Button>
            <Button variant="outline" className="border-[#e8e8ef] text-gray-700 hover:text-gray-900 text-sm gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              Schedule 1:1
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
