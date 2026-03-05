'use client'

import { LineChartComponent } from '@/components/charts/line-chart'

const attritionData = [
  { month: 'May', Engineering: 10, Sales: 8, Marketing: 6, Product: 5, CS: 4 },
  { month: 'Jun', Engineering: 11, Sales: 7, Marketing: 6, Product: 5, CS: 4 },
  { month: 'Jul', Engineering: 12, Sales: 8, Marketing: 7, Product: 6, CS: 3 },
  { month: 'Aug', Engineering: 13, Sales: 9, Marketing: 7, Product: 5, CS: 4 },
  { month: 'Sep', Engineering: 14, Sales: 8, Marketing: 6, Product: 6, CS: 4 },
  { month: 'Oct', Engineering: 15, Sales: 9, Marketing: 7, Product: 7, CS: 3 },
  { month: 'Nov', Engineering: 15, Sales: 10, Marketing: 6, Product: 6, CS: 4 },
  { month: 'Dec', Engineering: 16, Sales: 9, Marketing: 6, Product: 7, CS: 3 },
  { month: 'Jan', Engineering: 16, Sales: 10, Marketing: 7, Product: 8, CS: 4 },
  { month: 'Feb', Engineering: 17, Sales: 9, Marketing: 7, Product: 8, CS: 4 },
  { month: 'Mar', Engineering: 17, Sales: 10, Marketing: 8, Product: 8, CS: 4 },
  { month: 'Apr', Engineering: 18, Sales: 10, Marketing: 8, Product: 8, CS: 5 },
]

const lines = [
  { key: 'Engineering', color: '#ef4444', label: 'Engineering' },
  { key: 'Sales', color: '#f59e0b', label: 'Sales' },
  { key: 'Marketing', color: '#6366f1', label: 'Marketing' },
  { key: 'Product', color: '#818cf8', label: 'Product' },
  { key: 'CS', color: '#22c55e', label: 'CS' },
]

export function AttritionChart() {
  return (
    <div className="rounded-xl border border-[#e8e8ef] bg-white shadow-sm p-4">
      <h3 className="text-sm font-medium text-gray-900 mb-3">Attrition Trend (12 months)</h3>
      <LineChartComponent data={attritionData} lines={lines} xKey="month" height={200} formatY={(v) => `${v}%`} />
    </div>
  )
}
