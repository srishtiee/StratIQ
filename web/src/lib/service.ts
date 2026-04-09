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
} from "@/data/mock-data";

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const defaultRequestTimeoutMs = 8_000;
const askRequestTimeoutMs = 60_000;
const envDemoRole = process.env.NEXT_PUBLIC_STRATIQ_DEMO_ROLE ?? "executive";
const envDemoUserId = process.env.NEXT_PUBLIC_STRATIQ_DEMO_USER_ID ?? "demo-exec";
const envDemoUserName = process.env.NEXT_PUBLIC_STRATIQ_DEMO_USER_NAME ?? "Demo Executive";

let hasWarnedAboutFallback = false;
const customerSummaryCache = new Map<string, CustomerRiskSummary>();

export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_STRATIQ_API_URL ?? "http://localhost:8000";
}

const ROLE_STORAGE_KEY = "stratiq-demo-role";
const USER_ID_STORAGE_KEY = "stratiq-demo-user-id";
const USER_NAME_STORAGE_KEY = "stratiq-demo-user-name";
const LAST_CUSTOMER_KEY = "stratiq-last-customer-id";
const ACTOR_CHANGED_EVENT = "stratiq:actor-changed";
const CUSTOMER_CHANGED_EVENT = "stratiq:customer-changed";
const DEMO_SESSION_KEY = "stratiq-demo-session";
const SESSION_CHANGED_EVENT = "stratiq:session-changed";

export type RuntimeActor = {
  role: string;
  userId: string;
  userName: string;
};
export type DemoUser = RuntimeActor & { email: string };

const DEMO_USERS: DemoUser[] = [
  { email: "exec@stratiq.demo", userId: "demo-exec", userName: "Demo Executive", role: "executive" },
  { email: "approver@stratiq.demo", userId: "demo-approver", userName: "Demo Approver", role: "approver" },
  { email: "analyst@stratiq.demo", userId: "demo-analyst", userName: "Demo Analyst", role: "analyst" },
  { email: "admin@stratiq.demo", userId: "demo-admin", userName: "Demo Admin", role: "admin" },
  { email: "viewer@stratiq.demo", userId: "demo-viewer", userName: "Demo Viewer", role: "viewer" },
];

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function getRuntimeActor(): RuntimeActor {
  if (typeof window === "undefined") {
    return { role: envDemoRole, userId: envDemoUserId, userName: envDemoUserName };
  }
  return {
    role: window.localStorage.getItem(ROLE_STORAGE_KEY) ?? envDemoRole,
    userId: window.localStorage.getItem(USER_ID_STORAGE_KEY) ?? envDemoUserId,
    userName: window.localStorage.getItem(USER_NAME_STORAGE_KEY) ?? envDemoUserName,
  };
}

export function setRuntimeActor(actor: RuntimeActor) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(ROLE_STORAGE_KEY, actor.role);
  window.localStorage.setItem(USER_ID_STORAGE_KEY, actor.userId);
  window.localStorage.setItem(USER_NAME_STORAGE_KEY, actor.userName);
  window.localStorage.setItem(DEMO_SESSION_KEY, "active");
  window.dispatchEvent(new Event(ACTOR_CHANGED_EVENT));
  window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
}

export function clearRuntimeActorOverride() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(ROLE_STORAGE_KEY);
  window.localStorage.removeItem(USER_ID_STORAGE_KEY);
  window.localStorage.removeItem(USER_NAME_STORAGE_KEY);
  window.localStorage.removeItem(DEMO_SESSION_KEY);
  window.dispatchEvent(new Event(ACTOR_CHANGED_EVENT));
  window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
}

export function getDemoUsers(): DemoUser[] {
  return DEMO_USERS;
}

export function loginAsDemoUser(email: string): boolean {
  const selected = DEMO_USERS.find((user) => user.email === email);
  if (!selected) {
    return false;
  }
  setRuntimeActor(selected);
  return true;
}

export function hasDemoSession(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(DEMO_SESSION_KEY) === "active";
}

export function subscribeDemoSession(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const onStorage = (event: StorageEvent) => {
    if (!event.key || event.key === DEMO_SESSION_KEY) {
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(SESSION_CHANGED_EVENT, listener);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(SESSION_CHANGED_EVENT, listener);
  };
}

export function subscribeRuntimeActor(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const onStorage = (event: StorageEvent) => {
    if (!event.key || [ROLE_STORAGE_KEY, USER_ID_STORAGE_KEY, USER_NAME_STORAGE_KEY].includes(event.key)) {
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(ACTOR_CHANGED_EVENT, listener);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(ACTOR_CHANGED_EVENT, listener);
  };
}

export function getLastWorkflowCustomerId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(LAST_CUSTOMER_KEY);
}

export function setLastWorkflowCustomerId(customerId: string) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(LAST_CUSTOMER_KEY, customerId);
  window.dispatchEvent(new Event(CUSTOMER_CHANGED_EVENT));
}

export function subscribeLastWorkflowCustomer(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const onStorage = (event: StorageEvent) => {
    if (!event.key || event.key === LAST_CUSTOMER_KEY) {
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CUSTOMER_CHANGED_EVENT, listener);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CUSTOMER_CHANGED_EVENT, listener);
  };
}

type ApiRequestInit = RequestInit & {
  timeoutMs?: number;
  throwOnHttpError?: boolean;
};

async function fetchFromApi<T>(path: string, init?: ApiRequestInit): Promise<T | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    init?.timeoutMs ?? defaultRequestTimeoutMs,
  );

  const { timeoutMs, throwOnHttpError, ...fetchInit } = init ?? {};
  const actor = getRuntimeActor();

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...fetchInit,
      headers: {
        "Content-Type": "application/json",
        "X-StratIQ-Role": actor.role,
        "X-StratIQ-User-ID": actor.userId,
        "X-StratIQ-User-Name": actor.userName,
        ...(fetchInit.headers ?? {}),
      },
      cache: "no-store",
      signal: controller.signal,
    });
    void timeoutMs;

    if (!response.ok) {
      if (throwOnHttpError) {
        let detail = `HTTP ${response.status}`;
        try {
          const body = (await response.json()) as { detail?: string };
          if (body.detail) {
            detail = body.detail;
          }
        } catch {
          // ignore parse errors
        }
        throw new ApiError(response.status, detail);
      }
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
    for (const customer of apiCustomers) {
      customerSummaryCache.set(customer.id, customer);
    }
    return apiCustomers;
  }

  await pause(120);
  for (const customer of customers) {
    customerSummaryCache.set(customer.id, customer);
  }
  return customers;
}

export async function getCustomerById(id: string): Promise<CustomerDetail | undefined> {
  const apiCustomer = await fetchFromApi<CustomerDetail>(`/api/customers/${id}`);
  if (apiCustomer) {
    customerSummaryCache.set(apiCustomer.id, apiCustomer);
    return apiCustomer;
  }

  await pause(120);
  const detail = customerDetails.find((customer) => customer.id === id);
  if (detail) {
    customerSummaryCache.set(detail.id, detail);
    return detail;
  }
  const summary = customerSummaryCache.get(id);
  if (!summary) {
    return undefined;
  }
  return {
    ...summary,
    evidence: [],
    recentRuns: [],
    latestApproval: null,
  };
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

  return undefined;
}

export async function submitAsk(payload: WorkflowRequest): Promise<WorkflowResponse> {
  const apiWorkflow = await fetchFromApi<WorkflowResponse>("/api/ask", {
    method: "POST",
    body: JSON.stringify(payload),
    timeoutMs: askRequestTimeoutMs,
  });

  if (apiWorkflow) {
    return apiWorkflow;
  }

  throw new Error(
    "StratIQ API did not return a workflow response. Check that the FastAPI backend is running and connected to the database.",
  );
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
    throwOnHttpError: true,
  });

  if (apiAction) {
    return apiAction;
  }
  throw new Error("Action request returned no response.");
}

export function getMockActionHistory() {
  return actionHistory;
}
