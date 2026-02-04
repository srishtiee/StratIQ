import { Sidebar } from '@/components/layout/sidebar'
import { TopNav } from '@/components/layout/topnav'
import { AskAIFab } from '@/components/shared/ask-ai-fab'

// Authenticated routes are session-dependent — no static generation.
export const dynamic = 'force-dynamic'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f5f7]">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <TopNav />
        <main className="flex-1 overflow-y-auto p-5">
          {children}
        </main>
      </div>
      <AskAIFab />
    </div>
  )
}
