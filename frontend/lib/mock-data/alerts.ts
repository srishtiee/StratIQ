export interface Alert {
  id: string
  severity: 'high' | 'medium' | 'low'
  title: string
  description: string
  module: 'people' | 'retention' | 'kpi' | 'actions'
  href: string
  timestamp: string
  read: boolean
}

export const alerts: Alert[] = [
  {
    id: 'alert1',
    severity: 'high',
    title: 'Engineering Attrition Spike',
    description: '5 senior engineers flagged high risk — avg compa-ratio 0.85',
    module: 'people',
    href: '/people',
    timestamp: '2025-04-05T13:30:00Z',
    read: false,
  },
  {
    id: 'alert2',
    severity: 'high',
    title: 'TechCorp Inc. — High Churn Risk',
    description: '$180K ARR at risk. Usage down 42%, exec sponsor unresponsive',
    module: 'retention',
    href: '/retention',
    timestamp: '2025-04-05T11:15:00Z',
    read: false,
  },
  {
    id: 'alert3',
    severity: 'high',
    title: 'Meridian Health — Executive Sponsor Left',
    description: '$240K ARR renewal due May 15. New CTO not yet onboarded',
    module: 'retention',
    href: '/retention',
    timestamp: '2025-04-05T10:00:00Z',
    read: false,
  },
  {
    id: 'alert4',
    severity: 'medium',
    title: 'MRR Below Q2 Target',
    description: '$342K vs $364K target (-6%). Pipeline coverage at 3.1x',
    module: 'kpi',
    href: '/kpi',
    timestamp: '2025-04-04T17:45:00Z',
    read: false,
  },
  {
    id: 'alert5',
    severity: 'medium',
    title: 'NPS Declined to 34',
    description: 'Down from 48 in Q4. 5 new detractor responses this month',
    module: 'kpi',
    href: '/kpi',
    timestamp: '2025-04-04T09:20:00Z',
    read: true,
  },
  {
    id: 'alert6',
    severity: 'medium',
    title: 'Quantum Dynamics Budget Freeze',
    description: '$85K ARR account — usage down 28%, no CSM response in 5 days',
    module: 'retention',
    href: '/retention',
    timestamp: '2025-04-03T14:30:00Z',
    read: true,
  },
  {
    id: 'alert7',
    severity: 'low',
    title: '2 Actions Pending Approval',
    description: 'Compensation review task and TechCorp intervention email awaiting sign-off',
    module: 'actions',
    href: '/actions',
    timestamp: '2025-04-05T11:00:00Z',
    read: false,
  },
  {
    id: 'alert8',
    severity: 'low',
    title: 'CAC Increased to $12.5K',
    description: 'Up 25% from target. Sales headcount expansion and lower conversion rates',
    module: 'kpi',
    href: '/kpi',
    timestamp: '2025-04-02T16:00:00Z',
    read: true,
  },
]
