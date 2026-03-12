'use client'

import { LineChartComponent } from '@/components/charts/line-chart'
import { BarChartComponent } from '@/components/charts/bar-chart'

const healthData = [
  { month: 'Nov', TechCorp: 62, Meridian: 70, Quantum: 65, Apex: 72, Stellar: 80 },
  { month: 'Dec', TechCorp: 55, Meridian: 65, Quantum: 60, Apex: 68, Stellar: 82 },
  { month: 'Jan', TechCorp: 48, Meridian: 58, Quantum: 55, Apex: 65, Stellar: 80 },
  { month: 'Feb', TechCorp: 40, Meridian: 48, Quantum: 48, Apex: 58, Stellar: 79 },
  { month: 'Mar', TechCorp: 32, Meridian: 38, Quantum: 40, Apex: 50, Stellar: 78 },
  { month: 'Apr', TechCorp: 28, Meridian: 32, Quantum: 35, Apex: 45, Stellar: 78 },
]

const lines = [
  { key: 'TechCorp', color: '#ef4444', label: 'TechCorp' },
  { key: 'Meridian', color: '#f59e0b', label: 'Meridian Health' },
  { key: 'Quantum', color: '#f97316', label: 'Quantum Dynamics' },
  { key: 'Apex', color: '#a855f7', label: 'Apex Logistics' },
  { key: 'Stellar', color: '#22c55e', label: 'Stellar Fintech' },
]

const signalData = [
  { name: 'Usage Drop', value: 82 },
  { name: 'Low NPS', value: 64 },
  { name: 'Support Tickets', value: 58 },
  { name: 'Login Freq', value: 52 },
  { name: 'No Response', value: 45 },
]

export function HealthChart() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#e8e8ef] bg-white shadow-sm p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Health Score Trend — Top 5 At-Risk Accounts</h3>
        <LineChartComponent data={healthData} lines={lines} xKey="month" height={220} />
      </div>
      <div className="rounded-xl border border-[#e8e8ef] bg-white shadow-sm p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Churn Signal Breakdown</h3>
        <BarChartComponent data={signalData} dataKey="value" xKey="name" height={160} color="#6366f1" formatY={(v) => `${v}%`} />
      </div>
    </div>
  )
}
