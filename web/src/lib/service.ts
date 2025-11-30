import type {
  ActionResult,
  ApprovalRequest,
  CustomerRiskSummary,
  DashboardInsights,
  FeedbackPayload,
  WorkflowRequest,
  WorkflowResponse,
} from "@shared/contracts";
import { approvals, customers, dashboardInsights, workflowTemplate } from "@/data/mock-data";

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_STRATIQ_API_URL ?? "http://localhost:8000";
}

export async function getDashboardInsights(): Promise<DashboardInsights> {
  await pause(120);
  return dashboardInsights;
}

export async function listCustomers(): Promise<CustomerRiskSummary[]> {
  await pause(120);
  return customers;
}

export async function getCustomerById(id: string): Promise<CustomerRiskSummary | undefined> {
  await pause(120);
  return customers.find((customer) => customer.id === id);
}

export async function listApprovals(): Promise<ApprovalRequest[]> {
  await pause(100);
  return approvals;
}

export async function submitAsk(payload: WorkflowRequest): Promise<WorkflowResponse> {
  await pause(180);

  const targetCustomer =
    customers.find((customer) => customer.id === payload.focusCustomerId) ?? customers[0];

  return {
    ...workflowTemplate,
    requestId: `wf-${Date.now()}`,
    submittedAt: new Date().toISOString(),
    requestSummary: payload.prompt.trim()
      ? payload.prompt
      : `Review the highest-risk retention strategy for ${targetCustomer.name}.`,
    approval: {
      ...workflowTemplate.approval,
      customerId: targetCustomer.id,
      customerName: targetCustomer.name,
    },
  };
}

export async function submitFeedback(payload: FeedbackPayload) {
  await pause(100);

  return {
    requestId: payload.requestId,
    verdict: payload.verdict,
    note: payload.note,
    recordedAt: new Date().toISOString(),
  };
}

export async function executeAction(approvalId: string): Promise<ActionResult> {
  await pause(180);

  return {
    id: approvalId,
    status: "queued",
    summary: "Approval captured. The execution lane has queued the governed retention action.",
    auditNote:
      "Phase 1 prototype recorded the approval in the audit layer and stopped before external side effects.",
    executedAt: new Date().toISOString(),
  };
}
