export interface ChurnSignal {
  customer_id: string
  signal_type: 'usage_drop' | 'low_nps' | 'support_tickets' | 'login_inactivity' | 'executive_departure' | 'competitor_evaluation'
  value: number
  timestamp: string
  severity: 'high' | 'medium' | 'low'
}

export const churnSignals: ChurnSignal[] = [
  // TechCorp Inc. (c1) - High risk account
  {
    customer_id: 'c1',
    signal_type: 'usage_drop',
    value: 42,
    timestamp: '2025-04-01T00:00:00Z',
    severity: 'high',
  },
  {
    customer_id: 'c1',
    signal_type: 'support_tickets',
    value: 3,
    timestamp: '2025-03-15T00:00:00Z',
    severity: 'high',
  },
  {
    customer_id: 'c1',
    signal_type: 'low_nps',
    value: 15,
    timestamp: '2025-03-20T00:00:00Z',
    severity: 'high',
  },

  // Meridian Health (c2) - High risk account
  {
    customer_id: 'c2',
    signal_type: 'executive_departure',
    value: 1,
    timestamp: '2025-03-01T00:00:00Z',
    severity: 'high',
  },
  {
    customer_id: 'c2',
    signal_type: 'login_inactivity',
    value: 35,
    timestamp: '2025-04-02T00:00:00Z',
    severity: 'high',
  },
  {
    customer_id: 'c2',
    signal_type: 'usage_drop',
    value: 22,
    timestamp: '2025-03-25T00:00:00Z',
    severity: 'medium',
  },

  // Quantum Dynamics (c3) - High risk account
  {
    customer_id: 'c3',
    signal_type: 'usage_drop',
    value: 28,
    timestamp: '2025-04-01T00:00:00Z',
    severity: 'high',
  },
  {
    customer_id: 'c3',
    signal_type: 'login_inactivity',
    value: 18,
    timestamp: '2025-03-28T00:00:00Z',
    severity: 'medium',
  },

  // NovaBridge Capital (c4) - High risk account
  {
    customer_id: 'c4',
    signal_type: 'competitor_evaluation',
    value: 1,
    timestamp: '2025-03-20T00:00:00Z',
    severity: 'high',
  },
  {
    customer_id: 'c4',
    signal_type: 'login_inactivity',
    value: 25,
    timestamp: '2025-04-01T00:00:00Z',
    severity: 'medium',
  },
  {
    customer_id: 'c4',
    signal_type: 'support_tickets',
    value: 1,
    timestamp: '2025-03-15T00:00:00Z',
    severity: 'low',
  },

  // Apex Logistics (c5) - High risk account
  {
    customer_id: 'c5',
    signal_type: 'executive_departure',
    value: 1,
    timestamp: '2025-02-28T00:00:00Z',
    severity: 'high',
  },
  {
    customer_id: 'c5',
    signal_type: 'support_tickets',
    value: 6,
    timestamp: '2025-03-25T00:00:00Z',
    severity: 'high',
  },
  {
    customer_id: 'c5',
    signal_type: 'login_inactivity',
    value: 15,
    timestamp: '2025-03-30T00:00:00Z',
    severity: 'medium',
  },

  // Stellar Fintech (c6) - Healthy account
  {
    customer_id: 'c6',
    signal_type: 'usage_drop',
    value: -5,
    timestamp: '2025-03-25T00:00:00Z',
    severity: 'low',
  },

  // GreenPath Energy (c7) - Healthy account
  {
    customer_id: 'c7',
    signal_type: 'usage_drop',
    value: -8,
    timestamp: '2025-03-20T00:00:00Z',
    severity: 'low',
  },

  // Cascade Networks (c8) - Neutral account
  {
    customer_id: 'c8',
    signal_type: 'usage_drop',
    value: 5,
    timestamp: '2025-03-15T00:00:00Z',
    severity: 'low',
  },

  // Horizon Medical (c9) - Healthy account
  {
    customer_id: 'c9',
    signal_type: 'usage_drop',
    value: -12,
    timestamp: '2025-03-20T00:00:00Z',
    severity: 'low',
  },

  // BlueSky Ventures (c10) - Neutral account
  {
    customer_id: 'c10',
    signal_type: 'login_inactivity',
    value: 12,
    timestamp: '2025-03-18T00:00:00Z',
    severity: 'medium',
  },

  // Prism Analytics (c11) - Healthy account
  {
    customer_id: 'c11',
    signal_type: 'usage_drop',
    value: -6,
    timestamp: '2025-03-20T00:00:00Z',
    severity: 'low',
  },

  // OmniRetail Group (c12) - Healthy account
  {
    customer_id: 'c12',
    signal_type: 'usage_drop',
    value: -15,
    timestamp: '2025-03-20T00:00:00Z',
    severity: 'low',
  },

  // ClearPath Insurance (c13) - Neutral account
  {
    customer_id: 'c13',
    signal_type: 'login_inactivity',
    value: 8,
    timestamp: '2025-03-17T00:00:00Z',
    severity: 'low',
  },
]
