export type ActionStatus = 'draft' | 'pending_approval' | 'approved' | 'executing' | 'completed' | 'failed' | 'rejected'
export type ActionType = 'pdf_report' | 'email_send' | 'meeting_ics' | 'task' | 'csv_export' | 'report_section'

export interface Action {
  id: string
  type: ActionType
  title: string
  description: string
  status: ActionStatus
  module: string
  requested_by: string
  created_at: string
  updated_at: string
  output_url?: string
  error_message?: string
  metadata?: Record<string, unknown>
}

export const actions: Action[] = [
  { id: 'a1', type: 'pdf_report', title: 'Q2 Attrition Review — Engineering & Product', description: 'Generate a comprehensive PDF report analyzing attrition trends in Engineering and Product departments with risk analysis and recommendations.', status: 'pending_approval', module: 'People Intelligence', requested_by: 'AI Assistant', created_at: '2025-04-05T09:15:00Z', updated_at: '2025-04-05T09:15:00Z' },
  { id: 'a2', type: 'email_send', title: 'Intervention Email — TechCorp Inc. at Risk', description: 'Send a personalized intervention email to TechCorp executive team from Fatima Hassan addressing usage decline and offering executive business review.', status: 'pending_approval', module: 'Customer Retention', requested_by: 'AI Assistant', created_at: '2025-04-05T08:45:00Z', updated_at: '2025-04-05T08:45:00Z', metadata: { to: ['cto@techcorp.com', 'success@techcorp.com'], subject: 'Your Partnership with Acme — Let\'s Connect' } },
  { id: 'a3', type: 'task', title: 'Compensation Review: 5 Underpaid High Performers', description: 'Create a task for HR to review compensation adjustments for 5 employees with compa-ratio below 0.87 and performance scores above 85.', status: 'pending_approval', module: 'People Intelligence', requested_by: 'Marcus Chen', created_at: '2025-04-04T16:30:00Z', updated_at: '2025-04-04T16:30:00Z', metadata: { assignee: 'Nina Kowalski', due_date: '2025-04-15', priority: 'high' } },
  { id: 'a4', type: 'csv_export', title: 'At-Risk Customer Export — Q2 2025', description: 'Export CSV of all customers with churn score > 60 including ARR, renewal dates, health signals and CSM assignments.', status: 'completed', module: 'Customer Retention', requested_by: 'Nina Kowalski', created_at: '2025-04-04T14:20:00Z', updated_at: '2025-04-04T14:22:00Z', output_url: '/exports/at-risk-customers-q2-2025.csv' },
  { id: 'a5', type: 'pdf_report', title: 'Executive KPI Briefing — April 2025', description: 'Monthly executive briefing PDF with all KPI variances, risk register highlights, and recommended focus areas for leadership meeting.', status: 'completed', module: 'Executive KPI', requested_by: 'AI Assistant', created_at: '2025-04-04T11:00:00Z', updated_at: '2025-04-04T11:03:00Z', output_url: '/reports/executive-kpi-april-2025.pdf' },
  { id: 'a6', type: 'meeting_ics', title: 'Emergency Retention Review — TechCorp & Meridian', description: 'Schedule 60-minute emergency retention review with CSM team for TechCorp and Meridian Health accounts.', status: 'completed', module: 'Customer Retention', requested_by: 'Nina Kowalski', created_at: '2025-04-03T15:00:00Z', updated_at: '2025-04-03T15:01:00Z', output_url: '/calendar/retention-review-apr7.ics' },
  { id: 'a7', type: 'email_send', title: 'Q2 Leadership Digest — All Hands Preview', description: 'Weekly leadership digest email to all VPs summarizing KPI status, people risks, and customer health.', status: 'completed', module: 'Executive KPI', requested_by: 'AI Assistant', created_at: '2025-04-03T09:00:00Z', updated_at: '2025-04-03T09:02:00Z' },
  { id: 'a8', type: 'task', title: 'Outreach to Meridian Health Executive Sponsor', description: 'Task for Nina Kowalski to personally reach out to new Meridian Health CTO and offer onboarding support.', status: 'completed', module: 'Customer Retention', requested_by: 'AI Assistant', created_at: '2025-04-02T13:45:00Z', updated_at: '2025-04-02T16:30:00Z' },
  { id: 'a9', type: 'pdf_report', title: 'Compensation Benchmarking Analysis — IC4 & IC5', description: 'PDF analysis comparing current IC4/IC5 salaries to market benchmarks with pay equity summary and recommended adjustments.', status: 'failed', module: 'People Intelligence', requested_by: 'AI Assistant', created_at: '2025-04-02T10:15:00Z', updated_at: '2025-04-02T10:18:00Z', error_message: 'Compensation data source unavailable. Benchmarking service returned error 503.' },
  { id: 'a10', type: 'report_section', title: 'Attrition Risk Summary — Board Report Section', description: 'Generate the People & Culture section for the quarterly board report including attrition metrics and retention strategy.', status: 'draft', module: 'People Intelligence', requested_by: 'Marcus Chen', created_at: '2025-04-01T14:00:00Z', updated_at: '2025-04-01T14:00:00Z' },
  { id: 'a11', type: 'csv_export', title: 'Full KPI Dataset Export — Q1 2025', description: 'Export all 18 KPI metrics with actuals, targets, variance and trend data for Q1 2025 in CSV format.', status: 'completed', module: 'Executive KPI', requested_by: 'Sarah Mitchell', created_at: '2025-04-01T11:30:00Z', updated_at: '2025-04-01T11:31:00Z', output_url: '/exports/kpi-q1-2025.csv' },
  { id: 'a12', type: 'email_send', title: 'Churn Risk Alert — Quantum Dynamics', description: 'Automated alert email to CSM Carlos Mendez and VP Nina Kowalski about Quantum Dynamics churn risk escalation.', status: 'completed', module: 'Customer Retention', requested_by: 'AI Assistant', created_at: '2025-03-31T16:00:00Z', updated_at: '2025-03-31T16:01:00Z' },
  { id: 'a13', type: 'meeting_ics', title: 'Compensation Review Committee — Bi-Weekly', description: 'Recurring calendar invite for compensation review committee to assess flagged employees.', status: 'approved', module: 'People Intelligence', requested_by: 'HR Team', created_at: '2025-03-30T09:00:00Z', updated_at: '2025-04-04T10:00:00Z' },
  { id: 'a14', type: 'pdf_report', title: 'Q1 Business Performance Review', description: 'Comprehensive Q1 business performance report covering all departments, KPIs, and strategic recommendations.', status: 'completed', module: 'Executive KPI', requested_by: 'AI Assistant', created_at: '2025-03-28T08:00:00Z', updated_at: '2025-03-28T08:05:00Z', output_url: '/reports/q1-business-review.pdf' },
  { id: 'a15', type: 'task', title: 'Engagement Survey — Engineering Team', description: 'Deploy pulse survey to Engineering team to identify top attrition drivers and engagement issues.', status: 'rejected', module: 'People Intelligence', requested_by: 'AI Assistant', created_at: '2025-03-27T14:00:00Z', updated_at: '2025-03-28T09:00:00Z', metadata: { rejection_reason: 'Too soon after last survey, reschedule for Q3' } },
]
