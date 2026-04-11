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

let hasWarnedAboutFallback = false;
const customerSummaryCache = new Map<string, CustomerRiskSummary>();

export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_STRATIQ_API_URL ?? "http://localhost:8000";
}

const ROLE_STORAGE_KEY = "stratiq-demo-role";
const USER_ID_STORAGE_KEY = "stratiq-demo-user-id";
const USER_NAME_STORAGE_KEY = "stratiq-demo-user-name";
const ACCESS_TOKEN_KEY = "stratiq-access-token";
const LAST_CUSTOMER_KEY = "stratiq-last-customer-id";
const ACTOR_CHANGED_EVENT = "stratiq:actor-changed";
const CUSTOMER_CHANGED_EVENT = "stratiq:customer-changed";
const SESSION_CHANGED_EVENT = "stratiq:session-changed";

export type RuntimeActor = {
  role: string;
  userId: string;
  userName: string;
};
export type DemoUser = RuntimeActor & { email: string };

/** Pre-seeded accounts (password in README: StratIQ-demo-2026). */
export const SEEDED_DEMO_ACCOUNTS: DemoUser[] = [
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
    return { role: "", userId: "", userName: "" };
  }
  const role = window.localStorage.getItem(ROLE_STORAGE_KEY);
  if (!role) {
    return { role: "", userId: "", userName: "" };
  }
  return {
    role,
    userId: window.localStorage.getItem(USER_ID_STORAGE_KEY) ?? "",
    userName: window.localStorage.getItem(USER_NAME_STORAGE_KEY) ?? "",
  };
}

export function setRuntimeActor(actor: RuntimeActor) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(ROLE_STORAGE_KEY, actor.role);
  window.localStorage.setItem(USER_ID_STORAGE_KEY, actor.userId);
  window.localStorage.setItem(USER_NAME_STORAGE_KEY, actor.userName);
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
  window.dispatchEvent(new Event(ACTOR_CHANGED_EVENT));
  window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string | null) {
  if (typeof window === "undefined") {
    return;
  }
  if (token) {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
  window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
}

export function applyAuthSession(token: string, user: { id: string; name: string; role: string }) {
  setAccessToken(token);
  setRuntimeActor({ userId: user.id, userName: user.name, role: user.role });
}

export function logout() {
  setAccessToken(null);
  clearRuntimeActorOverride();
}

export type AuthUser = { id: string; email: string; name: string; role: string };
export type UserRole = "executive" | "approver" | "analyst" | "admin" | "viewer";

export type AuthTokenResponse = {
  accessToken: string;
  tokenType: string;
  user: AuthUser;
};

export type UserRoleUpdateResponse = {
  user: AuthUser;
};

export async function loginWithPassword(email: string, password: string): Promise<AuthTokenResponse> {
  const response = await fetch(`${getApiBaseUrl()}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail) {
        detail = body.detail;
      }
    } catch {
      // ignore
    }
    throw new ApiError(response.status, detail);
  }
  return (await response.json()) as AuthTokenResponse;
}

export async function registerAccount(
  email: string,
  password: string,
  name: string,
): Promise<AuthTokenResponse> {
  const response = await fetch(`${getApiBaseUrl()}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
    cache: "no-store",
  });
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail) {
        detail = body.detail;
      }
    } catch {
      // ignore
    }
    throw new ApiError(response.status, detail);
  }
  return (await response.json()) as AuthTokenResponse;
}

export async function loginWithGoogleCredential(credential: string): Promise<AuthTokenResponse> {
  const response = await fetch(`${getApiBaseUrl()}/api/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
    cache: "no-store",
  });
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail) {
        detail = body.detail;
      }
    } catch {
      // ignore
    }
    throw new ApiError(response.status, detail);
  }
  return (await response.json()) as AuthTokenResponse;
}

export async function listUsers(): Promise<AuthUser[]> {
  const response = await fetchFromApi<AuthUser[]>("/api/auth/users", { throwOnHttpError: true });
  if (!response) {
    throw new Error("No response from user list endpoint.");
  }
  return response;
}

export async function updateUserRole(userId: string, role: UserRole): Promise<AuthUser> {
  const response = await fetchFromApi<UserRoleUpdateResponse>(`/api/auth/users/${encodeURIComponent(userId)}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
    throwOnHttpError: true,
  });
  if (!response) {
    throw new Error("No response from user role update endpoint.");
  }
  return response.user;
}

export function hasAuthSession(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return Boolean(window.localStorage.getItem(ACCESS_TOKEN_KEY));
}

/** @deprecated Use hasAuthSession */
export function hasDemoSession(): boolean {
  return hasAuthSession();
}

export function subscribeAuthSession(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const onStorage = (event: StorageEvent) => {
    if (!event.key || event.key === ACCESS_TOKEN_KEY) {
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

/** @deprecated Use subscribeAuthSession */
export const subscribeDemoSession = subscribeAuthSession;

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
  const token = getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(fetchInit.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else if (actor.role && actor.userId && actor.userName) {
    headers["X-StratIQ-Role"] = actor.role;
    headers["X-StratIQ-User-ID"] = actor.userId;
    headers["X-StratIQ-User-Name"] = actor.userName;
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...fetchInit,
      headers,
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
