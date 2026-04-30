'use client'

import React, { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Minimal markdown renderer for the small subset the AI emits in briefs and
 * chat: `## heading`, `**bold**`, `*italic*`, `> blockquote`, blank-line
 * paragraphs. Intentionally not a full markdown parser — adding a dep
 * for one feature isn't worth it.
 *
 * Pass `revealBlockMs` to fade blocks in one at a time (used by the morning
 * brief to keep the "AI is composing" feel without flickering markdown syntax).
 */
export function MarkdownLite({
  text,
  className,
  revealBlockMs,
}: {
  text: string
  className?: string
  revealBlockMs?: number
}) {
  const blocks = useBlocks(text)
  const visibleCount = useStaggeredReveal(blocks.length, revealBlockMs)
  const visible = revealBlockMs ? blocks.slice(0, visibleCount) : blocks

  return (
    <div className={cn('space-y-2', className)}>
      {visible.map((block, i) => (
        <BlockNode key={i} block={block} />
      ))}
    </div>
  )
}

function useBlocks(text: string) {
  return React.useMemo(() => parseBlocks(text), [text])
}

function useStaggeredReveal(total: number, intervalMs: number | undefined): number {
  const [count, setCount] = useState(intervalMs ? 0 : total)

  useEffect(() => {
    if (!intervalMs) {
      setCount(total)
      return
    }
    setCount(0)
    if (total === 0) return
    let i = 0
    const tick = () => {
      i++
      setCount(i)
      if (i < total) timer = setTimeout(tick, intervalMs)
    }
    let timer = setTimeout(tick, intervalMs)
    return () => clearTimeout(timer)
  }, [total, intervalMs])

  return count
}

type Block =
  | { kind: 'heading'; text: string }
  | { kind: 'blockquote'; text: string }
  | { kind: 'paragraph'; text: string }

function parseBlocks(text: string): Block[] {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map(b => b.trim())
    .filter(Boolean)
    .map(block => {
      const heading = block.match(/^#{1,6}\s+(.*)$/)
      if (heading) return { kind: 'heading' as const, text: heading[1] }
      if (block.split('\n').every(l => l.trim().startsWith('>'))) {
        const stripped = block.split('\n').map(l => l.replace(/^\s*>\s?/, '')).join('\n')
        return { kind: 'blockquote' as const, text: stripped }
      }
      return { kind: 'paragraph' as const, text: block }
    })
}

function BlockNode({ block }: { block: Block }) {
  const inner = renderInline(block.text)
  if (block.kind === 'heading') {
    return (
      <h3 className="text-sm font-semibold text-gray-900 mt-1 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 duration-300">
        {inner}
      </h3>
    )
  }
  if (block.kind === 'blockquote') {
    return (
      <blockquote className="border-l-2 border-amber-300 bg-amber-50/60 pl-3 py-1.5 text-xs text-gray-700 italic motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 duration-300">
        {inner}
      </blockquote>
    )
  }
  return (
    <p className="text-sm text-gray-700 leading-relaxed motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 duration-300">
      {inner}
    </p>
  )
}

/**
 * Renders inline markdown: **bold**, *italic*, and explicit \n line breaks.
 * Nesting is intentionally not supported — the AI doesn't emit it.
 */
function renderInline(text: string): React.ReactNode {
  // First, handle bold (**...**), then italic (*...*) within the result.
  // We do this by tokenising into a list of {type, text} chunks.
  type Token = { kind: 'text' | 'bold' | 'italic' | 'br'; value: string }
  const tokens: Token[] = []

  // Normalise line breaks first as br tokens so they survive the regex pass.
  const lines = text.split('\n')
  lines.forEach((line, idx) => {
    if (idx > 0) tokens.push({ kind: 'br', value: '' })
    // Bold first (greedy, but matches **...**)
    const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
    for (const p of parts) {
      if (!p) continue
      if (p.startsWith('**') && p.endsWith('**') && p.length > 4) {
        tokens.push({ kind: 'bold', value: p.slice(2, -2) })
      } else if (p.startsWith('*') && p.endsWith('*') && p.length > 2) {
        tokens.push({ kind: 'italic', value: p.slice(1, -1) })
      } else {
        tokens.push({ kind: 'text', value: p })
      }
    }
  })

  return tokens.map((t, i) => {
    if (t.kind === 'br') return <br key={i} />
    if (t.kind === 'bold') return <strong key={i} className="font-semibold text-gray-900">{t.value}</strong>
    if (t.kind === 'italic') return <em key={i}>{t.value}</em>
    return <React.Fragment key={i}>{t.value}</React.Fragment>
  })
}
