'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useGlobalStore } from '@/lib/store/global-store'
import { Bell, ChevronDown, Calendar, Building2, User, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/lib/auth/store'
import { getSupabaseBrowser } from '@/lib/supabase/browser'

const pageNames: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/people': 'People Intelligence',
  '/retention': 'Customer Retention',
  '/actions': 'Actions Center',
  '/uploads': 'Data Uploads',
  '/settings': 'Settings',
}

export function TopNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { department, setDepartment } = useGlobalStore()
  const auth = useAuth()

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on outside click and on Escape.
  useEffect(() => {
    if (!menuOpen) return
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const pageName = pageNames[pathname] || 'Dashboard'

  async function handleSignOut() {
    setMenuOpen(false)
    const sb = getSupabaseBrowser()
    await sb.auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  return (
    <header className="h-14 border-b border-[#e8e8ef] bg-white flex items-center px-4 gap-4 sticky top-0 z-30">
      <div className="flex items-center gap-2 text-sm min-w-0">
        <span className="text-gray-400 text-xs">StratIQ</span>
        <span className="text-gray-300">/</span>
        <span className="font-semibold text-gray-800">{pageName}</span>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 border border-[#e8e8ef]">
          <Calendar className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Last 30 days</span>
          <ChevronDown className="w-3 h-3" />
        </Button>

        <Select value={department || 'all'} onValueChange={(v) => setDepartment(v === 'all' ? null : v)}>
          <SelectTrigger className="h-8 w-auto text-xs border-[#e8e8ef] bg-gray-50 text-gray-500 hover:text-gray-700 gap-1">
            <Building2 className="w-3.5 h-3.5" />
            <SelectValue placeholder="All Depts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            <SelectItem value="Engineering">Engineering</SelectItem>
            <SelectItem value="Sales">Sales</SelectItem>
            <SelectItem value="Marketing">Marketing</SelectItem>
            <SelectItem value="Product">Product</SelectItem>
            <SelectItem value="Customer Success">Customer Success</SelectItem>
            <SelectItem value="Finance">Finance</SelectItem>
          </SelectContent>
        </Select>

        <button className="relative p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-red-500 ring-1 ring-white" />
        </button>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen(o => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex items-center gap-1.5 p-1 rounded-md hover:bg-gray-100 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <ChevronDown className="w-3 h-3 text-gray-400" />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-1 z-50 w-56 rounded-lg border border-[#e8e8ef] bg-white shadow-lg overflow-hidden"
            >
              <div className="px-3 py-2 border-b border-[#e8e8ef]">
                <p className="text-sm font-medium text-gray-900 truncate">{auth?.name ?? 'Signed in'}</p>
                <p className="text-xs text-gray-500 truncate">{auth?.email ?? ''}</p>
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
