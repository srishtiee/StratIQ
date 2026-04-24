'use client'

import { useState, useEffect, useRef } from 'react'
import { Sparkles, Send, Loader2, AlertCircle, ChevronDown, FileText, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { useQueryStream } from '@/lib/api/use-query-stream'
import type { Source } from '@/lib/api/query-stream'
import { ActionInlineForm } from './action-inline-form'
import { MarkdownLite } from './markdown-lite'
import { EntityCardList } from './entity-cards'

type Chat = ReturnType<typeof useQueryStream>

const SOURCE_LABEL: Record<string, string> = {
  survey_response: 'Survey response',
  csm_note: 'CSM note',
  compensation_policy: 'Comp policy',
  uploaded_doc: 'Document',
}

function sourceIcon(type: string | undefined) {
  if (type === 'csm_note') return MessageSquare
  return FileText
}

function sourceTitle(s: Source): string {
  if (s.title) return s.title
  const meta = s.metadata as Record<string, unknown> | null | undefined
  if (meta) {
    if (typeof meta.round === 'string') return meta.round
    if (typeof meta.department === 'string') return meta.department
    if (typeof meta.note_type === 'string') return meta.note_type as string
  }
  return SOURCE_LABEL[s.type ?? ''] ?? 'Source'
}

function SourceList({ sources }: { sources: Source[] }) {
  const [open, setOpen] = useState(false)
  if (sources.length === 0) return null
  return (
    <div className="mt-2 border-t border-gray-200 pt-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-700"
      >
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? '' : '-rotate-90'}`} />
        {sources.length} source{sources.length === 1 ? '' : 's'}
      </button>
      {open && (
        <ul className="mt-1.5 space-y-1.5">
          {sources.map((s, i) => {
            const Icon = sourceIcon(s.type)
            const label = SOURCE_LABEL[s.type ?? ''] ?? (s.type ?? 'source')
            return (
              <li key={s.id ?? i} className="rounded-md border border-gray-200 bg-white p-2">
                <div className="flex items-center gap-1.5 text-[10px] text-gray-500 mb-0.5">
                  <Icon className="w-3 h-3" />
                  <span className="font-medium text-gray-700">{sourceTitle(s)}</span>
                  <span>·</span>
                  <span>{label}</span>
                </div>
                {s.excerpt && (
                  <p className="text-[11px] text-gray-700 leading-snug whitespace-pre-wrap">
                    “{s.excerpt}{s.excerpt.length >= 200 ? '…' : ''}”
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

type Props = {
  chat: Chat
  placeholder?: string
  suggestions?: string[]
  emptyHint?: string
}

export function QueryPanel({
  chat,
  placeholder = 'Ask a question…',
  suggestions = [],
  emptyHint = 'Ask a question to get started.',
}: Props) {
  const { messages, isStreaming, send } = chat
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  function handleSend(q: string) {
    const trimmed = q.trim()
    if (!trimmed || isStreaming) return
    setInput('')
    send(trimmed)
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto pb-4 pr-1">
        {messages.length === 0 && (
          <div className="text-center text-xs text-gray-400 py-12">{emptyHint}</div>
        )}
        {messages.map((m) => (
          <div key={m.id} className="space-y-2">
            <div className="flex justify-end">
              <div className="bg-gray-900 rounded-lg px-3 py-2 max-w-lg text-sm text-white">
                {m.question}
              </div>
            </div>
            <div className="flex gap-2">
              <div className="w-6 h-6 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-3 h-3 text-gray-700" />
              </div>
              <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 leading-relaxed">
                {m.error ? (
                  <div className="flex items-center gap-1.5 text-gray-700">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span className="text-xs">{m.error}</span>
                  </div>
                ) : m.status && !m.response ? (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="text-xs italic">{m.status}</span>
                  </div>
                ) : (
                  <>
                    {m.entityCards.length > 0 && <EntityCardList cards={m.entityCards} />}
                    {m.done ? (
                      <MarkdownLite text={m.response} />
                    ) : (
                      <div className="whitespace-pre-wrap">
                        {m.response}
                        <span className="inline-block w-1.5 h-3 bg-gray-400 ml-0.5 animate-pulse align-middle" />
                      </div>
                    )}
                    {m.draftedActions.map(a => (
                      <ActionInlineForm key={a.id} initialAction={a} />
                    ))}
                    {m.done && <SourceList sources={m.sources} />}
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {suggestions.length > 0 && messages.length === 0 && (
        <div className="flex gap-1.5 flex-wrap mb-2">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => handleSend(s)}
              className="text-[10px] px-2 py-1 rounded border border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300 bg-white transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2 border-t border-gray-200 pt-3">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend(input)}
          placeholder={placeholder}
          disabled={isStreaming}
          className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gray-400 disabled:opacity-50"
        />
        <Button
          onClick={() => handleSend(input)}
          disabled={isStreaming || !input.trim()}
          size="sm"
          className="bg-gray-900 hover:bg-gray-800 h-9 w-9 p-0"
        >
          {isStreaming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        </Button>
      </div>
    </div>
  )
}

