'use client'

import { useState, useEffect, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Sparkles, Plus, Users, HeartPulse, Trash2, MessageSquare, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { QueryPanel } from '@/components/shared/query-panel'
import { useQueryStream } from '@/lib/api/use-query-stream'
import { useChatSessions, useChatSession, useDeleteChatSession, type ChatSession } from '@/lib/api/hooks'
import { useAuth } from '@/lib/auth/store'

type Module = 'people' | 'retention'

function moduleFromPathname(pathname: string): Module {
  if (pathname.startsWith('/retention')) return 'retention'
  return 'people'
}

const SUGGESTIONS: Record<Module, string[]> = {
  people: [
    'Who is most likely to leave in the next 90 days?',
    'Show me underpaid high performers',
    'Which departments have the highest attrition?',
  ],
  retention: [
    'What is our total revenue at risk this quarter?',
    'Which customers are at highest churn risk?',
    'What are CSMs hearing from at-risk accounts?',
  ],
}

const PLACEHOLDER: Record<Module, string> = {
  people: 'Ask about your workforce…',
  retention: 'Ask about your customers…',
}

const EMPTY_HINT: Record<Module, string> = {
  people: 'Ask anything about your employees, attrition, or compensation.',
  retention: 'Ask anything about churn risk, customer health, or CSM signals.',
}

export function AskAIFab() {
  const auth = useAuth()
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const [module, setModule] = useState<Module>(() => moduleFromPathname(pathname))
  const chat = useQueryStream(module)
  const queryClient = useQueryClient()

  // Update module if user navigates while drawer is closed
  useEffect(() => {
    if (!open) setModule(moduleFromPathname(pathname))
  }, [pathname, open])

  // When the user starts a new turn, the chat hook captures session_id.
  // Refresh the session list when sessionId changes (so a brand-new session shows up).
  useEffect(() => {
    if (chat.sessionId && auth) {
      queryClient.invalidateQueries({ queryKey: ['chat-sessions', auth.orgId, auth.userId] })
    }
  }, [chat.sessionId, queryClient, auth])

  // Hide the FAB entirely when not signed in (e.g. on /login).
  if (!auth) return null

  const handleNewChat = () => chat.newChat()

  const handleSwitchModule = (next: Module) => {
    if (next === module) return
    setModule(next)
    chat.newChat()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 w-12 h-12 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg flex items-center justify-center transition-all hover:scale-105"
        aria-label="Open Ask AI"
      >
        <Sparkles className="w-5 h-5" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="!max-w-none w-full sm:!max-w-[720px] p-0 flex flex-col"
        >
          <SheetHeader className="px-4 py-3 pr-10 border-b border-[#e8e8ef]">
            <div className="flex items-center justify-between gap-3">
              <SheetTitle className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                Ask StratIQ
              </SheetTitle>
              <ModuleSwitcher value={module} onChange={handleSwitchModule} />
            </div>
          </SheetHeader>

          <div className="flex-1 flex min-h-0">
            <SessionSidebar
              activeSessionId={chat.sessionId}
              currentModule={module}
              onNewChat={handleNewChat}
              onSwitchModule={setModule}
              loadSession={chat.loadSession}
            />

            <div className="flex-1 flex flex-col p-4 min-w-0">
              <QueryPanel
                key={`${module}-${chat.sessionId ?? 'new'}`}
                chat={chat}
                placeholder={PLACEHOLDER[module]}
                suggestions={SUGGESTIONS[module]}
                emptyHint={EMPTY_HINT[module]}
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

function ModuleSwitcher({ value, onChange }: { value: Module; onChange: (m: Module) => void }) {
  return (
    <div className="flex items-center gap-0.5 bg-gray-100 rounded-md p-0.5">
      <button
        onClick={() => onChange('people')}
        className={cn(
          'flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors',
          value === 'people' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
        )}
      >
        <Users className="w-3 h-3" />
        People
      </button>
      <button
        onClick={() => onChange('retention')}
        className={cn(
          'flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors',
          value === 'retention' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
        )}
      >
        <HeartPulse className="w-3 h-3" />
        Retention
      </button>
    </div>
  )
}

function SessionSidebar({
  activeSessionId,
  currentModule,
  onNewChat,
  onSwitchModule,
  loadSession,
}: {
  activeSessionId: string | null
  currentModule: Module
  onNewChat: () => void
  onSwitchModule: (m: Module) => void
  loadSession: ReturnType<typeof useQueryStream>['loadSession']
}) {
  const { data: sessions = [], isLoading } = useChatSessions()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const { mutate: deleteSession } = useDeleteChatSession()

  // Fetch a specific session's full history when user clicks it
  const [requestedSessionId, setRequestedSessionId] = useState<string | null>(null)
  const { data: loadedSession } = useChatSession(requestedSessionId)

  useEffect(() => {
    if (loadedSession && requestedSessionId === loadedSession.session.id) {
      loadSession(loadedSession)
      setLoadingId(null)
      setRequestedSessionId(null)
    }
  }, [loadedSession, requestedSessionId, loadSession])

  const grouped = useMemo(() => {
    const ours = sessions.filter(s => s.module === currentModule)
    const other = sessions.filter(s => s.module !== currentModule)
    return { ours, other }
  }, [sessions, currentModule])

  return (
    <div className="w-56 shrink-0 border-r border-[#e8e8ef] bg-gray-50/50 flex flex-col">
      <div className="p-2 border-b border-[#e8e8ef]">
        <Button
          onClick={onNewChat}
          size="sm"
          variant="outline"
          className="w-full h-8 text-xs gap-1.5 border-[#e8e8ef] bg-white hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200"
        >
          <Plus className="w-3.5 h-3.5" />
          New chat
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-6 text-gray-300">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-[11px] text-gray-400 text-center py-6 px-2">
            No chats yet. Start one to see it here.
          </p>
        ) : (
          <>
            {grouped.ours.length > 0 && (
              <SessionGroup
                label={currentModule === 'people' ? 'People' : 'Retention'}
                sessions={grouped.ours}
                activeSessionId={activeSessionId}
                loadingId={loadingId}
                onClick={(s) => {
                  if (s.id === activeSessionId) return
                  setLoadingId(s.id)
                  setRequestedSessionId(s.id)
                }}
                onDelete={(id) => deleteSession(id)}
              />
            )}
            {grouped.other.length > 0 && (
              <SessionGroup
                label={currentModule === 'people' ? 'Retention' : 'People'}
                sessions={grouped.other}
                activeSessionId={activeSessionId}
                loadingId={loadingId}
                onClick={(s) => {
                  setLoadingId(s.id)
                  onSwitchModule(s.module)
                  setRequestedSessionId(s.id)
                }}
                onDelete={(id) => deleteSession(id)}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

function SessionGroup({
  label,
  sessions,
  activeSessionId,
  loadingId,
  onClick,
  onDelete,
}: {
  label: string
  sessions: ChatSession[]
  activeSessionId: string | null
  loadingId: string | null
  onClick: (s: ChatSession) => void
  onDelete: (id: string) => void
}) {
  return (
    <div>
      <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide px-1 mb-1">
        {label}
      </div>
      <div className="space-y-0.5">
        {sessions.map((s) => {
          const isActive = s.id === activeSessionId
          const isLoading = s.id === loadingId
          return (
            <div
              key={s.id}
              className={cn(
                'group flex items-center gap-1 px-2 py-1.5 rounded text-xs cursor-pointer transition-colors',
                isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-white'
              )}
              onClick={() => onClick(s)}
            >
              {isLoading ? (
                <Loader2 className="w-3 h-3 shrink-0 animate-spin text-gray-400" />
              ) : (
                <MessageSquare className="w-3 h-3 shrink-0 text-gray-400" />
              )}
              <span className="flex-1 truncate">{s.title || 'Untitled chat'}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (confirm('Delete this chat?')) onDelete(s.id)
                }}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                aria-label="Delete chat"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
