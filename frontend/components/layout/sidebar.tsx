'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useGlobalStore } from '@/lib/store/global-store'
import {
  LayoutDashboard, Users, HeartPulse, BarChart3,
  Zap, Upload, Settings, ChevronLeft, ChevronRight
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'

type SubItem = { tab: string; label: string }
type NavItemDef = {
  href: string
  icon: React.ElementType
  label: string
  subItems?: SubItem[]
}

const navItems: NavItemDef[] = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  {
    href: '/people',
    icon: Users,
    label: 'People Intelligence',
    subItems: [
      { tab: 'overview', label: 'Overview' },
      { tab: 'risk', label: 'Risk Analysis' },
      { tab: 'compensation', label: 'Compensation' },
    ],
  },
  {
    href: '/retention',
    icon: HeartPulse,
    label: 'Customer Retention',
    subItems: [
      { tab: 'overview', label: 'Overview' },
      { tab: 'at-risk', label: 'At-Risk Accounts' },
      { tab: 'health', label: 'Health Trends' },
    ],
  },
]

const bottomNavItems: NavItemDef[] = [
  { href: '/actions', icon: Zap, label: 'Actions Center' },
]

const utilNavItems: NavItemDef[] = [
  { href: '/uploads', icon: Upload, label: 'Data Uploads' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

export function Sidebar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab')
  const { sidebarCollapsed, toggleSidebar, pendingActionsCount } = useGlobalStore()

  return (
    <div
      className={cn(
        'flex flex-col h-screen sticky top-0 transition-all duration-300 bg-white border-r border-[#e8e8ef] shrink-0',
        sidebarCollapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-[#e8e8ef]">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-indigo-500 flex items-center justify-center">
              <BarChart3 className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-sm text-gray-800">StratIQ</span>
          </div>
        )}
        {sidebarCollapsed && (
          <div className="w-6 h-6 rounded-md bg-indigo-500 flex items-center justify-center mx-auto">
            <BarChart3 className="w-3.5 h-3.5 text-white" />
          </div>
        )}
        {!sidebarCollapsed && (
          <button
            onClick={toggleSidebar}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Collapse toggle when collapsed */}
      {sidebarCollapsed && (
        <button
          onClick={toggleSidebar}
          className="mt-2 mx-auto p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <NavItem
            key={item.href}
            item={item}
            pathname={pathname}
            activeTab={activeTab}
            collapsed={sidebarCollapsed}
          />
        ))}

        <div className="my-3 border-t border-[#e8e8ef]" />

        {bottomNavItems.map((item) => (
          <NavItem
            key={item.href}
            item={item}
            pathname={pathname}
            activeTab={activeTab}
            collapsed={sidebarCollapsed}
            badge={item.href === '/actions' ? pendingActionsCount : undefined}
          />
        ))}

        <div className="my-3 border-t border-[#e8e8ef]" />

        {utilNavItems.map((item) => (
          <NavItem
            key={item.href}
            item={item}
            pathname={pathname}
            activeTab={activeTab}
            collapsed={sidebarCollapsed}
          />
        ))}
      </nav>

      {/* User section */}
      <div className="px-2 pb-3 border-t border-[#e8e8ef] pt-3">
        <div className={cn(
          'flex items-center gap-2 px-2 py-2 rounded-md',
          sidebarCollapsed ? 'justify-center' : ''
        )}>
          <div className="w-7 h-7 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center shrink-0">
            <span className="text-xs font-medium text-indigo-600">SC</span>
          </div>
          {!sidebarCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-800 truncate">Srishti Bankar</p>
              <p className="text-[10px] text-gray-400 truncate">CEO</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function NavItem({
  item,
  pathname,
  activeTab,
  collapsed,
  badge,
}: {
  item: NavItemDef
  pathname: string
  activeTab: string | null
  collapsed: boolean
  badge?: number
}) {
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
  const Icon = item.icon
  const showSubItems = isActive && !collapsed && item.subItems && item.subItems.length > 0

  return (
    <div>
      <Link
        href={item.href}
        className={cn(
          'flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-all duration-150',
          'relative group',
          isActive
            ? 'bg-indigo-50 text-indigo-600 border-l-2 border-indigo-500 pl-[9px]'
            : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50 border-l-2 border-transparent',
          collapsed ? 'justify-center px-2' : ''
        )}
      >
        <Icon className={cn('shrink-0', isActive ? 'text-indigo-500' : 'text-gray-400 group-hover:text-gray-600', 'w-4 h-4')} />
        {!collapsed && (
          <span className="flex-1 truncate">{item.label}</span>
        )}
        {!collapsed && badge !== undefined && badge > 0 && (
          <Badge className="bg-amber-100 text-amber-700 border border-amber-200 text-[10px] px-1.5 py-0 h-4 min-w-4">
            {badge}
          </Badge>
        )}
        {collapsed && badge !== undefined && badge > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500 ring-1 ring-white" />
        )}
      </Link>

      {showSubItems && (
        <div className="mt-0.5 mb-1 ml-7 space-y-0.5 border-l border-[#e8e8ef] pl-2">
          {item.subItems!.map((sub, idx) => {
            const isFirstAndNoTab = idx === 0 && !activeTab
            const isSubActive = activeTab === sub.tab || isFirstAndNoTab
            return (
              <Link
                key={sub.tab}
                href={`${item.href}?tab=${sub.tab}`}
                className={cn(
                  'block px-2 py-1 rounded text-xs transition-colors',
                  isSubActive
                    ? 'text-indigo-600 font-medium'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                )}
              >
                {sub.label}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
