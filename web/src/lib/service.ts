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
const requestTimeoutMs = 1800;

export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_STRATIQ_API_URL ?? "http://localhost:8000";
}

async function fetchFromApi<T>(path: string, init?: RequestInit): Promise<T | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getDashboardInsights(): Promise<DashboardInsights> {
  const apiInsights = await fetchFromApi<DashboardInsights>("/api/insights");

  if (apiInsights) {
    return apiInsights;
  }

  await pause(120);
  return dashboardInsights;
}

export async function listCustomers(): Promise<CustomerRiskSummary[]> {
  const apiCustomers = await fetchFromApi<CustomerRiskSummary[]>("/api/customers");

  if (apiCustomers) {
    return apiCustomers;
  }

  await pause(120);
  return customers;
}

export async function getCustomerById(id: string): Promise<CustomerRiskSummary | undefined> {
  const apiCustomer = await fetchFromApi<CustomerRiskSummary>(`/api/customers/${id}`);

  if (apiCustomer) {
    return apiCustomer;
  }

  await pause(120);
  return customers.find((customer) => customer.id === id);
}

export async function listApprovals(): Promise<ApprovalRequest[]> {
  await pause(100);
  return approvals;
}

export async function submitAsk(payload: WorkflowRequest): Promise<WorkflowResponse> {
  const apiWorkflow = await fetchFromApi<WorkflowResponse>("/api/ask", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (apiWorkflow) {
    return apiWorkflow;
  }

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
  const apiFeedback = await fetchFromApi<{
    requestId: string;
    verdict: FeedbackPayload["verdict"];
    note: string;
    recordedAt: string;
  }>("/api/feedback", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (apiFeedback) {
    return apiFeedback;
  }

  await pause(100);

  return {
    requestId: payload.requestId,
    verdict: payload.verdict,
    note: payload.note,
    recordedAt: new Date().toISOString(),
  };
}

export async function executeAction(approvalId: string): Promise<ActionResult> {
  const apiAction = await fetchFromApi<ActionResult>("/api/action", {
    method: "POST",
    body: JSON.stringify({ approvalId }),
  });

  if (apiAction) {
    return apiAction;
  }

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
