export interface Customer {
  id: string
  name: string
  segment: 'Enterprise' | 'Mid-Market' | 'SMB'
  arr: number
  health_score: number
  churn_score: number
  renewal_date: string
  csm: string
  last_activity: string
  status: string
  signal_summary: string
}

export const customers: Customer[] = [
  { id: 'c1', name: 'TechCorp Inc.', segment: 'Enterprise', arr: 180000, health_score: 28, churn_score: 82, renewal_date: '2025-06-30', csm: 'Fatima Hassan', last_activity: '2025-03-10', status: 'At Risk', signal_summary: 'Usage dropped 42% MoM, 3 open support tickets, NPS detractor score' },
  { id: 'c2', name: 'Meridian Health', segment: 'Enterprise', arr: 240000, health_score: 32, churn_score: 76, renewal_date: '2025-05-15', csm: 'Nina Kowalski', last_activity: '2025-03-08', status: 'At Risk', signal_summary: 'Executive sponsor left, low adoption in new team, missed QBR' },
  { id: 'c3', name: 'Quantum Dynamics', segment: 'Mid-Market', arr: 85000, health_score: 35, churn_score: 71, renewal_date: '2025-07-31', csm: 'Carlos Mendez', last_activity: '2025-03-05', status: 'At Risk', signal_summary: 'Budget freeze announced, usage down 28%, no response to CSM outreach' },
  { id: 'c4', name: 'NovaBridge Capital', segment: 'Mid-Market', arr: 72000, health_score: 38, churn_score: 74, renewal_date: '2025-04-30', csm: 'Liam Chen', last_activity: '2025-03-12', status: 'At Risk', signal_summary: 'Competitor evaluation in progress, asked for data export, low login frequency' },
  { id: 'c5', name: 'Apex Logistics', segment: 'Enterprise', arr: 155000, health_score: 45, churn_score: 68, renewal_date: '2025-08-15', csm: 'Fatima Hassan', last_activity: '2025-03-14', status: 'At Risk', signal_summary: 'Key user churned, ticket volume up 60%, executive engagement dropped' },
  { id: 'c6', name: 'Stellar Fintech', segment: 'Enterprise', arr: 320000, health_score: 78, churn_score: 22, renewal_date: '2025-12-31', csm: 'Nina Kowalski', last_activity: '2025-03-20', status: 'Healthy', signal_summary: 'Usage at all-time high, expanded to 3 new teams, strong NPS promoter' },
  { id: 'c7', name: 'GreenPath Energy', segment: 'Mid-Market', arr: 65000, health_score: 72, churn_score: 28, renewal_date: '2025-11-30', csm: 'Carlos Mendez', last_activity: '2025-03-18', status: 'Healthy', signal_summary: 'Consistent usage growth, positive QBR feedback, potential upsell opportunity' },
  { id: 'c8', name: 'Cascade Networks', segment: 'SMB', arr: 28000, health_score: 65, churn_score: 35, renewal_date: '2025-09-30', csm: 'Liam Chen', last_activity: '2025-03-15', status: 'Neutral', signal_summary: 'Stable usage, some adoption gaps in advanced features, good responsiveness' },
  { id: 'c9', name: 'Horizon Medical', segment: 'Enterprise', arr: 275000, health_score: 82, churn_score: 18, renewal_date: '2026-01-31', csm: 'Fatima Hassan', last_activity: '2025-03-21', status: 'Healthy', signal_summary: 'Power user, expanding to 2 more business units, excellent NPS scores' },
  { id: 'c10', name: 'BlueSky Ventures', segment: 'SMB', arr: 22000, health_score: 58, churn_score: 42, renewal_date: '2025-08-31', csm: 'Carlos Mendez', last_activity: '2025-03-10', status: 'Neutral', signal_summary: 'Usage inconsistent, team turnover impacting adoption, responsive to outreach' },
  { id: 'c11', name: 'Prism Analytics', segment: 'Mid-Market', arr: 90000, health_score: 74, churn_score: 26, renewal_date: '2025-10-31', csm: 'Nina Kowalski', last_activity: '2025-03-19', status: 'Healthy', signal_summary: 'Strong adoption, integrations enabled, interested in API expansion' },
  { id: 'c12', name: 'OmniRetail Group', segment: 'Enterprise', arr: 380000, health_score: 88, churn_score: 12, renewal_date: '2026-03-31', csm: 'Fatima Hassan', last_activity: '2025-03-22', status: 'Healthy', signal_summary: 'Top account, executive champion, 40% YoY expansion, potential upsell' },
  { id: 'c13', name: 'ClearPath Insurance', segment: 'Mid-Market', arr: 68000, health_score: 60, churn_score: 40, renewal_date: '2025-09-15', csm: 'Liam Chen', last_activity: '2025-03-11', status: 'Neutral', signal_summary: 'Some feature gaps raised, evaluating ROI, scheduled success review' },
  { id: 'c14', name: 'TechStart Labs', segment: 'SMB', arr: 18000, health_score: 70, churn_score: 30, renewal_date: '2025-11-01', csm: 'Carlos Mendez', last_activity: '2025-03-16', status: 'Healthy', signal_summary: 'Growing team, increased feature usage, good feedback on product updates' },
  { id: 'c15', name: 'Vanguard Manufacturing', segment: 'Enterprise', arr: 195000, health_score: 76, churn_score: 24, renewal_date: '2025-12-15', csm: 'Nina Kowalski', last_activity: '2025-03-20', status: 'Healthy', signal_summary: 'Consistent usage, great adoption, expansion conversation underway' },
  { id: 'c16', name: 'AquaMed Systems', segment: 'Mid-Market', arr: 55000, health_score: 52, churn_score: 48, renewal_date: '2025-06-15', csm: 'Liam Chen', last_activity: '2025-03-09', status: 'Neutral', signal_summary: 'Renewal in 90 days, some adoption concerns, CSM engagement needed' },
  { id: 'c17', name: 'InnovateTech', segment: 'SMB', arr: 24000, health_score: 80, churn_score: 20, renewal_date: '2025-10-01', csm: 'Carlos Mendez', last_activity: '2025-03-21', status: 'Healthy', signal_summary: 'High engagement, feature requests submitted, likely to renew and expand' },
  { id: 'c18', name: 'Summit Partners', segment: 'Mid-Market', arr: 78000, health_score: 68, churn_score: 32, renewal_date: '2025-11-15', csm: 'Fatima Hassan', last_activity: '2025-03-17', status: 'Healthy', signal_summary: 'Good adoption, new use case discovered, upsell potential identified' },
  { id: 'c19', name: 'DataPlex Corp', segment: 'Enterprise', arr: 210000, health_score: 55, churn_score: 45, renewal_date: '2025-07-15', csm: 'Nina Kowalski', last_activity: '2025-03-13', status: 'Neutral', signal_summary: 'Usage plateaued, competitive pressure from new entrant, needs exec engagement' },
  { id: 'c20', name: 'FlowState Media', segment: 'SMB', arr: 32000, health_score: 64, churn_score: 36, renewal_date: '2025-08-01', csm: 'Liam Chen', last_activity: '2025-03-15', status: 'Neutral', signal_summary: 'Moderate usage, some support tickets, team expansion could increase value' },
]

export const totalARR = customers.reduce((sum, c) => sum + c.arr, 0)
export const atRiskARR = customers.filter(c => c.churn_score >= 70).reduce((sum, c) => sum + c.arr, 0)
