'use client';
import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import PageHeader from '@/components/PageHeader';
import StatePanel from '@/components/StatePanel';
import { ShieldCheck, Search, RefreshCw, Database, ScanSearch } from 'lucide-react';
import clsx from 'clsx';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

interface AuditLog {
  id: string;
  event_type: string;
  entity_type?: string;
  entity_id?: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

const EVENT_COLORS: Record<string, string> = {
  ask:           'text-blue-400   bg-blue-500/10   border-blue-500/20',
  action_create: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  approved:      'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  rejected:      'text-rose-400   bg-rose-500/10   border-rose-500/20',
  deferred:      'text-amber-400  bg-amber-500/10  border-amber-500/20',
};

function SkeletonRow() {
  return (
    <tr className="border-t border-[#1e2d45]">
      {[1,2,3,4].map(i => (
        <td key={i} className="px-4 py-3">
          <div className="h-3 rounded-full bg-[#1e2d45] animate-pulse" style={{ width: `${40 + i * 12}%` }} />
        </td>
      ))}
    </tr>
  );
}

export default function AuditPage() {
  const [logs, setLogs]     = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API}/api/audit?limit=100`);
      if (!response.ok) throw new Error(response.statusText);
      const data: AuditLog[] = await response.json();
      setLogs(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const initialLoad = async () => {
      try {
        const response = await fetch(`${API}/api/audit?limit=100`);
        if (!response.ok) throw new Error(response.statusText);
        const data: AuditLog[] = await response.json();
        if (!cancelled) {
          setLogs(data);
          setError('');
        }
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load audit log');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void initialLoad();
    return () => {
      cancelled = true;
    };
  }, []);

  const eventTypes = ['all', ...Array.from(new Set(logs.map(l => l.event_type)))];

  const filtered = logs.filter(l => {
    const matchFilter = filter === 'all' || l.event_type === filter;
    const matchSearch = !search || JSON.stringify(l).toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-shell-main">
        <PageHeader
          eyebrow="Governance"
          title="Audit"
          highlight="Log"
          description="An immutable stream of asks, approvals, rejections, and system-level events. Use it to understand what happened, when it happened, and who initiated it."
          aside={
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#6f82ac]">Events loaded</p>
                <p className="mt-1 text-sm font-semibold text-[#f0f4ff]">{loading ? '...' : logs.length}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#6f82ac]">Visible rows</p>
                <p className="mt-1 text-sm font-semibold text-[#f0f4ff]">{loading ? '...' : filtered.length}</p>
              </div>
            </div>
          }
          actions={
            <button onClick={() => void load()} id="audit-refresh" className="btn-ghost flex items-center gap-2">
              <RefreshCw className={clsx('w-3.5 h-3.5', loading && 'animate-spin')} />
              Refresh log
            </button>
          }
        />

        <div className="mb-6 grid gap-4 lg:grid-cols-3">
          {[
            {
              label: 'Immutable trail',
              value: 'Append-only events',
              body: 'Operational decisions and approvals remain reviewable after execution.',
              icon: <Database className="h-4 w-4 text-cyan-300" />,
            },
            {
              label: 'Quick filtering',
              value: 'Search + event slices',
              body: 'Find specific asks, actions, and approval decisions without leaving the page.',
              icon: <ScanSearch className="h-4 w-4 text-blue-300" />,
            },
            {
              label: 'Compliance posture',
              value: 'Reviewer-friendly history',
              body: 'A clearer presentation for governance reviews and advisor demos.',
              icon: <ShieldCheck className="h-4 w-4 text-emerald-300" />,
            },
          ].map((item) => (
            <div key={item.label} className="card p-5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6f82ac]">{item.label}</p>
                {item.icon}
              </div>
              <p className="mt-3 font-outfit text-2xl font-bold text-[#f0f4ff]">{item.value}</p>
              <p className="mt-2 text-sm leading-relaxed text-[#8fa2ca]">{item.body}</p>
            </div>
          ))}
        </div>

        {error ? (
          <StatePanel
            tone="error"
            title="Audit log could not be loaded"
            body={error}
            actions={
              <button onClick={() => void load()} className="btn-primary">
                Retry audit load
              </button>
            }
          />
        ) : (
        <div className="card card-glow overflow-hidden">
          {/* Toolbar */}
          <div className="px-5 py-4 border-b border-[#1e2d45] flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#7b8fb8]" />
              <span className="text-sm font-semibold text-[#f0f4ff]">{filtered.length} visible events</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Search */}
              <div className="relative w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#4a5a7a]" />
                <input
                  id="audit-search"
                  type="text"
                  placeholder="Search…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="input-field w-full py-2 pl-9 text-xs sm:w-48"
                />
              </div>
              {/* Event type filter */}
              <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1">
                {eventTypes.map(t => (
                  <button
                    key={t}
                    id={`filter-${t}`}
                    onClick={() => setFilter(t)}
                    className={clsx(
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150',
                      filter === t ? 'bg-blue-600 text-white' : 'text-[#8b9cc5] hover:text-[#f0f4ff]',
                    )}
                  >
                    {t === 'all' ? 'All' : t.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1e2d45]">
                  {['Timestamp', 'Event', 'Entity', 'Details'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[#4a5a7a]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)
                  : filtered.length === 0
                  ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-12 text-center text-sm text-[#4a5a7a]">
                        No audit events yet. Run an analysis or create an action to start logging.
                      </td>
                    </tr>
                  )
                  : filtered.map((log, i) => (
                    <tr
                      key={log.id}
                      className="border-t border-[#1e2d45] hover:bg-white/[0.02] transition-colors animate-fade-up"
                      style={{ animationDelay: `${i * 20}ms` }}
                    >
                      <td className="px-4 py-3 text-[10px] text-[#4a5a7a] whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx(
                          'text-[10px] font-semibold px-2.5 py-1 rounded-full border',
                          EVENT_COLORS[log.event_type] ?? 'text-[#8b9cc5] bg-white/5 border-[#1e2d45]',
                        )}>
                          {log.event_type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {log.entity_type && (
                          <p className="text-xs text-[#8b9cc5]">
                            <span className="text-[#4a5a7a]">{log.entity_type}</span>
                          </p>
                        )}
                        {log.entity_id && (
                          <p className="text-[10px] text-[#4a5a7a] font-mono mt-0.5 truncate max-w-[120px]">
                            {log.entity_id}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {Object.entries(log.metadata ?? {}).slice(0, 2).map(([k, v]) => (
                          <p key={k} className="text-[10px] text-[#8b9cc5]">
                            <span className="text-[#4a5a7a]">{k}:</span>{' '}
                            {typeof v === 'string' ? v.slice(0, 60) + (v.length > 60 ? '…' : '') : String(v)}
                          </p>
                        ))}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </main>
    </div>
  );
}
