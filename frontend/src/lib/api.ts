const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    ...opts,
  });
  if (!res.ok) {
    let detail = '';
    try {
      const payload = await res.clone().json();
      detail = payload?.detail ?? payload?.message ?? '';
    } catch {
      detail = await res.text();
    }
    throw new Error(detail ? `API ${path} → ${res.status}: ${detail}` : `API ${path} → ${res.status}`);
  }
  return res.json();
}

export const api = {
  kpis:      (months = 12)  => apiFetch<KPISnapshot[]>(`/api/kpis?months=${months}`),
  customers: (status?: string, tier?: string, limit = 50) =>
    apiFetch<Customer[]>(`/api/customers?limit=${limit}${status ? `&status=${status}` : ''}${tier ? `&tier=${tier}` : ''}`),
  customer:  (id: string)   => apiFetch<CustomerDetail>(`/api/customers/${id}`),
  insights:  (limit = 20)   => apiFetch<RunSummary[]>(`/api/insights?limit=${limit}`),
  actions:      (status?: string) => apiFetch<Action[]>(`/api/actions${status ? `?status=${status}` : ''}`),
  ask:          (body: AskRequest) => apiFetch<AskResponse>('/api/ask', { method: 'POST', body: JSON.stringify(body) }),
  askStream:    async (body: AskRequest, onEvent: (event: string, data: any) => void) => {
    const res = await fetch(`${API}/api/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`API /api/ask → ${res.status}`);
    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const payload = JSON.parse(line);
          onEvent(payload.event, payload.data);
        } catch (e) {
          console.error("Failed to parse SSE line", line, e);
        }
      }
    }
  },
  createAction: (body: ActionCreate) => apiFetch<Action>('/api/action', { method: 'POST', body: JSON.stringify(body) }),
  approveAction: (id: string, decision: string, notes?: string) =>
    apiFetch<Action>(`/api/action/${id}`, { method: 'PATCH', body: JSON.stringify({ decision, notes }) }),
};

// ─── Types ─────────────────────────────────────────────────────────────────
export interface KPIItem { name: string; value: number | string; unit?: string; trend?: string; change_pct?: number; }
export interface KPISnapshot { snapshot_date: string; metrics: KPIItem[]; }
export interface Customer {
  id: string; name: string; industry?: string; tier?: string; region?: string;
  account_owner?: string; subscription_status?: string; renewal_probability?: number;
  mrr?: number; churn_signal_count: number;
}
export interface CustomerDetail extends Customer {
  subscription?: { id: string; plan: string; mrr: number; contract_start: string; contract_end: string; renewal_probability: number; status: string; };
  recent_signals: Array<{ signal_type: string; severity: string; detected_at: string; notes: string; }>;
  latest_usage?: { logins_count: number; api_calls: number; support_tickets: number; nps_score: number; period_start: string; period_end: string; };
}
export interface RunSummary { id: string; workflow: string; question: string; status: string; summary?: string; created_at: string; }
export interface Action {
  id: string; run_id?: string; action_type: string; title: string; description?: string;
  target_entity: Record<string, unknown>; status: string; priority: string; due_date?: string;
  created_at: string; updated_at: string;
}
export interface ActionCreate {
  run_id?: string;
  action_type: 'retention_outreach' | 'strategy_brief' | 'segment_flag' | 'internal_rec';
  title: string;
  description?: string;
  target_entity?: Record<string, unknown>;
  priority: 'low' | 'medium' | 'high' | 'critical';
  due_date?: string;
}
export interface EvidenceItem { source_type: string; source_title: string; snippet: string; relevance_score: number; metadata: Record<string, unknown>; }
export interface ReasoningStep { agent: string; label: string; content: string; }
export interface DecisionCard {
  headline: string; rationale: string; key_metrics: KPIItem[]; cited_evidence: EvidenceItem[];
  main_risks: string[]; assumptions: string[]; action_suggestion: string; kpis_to_monitor: string[];
}
export interface AskRequest { question: string; workflow: string; filters: Record<string, unknown>; }
export interface AskResponse {
  run_id: string; summary: string; kpis: KPIItem[]; evidence: EvidenceItem[];
  reasoning: ReasoningStep[]; decision_card: DecisionCard; action_id?: string; action_status?: string; created_at: string;
}
