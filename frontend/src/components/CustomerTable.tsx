'use client';
import { useState } from 'react';
import { Search } from 'lucide-react';
import type { Customer } from '@/lib/api';
import clsx from 'clsx';

import { useRouter } from 'next/navigation';

interface Props { customers: Customer[]; loading?: boolean; }

const statusColor: Record<string, string> = {
  active: 'text-emerald-400', at_risk: 'text-amber-400', churned: 'text-rose-400',
};
const statusDot: Record<string, string> = {
  active: 'dot-active', at_risk: 'dot-at_risk', churned: 'dot-churned',
};

function SkeletonRow() {
  return (
    <tr className="border-t border-[#1e2d45]">
      {[1,2,3,4,5].map(i => (
        <td key={i} className="px-4 py-4">
          <div className="h-3 rounded-full bg-[#1e2d45] animate-pulse" style={{ width: `${50 + i * 10}%` }} />
        </td>
      ))}
    </tr>
  );
}

export default function CustomerTable({ customers, loading }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('all');

  const filtered = customers.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || c.subscription_status === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div className="card card-glow min-w-0 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-[#1e2d45] p-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6f82ac]">Live Register</p>
          <h3 className="mt-1 font-semibold text-base text-[#f0f4ff]">Customer Risk Register</h3>
          <p className="mt-1 text-xs text-[#8b9cc5]">{filtered.length} customers matched to the current view</p>
        </div>
        <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:w-auto xl:flex-nowrap">
          <div className="relative min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#4a5a7a]" />
            <input
              type="text" placeholder="Search…" value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-field w-full py-2 pl-9 text-xs sm:w-48"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-white/5 p-1.5">
            {['all','active','at_risk','churned'].map(s => (
              <button key={s} onClick={() => setFilter(s)}
                className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150',
                  filter === s ? 'bg-blue-600 text-white' : 'text-[#8b9cc5] hover:text-[#f0f4ff]')}>
                {s === 'all' ? 'All' : s === 'at_risk' ? 'At Risk' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[680px]">
          <thead>
            <tr className="border-b border-[#1e2d45]">
              {['Customer', 'Tier', 'Status', 'Renewal Prob.', 'MRR', 'Signals'].map((h, i) => (
                <th key={h} className={clsx("px-4 py-4 text-[10px] font-semibold uppercase tracking-wider text-[#4a5a7a]", i === 4 ? "text-right" : "text-left")}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              : filtered.map(c => (
                <tr key={c.id} onClick={() => router.push(`/customers/${c.id}`)} className="border-t border-[#1e2d45] hover:bg-white/[0.02] transition-colors group cursor-pointer">
                  <td className="px-4 py-4">
                    <p className="text-sm font-medium text-[#f0f4ff] group-hover:text-blue-400 transition-colors">{c.name}</p>
                    <p className="text-[10px] text-[#4a5a7a]">{c.region}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-xs px-2 py-0.5 rounded-full border border-[#1e2d45] text-[#8b9cc5]">
                      {c.tier ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', statusDot[c.subscription_status ?? 'active'])} />
                      <span className={clsx('text-xs font-medium', statusColor[c.subscription_status ?? 'active'])}>
                        {c.subscription_status === 'at_risk' ? 'At Risk' : c.subscription_status ?? '—'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 max-w-[80px] h-1.5 rounded-full bg-[#1e2d45] overflow-hidden">
                        <div className="h-full rounded-full"
                          style={{
                            width: `${c.renewal_probability ?? 0}%`,
                            background: (c.renewal_probability ?? 0) > 60 ? '#10b981' : (c.renewal_probability ?? 0) > 30 ? '#f59e0b' : '#f43f5e',
                          }} />
                      </div>
                      <span className="text-xs text-[#8b9cc5]">{c.renewal_probability?.toFixed(0) ?? '—'}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm font-medium text-[#f0f4ff] text-right">
                    {c.mrr ? `$${c.mrr.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}
                  </td>
                  <td className="px-4 py-4">
                    {c.churn_signal_count > 0 ? (
                      <span className="badge badge-down">{c.churn_signal_count} signal{c.churn_signal_count > 1 ? 's' : ''}</span>
                    ) : (
                      <span className="text-xs text-[#4a5a7a]">—</span>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {!loading && filtered.length === 0 && (
          <div className="border-t border-[#1e2d45] px-6 py-10 text-center">
            <p className="text-sm font-medium text-[#f0f4ff]">No customers match this filter</p>
            <p className="mt-1 text-xs text-[#8b9cc5]">Try clearing the search term or switching back to another status bucket.</p>
          </div>
        )}
      </div>
    </div>
  );
}
