'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface StreamingTextProps {
  text: string
  speed?: number
  onComplete?: () => void
  className?: string
  showCursor?: boolean
}

export function StreamingText({ text, speed = 20, onComplete, className, showCursor = true }: StreamingTextProps) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    setDisplayed('')
    setDone(false)
    let i = 0
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1))
        i++
      } else {
        clearInterval(interval)
        setDone(true)
        onComplete?.()
      }
    }, speed)
    return () => clearInterval(interval)
  }, [text, speed, onComplete])

  return (
    <span className={cn('', className)}>
      {displayed}
      {showCursor && !done && (
        <span className="inline-block w-0.5 h-4 bg-indigo-400 ml-0.5 align-middle animate-pulse" />
      )}
    </span>
  )
}
