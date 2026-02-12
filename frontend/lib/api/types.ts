export interface ApiEmployee {
  id: string
  name: string
  email: string
  department: string
  role: string
  level: string
  location: string
  hire_date: string
  status: string
  latest_attrition_risk_score: number | null
  latest_engagement_score: number | null
  latest_performance_score: number | null
  scores_last_updated_at: string | null
  compensation: {
    salary: number
    market_benchmark: number | null
    compa_ratio: number | null
    last_review_date: string | null
  } | null
}

export interface ApiCustomer {
  id: string
  name: string
  segment: string
  tier: string
  arr: number
  renewal_date: string
  csm_id: string | null
  latest_churn_score: number | null
  latest_health_score: number | null
  latest_revenue_at_risk: number | null
  scores_last_updated_at: string | null
  user_profiles: { name: string } | null
}

export type ApiActionType = 'task' | 'email_send' | 'pdf_report' | 'meeting_ics'
export type ApiActionStatus = 'draft' | 'pending_approval' | 'approved' | 'executing' | 'completed' | 'rejected' | 'failed'
export type ApiApprovalTier = 'low' | 'mid' | 'high'

export interface ApiAction {
  id: string
  org_id: string
  user_id: string
  type: ApiActionType
  status: ApiActionStatus
  approval_tier: ApiApprovalTier
  title: string
  description: string | null
  source_module: 'people' | 'retention' | 'dashboard' | null
  source_entity_type: string | null
  source_entity_id: string | null
  created_at: string
  executed_at: string | null
  due_date: string | null
  payload: Record<string, unknown> | null
  result: Record<string, unknown> | null
  rejected_reason: string | null
  priority: 'high' | 'medium' | 'low' | null
}

export interface ApiKpi {
  id: string
  name: string
  category: string
  value: number
  target: number | null
  unit: string
  period: string
  trend: 'up' | 'down' | 'flat'
  recorded_at: string
}

export interface ApiKpiHistory {
  name: string
  value: number
  period: string
  recorded_at: string
}

export interface ApiNotification {
  id: string
  type: string | null
  message: string | null
  read: boolean
  created_at: string
}

export interface ApiUploadedFile {
  id: string
  original_filename: string
  file_type: string
  template_type: string
  status: 'pending' | 'validating' | 'processing' | 'complete' | 'error'
  row_count: number | null
  error_message: string | null
  created_at: string
  processed_at: string | null
}

export interface PeopleSummary {
  total_employees: number
  high_risk_count: number
  avg_engagement_score: number
}

export interface RetentionSummary {
  total_customers: number
  high_churn_count: number
  total_arr: number
  arr_at_risk: number
  avg_health_score: number
}
