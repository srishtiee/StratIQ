export type RiskLevel = "Low" | "Moderate" | "High" | "Critical";

export type WorkflowType = "customer_churn" | "employee_attrition";

export type WorkflowStatus = "pending" | "completed" | "needs_review" | "approved";

export type ApprovalStatus =
  | "Pending"
  | "Ready"
  | "Approved"
  | "Rejected"
  | "Executed";

export type ActionStatus = "queued" | "approved" | "rejected" | "executed";

export interface TargetEntity {
  id: string;
  name: string;
  segment: string;
}

export interface EvidenceItem {
  id: string;
  sourceType: "usage_metric" | "support_ticket" | "renewal_signal" | "account_note";
  sourceId: string;
  title: string;
  snippet: string;
  relevance: string;
}

export interface StrategyOption {
  id: string;
  title: string;
  description: string;
  owner: string;
  expectedImpact: string;
  deliveryWindow: string;
}

export interface PlannerOutput {
  agent: "Planner Agent";
  summary: string;
  strategies: StrategyOption[];
}

export interface RiskReview {
  agent: "Risk/Compliance Agent";
  verdict: "pass" | "caution" | "block";
  critique: string;
  concerns: string[];
  requiredChecks: string[];
  quantitative_score: number;
  qualitative_score: number;
}

export interface ArbiterDecision {
  agent: "Arbiter Agent";
  selectedStrategyId: string;
  finalRecommendation: string;
  rationale: string;
  confidenceLabel: string;
}

export interface ApprovalRequest {
  id: string;
  runId: string;
  customerId: string;
  customerName: string;
  actionTitle: string;
  owner: string;
  priority: "Normal" | "High" | "Urgent";
  status: ApprovalStatus;
  rationale: string;
  estimatedImpact: string;
  dueLabel: string;
  createdAt: string;
}

export interface ActionResult {
  id: string;
  approvalId: string;
  status: ActionStatus;
  summary: string;
  auditNote: string;
  executedAt?: string;
}

export interface WorkflowRunSummary {
  id: string;
  workflowType: WorkflowType;
  submittedAt: string;
  status: WorkflowStatus;
  summary: string;
  finalRecommendation: string;
}

export interface AuditRecord {
  id: string;
  runId?: string;
  approvalId?: string;
  eventType: "workflow_run" | "feedback" | "approval" | "action";
  actor: string;
  message: string;
  createdAt: string;
}

export interface WorkflowRequest {
  prompt: string;
  focusCustomerId?: string;
  workflowType?: WorkflowType;
}

export interface WorkflowResponse {
  requestId: string;
  submittedAt: string;
  workflowType: WorkflowType;
  requestSummary: string;
  status: WorkflowStatus;
  targetEntity: TargetEntity;
  summary: string;
  evidence: EvidenceItem[];
  plannerOutput: PlannerOutput;
  riskReview: RiskReview;
  arbiterDecision: ArbiterDecision;
  approval: ApprovalRequest;
  actionHistory: ActionResult[];
  auditRecords: AuditRecord[];
}

export interface CustomerRiskSummary {
  id: string;
  name: string;
  segment: string;
  plan: string;
  monthlyRevenue: number;
  riskLevel: RiskLevel;
  churnProbability: number;
  healthScore: number;
  renewalDate: string;
  accountOwner: string;
  ticketLoad: string;
  lastActivity: string;
  topDrivers: string[];
  recommendedAction: string;
}

export interface CustomerDetail extends CustomerRiskSummary {
  evidence: EvidenceItem[];
  recentRuns: WorkflowRunSummary[];
  latestApproval?: ApprovalRequest | null;
}

export interface DashboardInsights {
  portfolioAtRisk: number;
  renewalWindow: number;
  executiveConfidence: string;
  actionQueue: number;
  riskMix: Array<{
    label: RiskLevel;
    count: number;
    accent: string;
  }>;
  highlights: string[];
}

export interface FeedbackPayload {
  requestId: string;
  verdict: "approve" | "revise";
  note: string;
}

export interface ApprovalActionPayload {
  approvalId: string;
  decision?: "approve" | "mark_ready" | "reject" | "execute";
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
