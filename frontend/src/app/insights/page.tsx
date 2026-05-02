'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import PageHeader from '@/components/PageHeader';
import StatePanel from '@/components/StatePanel';
import { api, type RunSummary } from '@/lib/api';
import { History, CheckCircle2, XCircle, Clock, ArrowRight } from 'lucide-react';
import clsx from 'clsx';

const STATUS_ICON = {
  complete: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
  failed:   <XCircle className="w-4 h-4 text-rose-400" />,
  running:  <Clock className="w-4 h-4 text-amber-400" />,
};

export default function InsightsPage() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.insights(30);
      setRuns(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load analysis history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const initialLoad = async () => {
      try {
        const data = await api.insights(30);
        if (!cancelled) setRuns(data);
        if (!cancelled) setError('');
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load analysis history');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void initialLoad();
    return () => {
      cancelled = true;
    };
  }, []);

  const completeCount = runs.filter((run) => run.status === 'complete').length;
  const failedCount = runs.filter((run) => run.status === 'failed').length;

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-shell-main max-w-5xl">
        <PageHeader
          eyebrow="Decision History"
          title="Strategic"
          highlight="Insights"
          description="Review what the system already analyzed, revisit the reasoning, and jump back into high-value questions without hunting through old chats or notes."
          aside={
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#6f82ac]">Completed runs</p>
              <p className="mt-1 text-sm font-semibold text-[#f0f4ff]">{loading ? '...' : completeCount}</p>
            </div>
          }
          actions={
            <>
              <button onClick={() => void load()} className="btn-ghost">
                Refresh history
              </button>
              <Link href="/ask" className="btn-primary">
                Ask a new question
              </Link>
            </>
          }
        />

        <div className="mb-8 grid gap-4 md:grid-cols-3">
          {[
            ['Total runs', runs.length, 'All recorded Ask flows'],
            ['Completed', completeCount, 'Decision briefs generated'],
            ['Failed', failedCount, 'Runs that need attention'],
          ].map(([label, value, sub]) => (
            <div key={label} className="card card-glow p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7284ad]">{label}</p>
              <p className="mt-2 font-outfit text-3xl font-bold text-[#f0f4ff]">{value}</p>
              <p className="mt-1 text-xs text-[#8b9cc5]">{sub}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="card card-glow p-8 text-center text-sm text-[#4a5a7a] animate-pulse">Loading history…</div>
        ) : error ? (
          <StatePanel
            tone="error"
            title="Insights could not be loaded"
            body={`${error} Earlier this looked like “no insights,” which was the wrong signal. The page now shows the actual load failure so it is easier to trust.`}
            actions={
              <button onClick={() => void load()} className="btn-primary">
                Retry history load
              </button>
            }
          />
        ) : runs.length === 0 ? (
          <StatePanel
            title="No analysis runs yet"
            body="Start in Ask StratIQ to generate your first brief. Once a run completes, it will appear here with its question, summary, and follow-up path."
            icon={<History className="h-5 w-5" />}
            actions={
              <Link href="/ask" className="btn-primary">
                Open Ask StratIQ
              </Link>
            }
          />
        ) : (
          <div className="grid gap-4">
            {runs.map((run, i) => (
              <div
                key={run.id}
                className="card card-glow animate-fade-up p-5"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <span className="mt-0.5">{STATUS_ICON[run.status as keyof typeof STATUS_ICON] ?? STATUS_ICON.running}</span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={clsx('badge', run.status === 'complete' ? 'badge-up' : run.status === 'failed' ? 'badge-down' : 'badge-stable')}>
                          {run.status}
                        </span>
                        <span className="rounded-full border border-[#1e2d45] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-[#7284ad]">
                          {run.workflow}
                        </span>
                      </div>
                      <p className="mt-3 text-base font-semibold text-[#f0f4ff]">{run.question}</p>
                      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[#8b9cc5]">
                        {run.summary ?? 'This run did not produce a final summary.'}
                      </p>
                      <p className="mt-3 text-[11px] text-[#7284ad]">
                        {new Date(run.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/ask?q=${encodeURIComponent(run.question)}`}
                      className="btn-ghost flex items-center gap-2"
                    >
                      Re-run question <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link href="/actions" className="btn-primary">
                      Open queue
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
