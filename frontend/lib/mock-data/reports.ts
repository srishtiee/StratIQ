export interface ReportSection {
  id: string
  title: string
  module: string
  content: string
  chart_type?: string
}

export interface Report {
  id: string
  title: string
  status: 'draft' | 'published'
  created_at: string
  updated_at: string
  sections: ReportSection[]
  author: string
}

export const reports: Report[] = [
  {
    id: 'r1',
    title: 'Q2 Executive Board Briefing — April 2025',
    status: 'draft',
    created_at: '2025-04-04T10:00:00Z',
    updated_at: '2025-04-05T09:00:00Z',
    author: 'AI Assistant',
    sections: [
      { id: 's1', title: 'Executive Summary', module: 'Executive KPI', content: 'Q2 2025 is tracking mixed against targets. Revenue performance is showing headwinds with MRR 6% below target at $342K, while total ARR remains strong at $4.2M. The primary risk areas are Engineering attrition at 18% (vs 12% target) and 5 enterprise accounts representing $820K ARR showing high churn probability. Immediate action is recommended in both people retention and customer success.', chart_type: 'summary' },
      { id: 's2', title: 'People & Talent Risks', module: 'People Intelligence', content: 'Engineering attrition has reached 18% — the highest in company history — with 4 departures in Q2 alone. Key drivers include compensation gaps (avg compa-ratio 0.84 for IC4+), declining engagement scores (from 78 to 62 over 6 months), and lack of career advancement opportunities. Five high-performing employees have attrition risk scores above 70, representing a combined compensation replacement cost of ~$1.2M. Immediate compensation review is recommended for Marcus Chen, Priya Sharma, and Deon Washington.', chart_type: 'bar' },
      { id: 's3', title: 'Customer Health & Retention', module: 'Customer Retention', content: 'Five accounts representing $820K in ARR (19.5% of total) are classified as high churn risk. TechCorp Inc. ($180K ARR) shows 42% usage decline and unresolved support tickets. Meridian Health ($240K ARR) lost their primary executive sponsor. Both require immediate escalated outreach at the VP level. The overall NPS has declined from 48 to 34 over the past 6 months, indicating broader satisfaction concerns that may affect the wider customer base.', chart_type: 'line' },
    ]
  },
  {
    id: 'r2',
    title: 'Q1 2025 Business Performance Review',
    status: 'published',
    created_at: '2025-03-28T08:00:00Z',
    updated_at: '2025-03-28T10:00:00Z',
    author: 'AI Assistant',
    sections: [
      { id: 's4', title: 'Q1 Financial Performance', module: 'Executive KPI', content: 'Q1 2025 closed with total ARR of $3.95M, representing 8% growth QoQ. MRR peaked at $352K in February before declining to $342K in March. Gross margin held steady at 68%. CAC increased 15% to $11,200, primarily driven by SDR team expansion. LTV:CAC remains above 3x but declining trajectory is a concern heading into Q2.', chart_type: 'area' },
      { id: 's5', title: 'Workforce Summary', module: 'People Intelligence', content: 'Q1 headcount ended at 87, below the plan of 95. Two senior engineers and one Product Manager departed in Q1. Hiring velocity improved in February with 6 new hires, but onboarding quality scores dipped. Average time-to-hire for engineering roles is 62 days vs target of 45 days. Compensation benchmarking reveals 8 employees are below market by more than 12%.', chart_type: 'bar' },
      { id: 's6', title: 'Customer Portfolio Update', module: 'Customer Retention', content: 'Q1 net revenue retention was 112%, above the 108% achieved in Q4 2024. Four new enterprise logos added. TechCorp and Quantum Dynamics are flagged as early churn risks based on usage decline signals. The introduction of the health score monitoring system has enabled proactive outreach, preventing 2 estimated churns. CSM capacity is at its limit with current team of 4.', chart_type: 'donut' },
    ]
  },
  {
    id: 'r3',
    title: 'Engineering Attrition Deep Dive — March 2025',
    status: 'published',
    created_at: '2025-03-20T14:00:00Z',
    updated_at: '2025-03-22T11:00:00Z',
    author: 'Aisha Thompson',
    sections: [
      { id: 's7', title: 'Attrition Root Cause Analysis', module: 'People Intelligence', content: 'Exit interview analysis from 6 Engineering departures in the past 6 months reveals three primary themes: compensation below market (cited by 83% of departures), limited career growth beyond IC4 (67%), and declining team morale/culture (50%). Two of the departed employees accepted offers paying 25-30% more at competing scale-ups. The remaining attrition risk pool of 5 engineers shares similar profiles: high performance, senior tenure, and below-market compensation.', chart_type: 'bar' },
      { id: 's8', title: 'Compensation Gap Analysis', module: 'People Intelligence', content: 'Current Engineering compensation is on average 13% below the 50th percentile market benchmark. IC4 engineers are the most underpaid at 14.8% below market on average. The total cost of bringing all engineers to market rate is estimated at $640K annually. In contrast, the cost to replace each engineer (recruiting, onboarding, productivity loss) averages $280K. Compensation adjustment is clearly the higher ROI intervention.', chart_type: 'bar' },
      { id: 's9', title: 'Retention Recommendations', module: 'People Intelligence', content: 'Three immediate actions are recommended: (1) Off-cycle salary adjustments for IC4/IC5 engineers averaging 12% increase — estimated cost $420K. (2) Engineer career ladder refresh with clear IC5 → Staff promotion criteria and timeline. (3) 30-day engagement survey and 1:1 manager check-ins for all engineers with risk scores above 60. Expected impact: reduce Engineering attrition from 18% to below 12% within two quarters.', chart_type: 'summary' },
    ]
  }
]
