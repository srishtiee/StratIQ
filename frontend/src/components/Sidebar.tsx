'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, BrainCircuit, CheckSquare,
  History, ShieldCheck, Bell, Settings, Zap,
} from 'lucide-react';
import clsx from 'clsx';

const NAV = [
  { href: '/',          icon: LayoutDashboard, label: 'Dashboard'  },
  { href: '/ask',       icon: BrainCircuit,    label: 'Ask StratIQ' },
  { href: '/customers', icon: Users,            label: 'Customers'  },
  { href: '/actions',   icon: CheckSquare,      label: 'Actions'    },
  { href: '/insights',  icon: History,          label: 'Insights'   },
  { href: '/audit',     icon: ShieldCheck,      label: 'Audit'      },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <>
      <div className="sticky top-0 z-40 border-b border-[#1e2d45] bg-[#0d1120]/95 backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-3 px-4 py-4">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-outfit text-lg font-bold tracking-tight text-gradient">StratIQ</span>
        </div>
        <nav className="flex gap-2 overflow-x-auto px-3 pb-3">
          {NAV.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className={clsx('nav-link whitespace-nowrap', pathname === href && 'active')}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          ))}
        </nav>
      </div>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[17.5rem] flex-col border-r border-[#1e2d45] bg-[#0d1120]/92 backdrop-blur-xl lg:flex">
        <div className="border-b border-[#1e2d45] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl flex items-center justify-center shadow-[0_10px_30px_rgba(59,130,246,0.2)]" style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="block font-outfit text-lg tracking-tight">
                <span className="text-gradient font-bold">StratIQ</span>
              </span>
              <p className="text-[10px] uppercase tracking-[0.24em] text-[#5e739d]">Executive Ops Console</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-5 rounded-[1.25rem] border border-[#1e2d45] bg-white/[0.02] px-4 py-4">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#6c7fa8]">System Status</p>
            <p className="mt-2 text-sm font-semibold text-[#f0f4ff]">Monitoring churn and retention risk</p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Live data connected
            </div>
          </div>

          <nav className="space-y-1">
            <p className="px-3 pb-2 text-[10px] uppercase tracking-widest font-semibold text-[#4a5a7a]">Platform</p>
            {NAV.map(({ href, icon: Icon, label }) => (
              <Link key={href} href={href} className={clsx('nav-link', pathname === href && 'active')}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-auto border-t border-[#1e2d45] bg-[#0b1020]/88 p-4 pb-20">
          <Link href="/settings" className="nav-link mb-3">
            <Settings className="w-4 h-4" /> Settings
          </Link>
          <div className="rounded-[1.25rem] border border-[#1e2d45] bg-white/[0.03] p-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold">S</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#f0f4ff] truncate">Sarah Chen</p>
                <p className="text-[11px] text-[#6b7ea8]">Approver</p>
              </div>
              <div className="rounded-full border border-[#1e2d45] bg-white/[0.03] p-2">
                <Bell className="w-3.5 h-3.5 text-[#7183ad]" />
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
