import type {
  ActionResult,
  ApprovalActionPayload,
  ApprovalRequest,
  AuditRecord,
  CustomerDetail,
  CustomerRiskSummary,
  DashboardInsights,
  FeedbackPayload,
  WorkflowRequest,
  WorkflowResponse,
} from "@shared/contracts";
import {
  actionHistory,
  approvals,
  auditRecords,
  customerDetails,
  customers,
  dashboardInsights,
  workflowTemplate,
} from "@/data/mock-data";

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const requestTimeoutMs = 1800;
let hasWarnedAboutFallback = false;

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
      warnAboutFallback(path, `HTTP ${response.status}`);
      return null;
    }

    return (await response.json()) as T;
  } catch (error) {
    warnAboutFallback(path, error instanceof Error ? error.message : "request failed");
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function warnAboutFallback(path: string, reason: string) {
  if (reason.includes("Dynamic server usage")) {
    return;
  }

  if (hasWarnedAboutFallback) {
    return;
  }

  hasWarnedAboutFallback = true;
  console.warn(
    `StratIQ API unavailable for ${path}; using local development fallback data. Reason: ${reason}`,
  );
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

export async function getCustomerById(id: string): Promise<CustomerDetail | undefined> {
  const apiCustomer = await fetchFromApi<CustomerDetail>(`/api/customers/${id}`);
  if (apiCustomer) {
    return apiCustomer;
  }

  await pause(120);
  return customerDetails.find((customer) => customer.id === id);
}

export async function listApprovals(): Promise<ApprovalRequest[]> {
  const apiApprovals = await fetchFromApi<ApprovalRequest[]>("/api/approvals");
  if (apiApprovals) {
    return apiApprovals;
  }

  await pause(100);
  return approvals;
}

export async function listAuditRecords(): Promise<AuditRecord[]> {
  const apiAudit = await fetchFromApi<AuditRecord[]>("/api/audit");
  if (apiAudit) {
    return apiAudit;
  }

  await pause(100);
  return auditRecords;
}

export async function getLatestWorkflow(customerId?: string): Promise<WorkflowResponse | undefined> {
  const query = customerId ? `?customer_id=${encodeURIComponent(customerId)}` : "";
  const apiWorkflow = await fetchFromApi<WorkflowResponse>(`/api/workflows/latest${query}`);
  if (apiWorkflow) {
    return apiWorkflow;
  }

  await pause(120);
  if (!customerId || workflowTemplate.targetEntity.id === customerId) {
    return workflowTemplate;
  }

  return undefined;
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
  return {
    ...workflowTemplate,
    requestId: `run-${Date.now()}`,
    submittedAt: new Date().toISOString(),
    requestSummary: payload.prompt,
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

export async function executeAction(payload: ApprovalActionPayload): Promise<ActionResult> {
  const apiAction = await fetchFromApi<ActionResult>("/api/action", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (apiAction) {
    return apiAction;
  }

  await pause(180);
  return {
    id: `action-${Date.now()}`,
    approvalId: payload.approvalId,
    status:
      payload.decision === "reject"
        ? "rejected"
        : payload.decision === "execute"
          ? "executed"
          : payload.decision === "mark_ready"
            ? "queued"
            : "approved",
    summary: "Approval state captured in the fallback action log.",
    auditNote: "Mock action path recorded a local approval transition for demo continuity.",
    executedAt: new Date().toISOString(),
  };
}

export function getMockActionHistory() {
  return actionHistory;
}
