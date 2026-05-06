import type {
  ActionResult,
  ApprovalActionPayload,
  ApprovalRequest,
  AuditRecord,
  CustomerDetail,
  CustomerRiskSummary,
  DashboardInsights,
  FeedbackPayload,
  PaginatedResponse,
  WorkflowRequest,
  WorkflowResponse,
  WorkflowRunSummary,
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
const requestTimeoutMs = 8_000;
const llmRequestTimeoutMs = 90_000;

export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_STRATIQ_API_URL ?? "http://localhost:8000";
}

async function getToken() {
  if (typeof window !== "undefined") {
    return localStorage.getItem("stratiq_token");
  }
  // Server-side: try to get from next/headers
  try {
    const { cookies } = require("next/headers");
    const cookieStore = await cookies();
    return cookieStore.get("stratiq_token")?.value ?? null;
  } catch {
    return null;
  }
}

export async function login(username: string, password: string): Promise<boolean> {
  const formData = new URLSearchParams();
  formData.append("username", username);
  formData.append("password", password);

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    });

    if (!response.ok) return false;

    const data = await response.json();
    localStorage.setItem("stratiq_token", data.access_token);
    // Set cookie for middleware (Next.js)
    document.cookie = `stratiq_token=${data.access_token}; path=/; max-age=${60 * 60 * 24}; SameSite=Lax`;
    return true;
  } catch {
    return false;
  }
}

export function logout() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("stratiq_token");
    document.cookie = "stratiq_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    window.location.href = "/login";
  }
}

async function fetchFromApi<T>(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<T | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), init?.timeoutMs ?? requestTimeoutMs);

  try {
    const token = await getToken();
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

export async function getCustomerById(id: string): Promise<CustomerDetail | undefined> {
  const apiCustomer = await fetchFromApi<CustomerDetail>(`/api/customers/${id}`);
  if (apiCustomer) {
    return apiCustomer;
  }

  await pause(120);
  return customerDetails.find((customer) => customer.id === id);
}

export async function listApprovals(page: number = 1, pageSize: number = 10): Promise<PaginatedResponse<ApprovalRequest>> {
  const apiApprovals = await fetchFromApi<PaginatedResponse<ApprovalRequest>>(`/api/approvals?page=${page}&page_size=${pageSize}`);
  if (apiApprovals) {
    return apiApprovals;
  }

  await pause(100);
  return {
    items: approvals,
    page: 1,
    pageSize: 10,
    total: approvals.length,
    totalPages: 1
  };
}

export async function listAuditRecords(page: number = 1, pageSize: number = 25): Promise<PaginatedResponse<AuditRecord>> {
  const apiAudit = await fetchFromApi<PaginatedResponse<AuditRecord>>(`/api/audit?page=${page}&page_size=${pageSize}`);
  if (apiAudit) {
    return apiAudit;
  }

  await pause(100);
  return {
    items: auditRecords,
    page: 1,
    pageSize: 25,
    total: auditRecords.length,
    totalPages: 1
  };
}

export async function listWorkflows(customerId?: string): Promise<WorkflowRunSummary[]> {
  const query = customerId ? `?customer_id=${encodeURIComponent(customerId)}` : "";
  const apiWorkflows = await fetchFromApi<WorkflowRunSummary[]>(`/api/workflows${query}`);
  if (apiWorkflows) {
    return apiWorkflows;
  }
  return [];
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


export async function streamAsk(payload: WorkflowRequest, onEvent?: (event: any) => void): Promise<WorkflowResponse> {
  const token = await getToken();
  const response = await fetch(`${getApiBaseUrl()}/api/ask/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok || !response.body) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Stream request failed");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    
    const lines = buffer.split('\n\n');
    buffer = lines.pop() || "";
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === 'complete') {
            return data.result as WorkflowResponse;
          } else if (data.type === 'error') {
            throw new Error(data.message);
          } else {
            onEvent?.(data);
          }
        } catch (e) {
          console.error("Failed to parse stream line:", line, e);
        }
      }
    }
  }
  
  return workflowTemplate;
}

export async function submitAsk(payload: WorkflowRequest): Promise<WorkflowResponse> {

  const apiWorkflow = await fetchFromApi<WorkflowResponse>("/api/ask", {
    method: "POST",
    body: JSON.stringify(payload),
    timeoutMs: llmRequestTimeoutMs,
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
