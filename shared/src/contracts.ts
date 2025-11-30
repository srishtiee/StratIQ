export type RiskLevel = "Low" | "Moderate" | "High" | "Critical";

export type WorkflowStatus = "ready" | "reviewing" | "approved";

export type ApprovalStatus = "Pending" | "Ready" | "Approved" | "Executed";

export interface EvidenceItem {
  id: string;
  title: string;
  source: string;
  snippet: string;
}

export interface AgentMessage {
  id: string;
  agent: string;
  tone: string;
  summary: string;
  recommendation: string;
  confidence: number;
  status: "complete" | "watch" | "needs-review";
  evidenceIds: string[];
}

export interface ApprovalRequest {
  id: string;
  customerId: string;
  customerName: string;
  action: string;
  owner: string;
  priority: "Normal" | "High" | "Urgent";
  status: ApprovalStatus;
  rationale: string;
  estimatedImpact: string;
  dueLabel: string;
}

export interface ActionResult {
  id: string;
  status: "queued" | "completed";
  summary: string;
  auditNote: string;
  executedAt?: string;
}

export interface WorkflowRequest {
  prompt: string;
  focusCustomerId?: string;
}

export interface WorkflowResponse {
  requestId: string;
  submittedAt: string;
  requestSummary: string;
  status: WorkflowStatus;
  evidence: EvidenceItem[];
  messages: AgentMessage[];
  approval: ApprovalRequest;
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
  ticketLoad: string;
  lastActivity: string;
  topDrivers: string[];
  recommendedAction: string;
  accountOwner: string;
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
