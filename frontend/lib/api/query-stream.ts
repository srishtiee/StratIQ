import { API_BASE, getOrgId, getUserId } from './client'
import type { ApiAction } from './types'

export type SuggestedAction = {
  id?: string
  title?: string
  type?: string
  description?: string
}

export type Source = {
  type?: string
  id?: string
  title?: string
  excerpt?: string
  entity_type?: string
  entity_id?: string
  metadata?: Record<string, unknown> | null
}

export type EntityCardTier =
  | 'critical' | 'high' | 'moderate' | 'low'
  | 'strong' | 'ok'
  | null

export type EntityCardScore = {
  label: string
  value: number | string | null
  tier: EntityCardTier
}

export type EntityCard = {
  entity_type: 'employee' | 'customer'
  entity_id: string
  name: string
  subtitle: string
  primary_score: EntityCardScore | null
  secondary_score: EntityCardScore | null
  stat: { label: string; value: string } | null
  rationale: string
  revenue_at_risk?: string | null
}

export type StreamEvent =
  | { type: 'session'; data: { session_id: string } }
  | { type: 'status'; data: { step: string; message: string } }
  | { type: 'token'; data: { text: string } }
  | { type: 'refined'; data: { text: string } }
  | { type: 'action_draft'; data: { action: ApiAction } }
  | { type: 'entity_cards'; data: { entity_type: 'employee' | 'customer'; cards: EntityCard[] } }
  | {
      type: 'done'
      data: {
        query_id: string
        session_id: string
        response: string
        sources: Source[]
        suggested_actions: SuggestedAction[]
        latency_ms: number
      }
    }

export async function* streamQuery({
  module,
  question,
  sessionId,
  signal,
}: {
  module: 'people' | 'retention'
  question: string
  sessionId?: string | null
  signal?: AbortSignal
}): AsyncGenerator<StreamEvent> {
  const res = await fetch(`${API_BASE}/queries/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      org_id: getOrgId(),
      user_id: getUserId(),
      module,
      question,
      ...(sessionId ? { session_id: sessionId } : {}),
    }),
    signal,
  })

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '')
    throw new Error(`Query failed: ${res.status} ${text}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })

    // SSE events are separated by \n\n; each block has "event: x\ndata: y" lines
    let idx
    while ((idx = buf.indexOf('\n\n')) !== -1) {
      const block = buf.slice(0, idx)
      buf = buf.slice(idx + 2)

      let eventName: string | null = null
      let dataLine: string | null = null
      for (const line of block.split('\n')) {
        if (line.startsWith('event: ')) eventName = line.slice(7).trim()
        else if (line.startsWith('data: ')) dataLine = line.slice(6)
      }
      if (!eventName || !dataLine) continue

      try {
        yield { type: eventName, data: JSON.parse(dataLine) } as StreamEvent
      } catch {
        // skip malformed events
      }
    }
  }
}
