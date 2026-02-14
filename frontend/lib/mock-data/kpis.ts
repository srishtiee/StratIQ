export interface KPI {
  id: string
  name: string
  category: 'hr' | 'customer' | 'finance' | 'ops'
  value: number
  target: number
  unit: string
  trend: 'up' | 'down' | 'flat'
  variance_pct: number
  period: string
  sparkline_data: number[]
  status: 'good' | 'warning' | 'danger'
  description: string
}

export const kpis: KPI[] = [
  { id: 'k1', name: 'Monthly Recurring Revenue', category: 'finance', value: 342000, target: 364000, unit: '$', trend: 'down', variance_pct: -6.0, period: 'Q2 2025', sparkline_data: [310, 325, 340, 350, 365, 358, 348, 342], status: 'warning', description: 'MRR tracking 6% below Q2 target due to slower new business' },
  { id: 'k2', name: 'Annual Recurring Revenue', category: 'finance', value: 4200000, target: 4100000, unit: '$', trend: 'up', variance_pct: 2.4, period: 'Q2 2025', sparkline_data: [3800, 3900, 4000, 4050, 4100, 4150, 4180, 4200], status: 'good', description: 'Total ARR ahead of plan, driven by strong enterprise expansion' },
  { id: 'k3', name: 'Customer Churn Rate', category: 'customer', value: 2.8, target: 2.0, unit: '%', trend: 'up', variance_pct: 40.0, period: 'Q2 2025', sparkline_data: [1.5, 1.8, 2.0, 2.1, 2.3, 2.5, 2.7, 2.8], status: 'danger', description: 'Churn rate elevated, driven by 3 mid-market accounts' },
  { id: 'k4', name: 'Net Revenue Retention', category: 'customer', value: 108, target: 115, unit: '%', trend: 'down', variance_pct: -6.1, period: 'Q2 2025', sparkline_data: [118, 116, 115, 113, 112, 110, 109, 108], status: 'warning', description: 'NRR declining due to churn headwinds outpacing expansion' },
  { id: 'k5', name: 'Employee Attrition Rate', category: 'hr', value: 18, target: 12, unit: '%', trend: 'up', variance_pct: 50.0, period: 'Q2 2025', sparkline_data: [9, 10, 11, 12, 14, 15, 17, 18], status: 'danger', description: 'Engineering attrition spiking, 4 departures in Q2 alone' },
  { id: 'k6', name: 'Employee Engagement Score', category: 'hr', value: 62, target: 75, unit: '', trend: 'down', variance_pct: -17.3, period: 'Q2 2025', sparkline_data: [78, 76, 74, 72, 70, 67, 64, 62], status: 'danger', description: 'Engagement declining across Engineering and Product teams' },
  { id: 'k7', name: 'Average Compa Ratio', category: 'hr', value: 0.91, target: 0.95, unit: '', trend: 'down', variance_pct: -4.2, period: 'Q2 2025', sparkline_data: [0.97, 0.96, 0.95, 0.94, 0.93, 0.92, 0.91, 0.91], status: 'warning', description: 'Compensation below market benchmark, especially for IC4+ roles' },
  { id: 'k8', name: 'NPS Score', category: 'customer', value: 34, target: 45, unit: '', trend: 'down', variance_pct: -24.4, period: 'Q2 2025', sparkline_data: [48, 46, 44, 42, 40, 38, 36, 34], status: 'danger', description: 'NPS declining, 5 detractor responses in last 30 days' },
  { id: 'k9', name: 'Customer Health Score (Avg)', category: 'customer', value: 64, target: 70, unit: '', trend: 'down', variance_pct: -8.6, period: 'Q2 2025', sparkline_data: [72, 71, 70, 69, 68, 66, 65, 64], status: 'warning', description: 'Average health trending down across Mid-Market segment' },
  { id: 'k10', name: 'Gross Margin', category: 'finance', value: 68, target: 70, unit: '%', trend: 'flat', variance_pct: -2.9, period: 'Q2 2025', sparkline_data: [71, 70, 70, 69, 69, 68, 68, 68], status: 'warning', description: 'Gross margin slightly below target due to infrastructure cost increases' },
  { id: 'k11', name: 'CAC (Customer Acquisition Cost)', category: 'finance', value: 12500, target: 10000, unit: '$', trend: 'up', variance_pct: 25.0, period: 'Q2 2025', sparkline_data: [9200, 9500, 9800, 10200, 10800, 11500, 12000, 12500], status: 'danger', description: 'CAC rising due to increased sales headcount and lower conversion' },
  { id: 'k12', name: 'LTV:CAC Ratio', category: 'finance', value: 3.2, target: 4.0, unit: 'x', trend: 'down', variance_pct: -20.0, period: 'Q2 2025', sparkline_data: [4.5, 4.3, 4.1, 4.0, 3.8, 3.6, 3.4, 3.2], status: 'danger', description: 'LTV:CAC below healthy threshold, driven by rising CAC and shorter retention' },
  { id: 'k13', name: 'Sales Cycle Length', category: 'ops', value: 47, target: 38, unit: 'days', trend: 'up', variance_pct: 23.7, period: 'Q2 2025', sparkline_data: [35, 36, 37, 38, 40, 42, 45, 47], status: 'warning', description: 'Enterprise deals taking longer to close, more stakeholders involved' },
  { id: 'k14', name: 'Pipeline Coverage', category: 'ops', value: 3.1, target: 3.5, unit: 'x', trend: 'down', variance_pct: -11.4, period: 'Q2 2025', sparkline_data: [4.0, 3.8, 3.7, 3.6, 3.5, 3.4, 3.2, 3.1], status: 'warning', description: 'Pipeline coverage below 3.5x target, Q3 at risk if not rebuilt' },
  { id: 'k15', name: 'Win Rate', category: 'ops', value: 22, target: 25, unit: '%', trend: 'down', variance_pct: -12.0, period: 'Q2 2025', sparkline_data: [28, 27, 26, 25, 24, 23, 22, 22], status: 'warning', description: 'Win rate declining vs target, competitive losses to new entrants' },
  { id: 'k16', name: 'New Customers (Q2)', category: 'ops', value: 18, target: 22, unit: '', trend: 'flat', variance_pct: -18.2, period: 'Q2 2025', sparkline_data: [20, 19, 22, 18, 21, 20, 19, 18], status: 'warning', description: 'New logo acquisition below plan, need to accelerate pipeline conversion' },
  { id: 'k17', name: 'Support Ticket Resolution (Avg)', category: 'ops', value: 8.2, target: 6.0, unit: 'hrs', trend: 'up', variance_pct: 36.7, period: 'Q2 2025', sparkline_data: [5.5, 5.8, 6.0, 6.2, 6.8, 7.2, 7.8, 8.2], status: 'danger', description: 'Resolution time spiking due to team capacity constraints' },
  { id: 'k18', name: 'Headcount', category: 'hr', value: 87, target: 95, unit: '', trend: 'flat', variance_pct: -8.4, period: 'Q2 2025', sparkline_data: [91, 92, 93, 91, 90, 89, 88, 87], status: 'warning', description: 'Below hiring plan, 8 open requisitions unfilled for 60+ days' },
]
