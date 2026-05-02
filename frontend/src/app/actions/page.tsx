'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import PageHeader from '@/components/PageHeader';
import StatePanel from '@/components/StatePanel';
import { api, type Action, type RunSummary } from '@/lib/api';
import { Clock, CheckCircle2, XCircle, ArrowRight, Sparkles } from 'lucide-react';
import clsx from 'clsx';

const PRIORITY_COLOR: Record<string, string> = {
  critical: 'text-rose-400 bg-rose-500/10',
  high:     'text-amber-400 bg-amber-500/10',
  medium:   'text-blue-400 bg-blue-500/10',
  low:      'text-[#8b9cc5] bg-white/5',
};

export default function ActionsPage() {
  const [actions, setActions] = useState<Action[]>([]);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [actionData, runData] = await Promise.all([
        api.actions(),
        api.insights(4),
      ]);
      setActions(actionData);
      setRuns(runData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load action queue');
    } finally {
      setLoading(false);
    }
  };

  const approve = async (id: string, decision: 'approved' | 'rejected') => {
    await api.approveAction(id, decision);
    await load();
  };

  useEffect(() => {
    let cancelled = false;

    const initialLoad = async () => {
      setLoading(true);
      try {
        const [actionData, runData] = await Promise.all([
          api.actions(),
          api.insights(4),
        ]);
        if (!cancelled) {
          setActions(actionData);
          setRuns(runData);
          setError('');
        }
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load action queue');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void initialLoad();
    return () => {
      cancelled = true;
    };
  }, []);

  const pending = actions.filter(a => a.status === 'pending');
  const done    = actions.filter(a => a.status !== 'pending');
  const approved = actions.filter(a => a.status === 'approved').length;

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-shell-main max-w-5xl">
        <PageHeader
          eyebrow="Action Pipeline"
          title="Approve"
          highlight="Actions"
          description="Every finished analysis can queue follow-up work here. Instead of losing recommendations in a brief, reviewers get a clean approval lane with status, context, and next steps."
          aside={
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#6f82ac]">Pending now</p>
              <p className="mt-1 text-sm font-semibold text-[#f0f4ff]">{loading ? '...' : pending.length}</p>
            </div>
          }
          actions={
            <>
              <button onClick={() => void load()} className="btn-ghost">
                Refresh queue
              </button>
              <Link href="/ask" className="btn-primary">
                Create another brief
              </Link>
            </>
          }
        />

        <div className="mb-8 grid gap-6 md:grid-cols-3">
          {[
            ['Pending approvals', pending.length, 'Awaiting human sign-off'],
            ['Approved actions', approved, 'Ready for downstream execution'],
            ['Recent analyses', runs.length, 'Latest decision runs available'],
          ].map(([label, value, sub]) => (
            <div key={label} className="card card-glow p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7284ad]">{label}</p>
              <p className="mt-2 font-outfit text-3xl font-bold text-[#f0f4ff]">{value}</p>
              <p className="mt-1 text-xs text-[#8b9cc5]">{sub}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="card card-glow p-8 text-center text-sm text-[#4a5a7a] animate-pulse">Loading…</div>
        ) : error ? (
          <StatePanel
            tone="error"
            title="Action queue failed to load"
            body={`${error} This used to look like an empty queue, which was misleading. The page now surfaces the load problem directly.`}
            actions={
              <button onClick={() => void load()} className="btn-primary">
                Retry queue load
              </button>
            }
          />
        ) : actions.length === 0 ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
            <StatePanel
              title="No approval queue yet"
              body="Actions appear here automatically after a successful analysis run. Once Ask StratIQ finishes a brief, the recommended follow-up lands here for review."
              icon={<Sparkles className="h-5 w-5" />}
              actions={
                <>
                  <Link href="/ask" className="btn-primary flex items-center gap-2">
                    Generate a new brief <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link href="/insights" className="btn-ghost">
                    View recent insights
                  </Link>
                </>
              }
            />

            <div className="card p-5">
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7284ad]">Recent Analysis Runs</p>
              <div className="space-y-3">
                {runs.length === 0 ? (
                  <p className="text-sm text-[#8b9cc5]">Run your first Ask flow to start filling the pipeline.</p>
                ) : (
                  runs.map((run) => (
                    <Link
                      key={run.id}
                      href={`/ask?q=${encodeURIComponent(run.question)}`}
                      className="block rounded-2xl border border-[#1e2d45] bg-white/[0.02] p-4 transition-all hover:border-blue-500/30 hover:bg-blue-500/[0.05]"
                    >
                      <p className="text-sm font-medium text-[#f0f4ff]">{run.question}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-[#8b9cc5]">{run.summary ?? 'Completed run'}</p>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Pending */}
            {pending.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-amber-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" /> Pending Approval ({pending.length})
                </p>
                <div className="space-y-3">
                  {pending.map((a, i) => (
                    <div key={a.id} className="card card-glow p-6 animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={clsx('badge', PRIORITY_COLOR[a.priority])}>{a.priority}</span>
                            <span className="text-[10px] text-[#4a5a7a] border border-[#1e2d45] px-2 py-0.5 rounded-full">{a.action_type.replace(/_/g, ' ')}</span>
                          </div>
                          <p className="text-sm font-semibold text-[#f0f4ff] mb-1">{a.title}</p>
                          {a.description && <p className="text-xs text-[#8b9cc5] leading-relaxed">{a.description}</p>}
                          <p className="text-[10px] text-[#4a5a7a] mt-2">{new Date(a.created_at).toLocaleString()}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                          <button onClick={() => approve(a.id, 'rejected')}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 transition-colors">
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </button>
                          <button onClick={() => approve(a.id, 'approved')}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* History */}
            {done.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[#4a5a7a] uppercase tracking-widest mb-3">Actioned ({done.length})</p>
                <div className="card card-glow overflow-hidden">
                  <div className="divide-y divide-[#1e2d45]">
                    {done.map(a => (
                      <div key={a.id} className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.02] transition-colors">
                        {a.status === 'approved' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                          : <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[#f0f4ff] truncate">{a.title}</p>
                          <p className="text-[10px] text-[#4a5a7a]">{new Date(a.updated_at).toLocaleString()}</p>
                        </div>
                        <span className={clsx('badge', a.status === 'approved' ? 'badge-up' : 'badge-down')}>{a.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
