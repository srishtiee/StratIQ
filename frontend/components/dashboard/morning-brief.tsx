'use client'

import { Sparkles, ArrowRight, AlertTriangle, Users, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MarkdownLite } from '@/components/shared/markdown-lite'
import Link from 'next/link'
import { useMorningBrief } from '@/lib/api/hooks'

export function MorningBrief() {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
  const { data: brief, isLoading } = useMorningBrief()

  return (
    <div className="relative rounded-xl border border-indigo-200 overflow-hidden bg-gradient-to-r from-indigo-50/60 to-white">
      <div className="relative p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-md bg-indigo-100 border border-indigo-200 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              </div>
              <span className="text-xs font-medium text-indigo-600">AI Morning Brief</span>
              <span className="text-xs text-gray-400 ml-1">{today}</span>
            </div>
            <div className="text-sm text-gray-700 leading-relaxed max-w-3xl min-h-[3rem]">
              {isLoading ? (
                <span className="flex items-center gap-2 text-gray-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating your brief…
                </span>
              ) : brief ? (
                <MarkdownLite text={brief} revealBlockMs={350} />
              ) : (
                <span className="text-gray-400 text-xs">No brief available.</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4">
          <Link href="/actions">
            <Button size="sm" className="h-7 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Review Pending Actions
              <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
          <Link href="/retention">
            <Button size="sm" className="h-7 text-xs bg-white hover:bg-gray-50 text-gray-600 border border-[#e8e8ef] gap-1.5">
              <Users className="w-3.5 h-3.5" />
              View At-Risk Accounts
              <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
