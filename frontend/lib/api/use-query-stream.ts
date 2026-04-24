'use client'

import { useState, useRef, useCallback } from 'react'
import { streamQuery, type Source, type SuggestedAction, type EntityCard } from './query-stream'
import type { ApiAction } from './types'

export type ChatMessage = {
  id: string
  question: string
  response: string
  status: string | null
  sources: Source[]
  suggestedActions: SuggestedAction[]
  draftedActions: ApiAction[]
  entityCards: EntityCard[]
  done: boolean
  error: string | null
}

export function useQueryStream(module: 'people' | 'retention') {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  // Read current sessionId inside async closures without re-creating `send`
  const sessionRef = useRef<string | null>(null)

  const send = useCallback(
    async (question: string) => {
      const trimmed = question.trim()
      if (!trimmed || isStreaming) return

      const localId = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `local-${Date.now()}`

      setMessages(prev => [
        ...prev,
        {
          id: localId,
          question: trimmed,
          response: '',
          status: 'Starting…',
          sources: [],
          suggestedActions: [],
          draftedActions: [],
          entityCards: [],
          done: false,
          error: null,
        },
      ])
      setIsStreaming(true)

      const ac = new AbortController()
      abortRef.current = ac

      const updateLast = (patch: Partial<ChatMessage>) =>
        setMessages(prev => {
          if (prev.length === 0) return prev
          const last = prev[prev.length - 1]
          return [...prev.slice(0, -1), { ...last, ...patch }]
        })

      try {
        for await (const ev of streamQuery({
          module,
          question: trimmed,
          sessionId: sessionRef.current,
          signal: ac.signal,
        })) {
          if (ev.type === 'session') {
            sessionRef.current = ev.data.session_id
            setSessionId(ev.data.session_id)
          } else if (ev.type === 'status') {
            updateLast({ status: ev.data.message })
          } else if (ev.type === 'token') {
            setMessages(prev => {
              if (prev.length === 0) return prev
              const last = prev[prev.length - 1]
              return [...prev.slice(0, -1), { ...last, response: last.response + ev.data.text, status: null }]
            })
          } else if (ev.type === 'refined') {
            updateLast({ response: ev.data.text, status: null })
          } else if (ev.type === 'action_draft') {
            // Append — pipeline emits one action_draft per draft; multi-action requests produce many.
            setMessages(prev => {
              if (prev.length === 0) return prev
              const last = prev[prev.length - 1]
              return [...prev.slice(0, -1), {
                ...last,
                draftedActions: [...last.draftedActions, ev.data.action],
                status: null,
              }]
            })
          } else if (ev.type === 'entity_cards') {
            updateLast({ entityCards: ev.data.cards, status: null })
          } else if (ev.type === 'done') {
            updateLast({
              id: ev.data.query_id,
              response: ev.data.response,
              status: null,
              sources: ev.data.sources ?? [],
              suggestedActions: ev.data.suggested_actions ?? [],
              done: true,
            })
            sessionRef.current = ev.data.session_id
            setSessionId(ev.data.session_id)
          }
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        updateLast({
          error: (err as Error).message ?? 'Request failed',
          status: null,
          done: true,
        })
      } finally {
        setIsStreaming(false)
        abortRef.current = null
      }
    },
    [module, isStreaming]
  )

  const cancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  /** Start a brand new chat — drops messages and detaches from the current session */
  const newChat = useCallback(() => {
    sessionRef.current = null
    setSessionId(null)
    setMessages([])
  }, [])

  /** Hydrate from an existing session loaded via the sessions API */
  const loadSession = useCallback(
    (loaded: { session: { id: string }; turns: Array<{ id: string; question: string; response: { narrative?: string } | null; sources?: Source[] | null }> }) => {
      sessionRef.current = loaded.session.id
      setSessionId(loaded.session.id)
      setMessages(
        loaded.turns.map(t => ({
          id: t.id,
          question: t.question,
          response: (t.response && (t.response as { narrative?: string }).narrative) || '',
          status: null,
          sources: t.sources ?? [],
          suggestedActions: [],
          draftedActions: [],
          entityCards: [],
          done: true,
          error: null,
        }))
      )
    },
    []
  )

  return { messages, sessionId, isStreaming, send, cancel, newChat, loadSession }
}
