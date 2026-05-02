'use client';
import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import KPICards from '@/components/KPICards';
import ChurnChart from '@/components/ChurnChart';
import CustomerTable from '@/components/CustomerTable';
import PageHeader from '@/components/PageHeader';
import StatePanel from '@/components/StatePanel';
import { api, type KPISnapshot, type Customer, type KPIItem } from '@/lib/api';
import { RefreshCw, TrendingDown, BrainCircuit, Activity, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export default function Dashboard() {
  const [kpiSnapshots, setKpiSnapshots] = useState<KPISnapshot[]>([]);
  const [latestKpis, setLatestKpis] = useState<KPIItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshed, setRefreshed] = useState(new Date());

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [snaps, custs] = await Promise.all([
        api.kpis(12),
        api.customers(undefined, undefined, 50),
      ]);
      setKpiSnapshots(snaps);
      setLatestKpis(snaps[snaps.length - 1]?.metrics ?? []);
      setCustomers(custs);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshed(new Date());
    }
  };

  useEffect(() => {
    let cancelled = false;

    const initialLoad = async () => {
      try {
        const [snaps, custs] = await Promise.all([
          api.kpis(12),
          api.customers(undefined, undefined, 50),
        ]);
        if (cancelled) return;
        setKpiSnapshots(snaps);
        setLatestKpis(snaps[snaps.length - 1]?.metrics ?? []);
        setCustomers(custs);
        setError('');
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshed(new Date());
        }
      }
    };

    void initialLoad();
    return () => {
      cancelled = true;
    };
  }, []);

  const atRisk = customers.filter(c => c.subscription_status === 'at_risk').length;

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-shell-main">
        <PageHeader
          eyebrow="Executive Dashboard"
          title="Customer Churn"
          highlight="Intelligence"
          description="A live operating view for renewal risk, revenue exposure, and intervention opportunities. Start from signals, then move straight into an AI-generated retention brief."
          alertBanner={
            !loading && !error && atRisk > 3 ? (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/5 animate-fade-up">
                <TrendingDown className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <p className="text-sm text-amber-300">
                  <strong>{atRisk} customers</strong> are at risk of churning.{' '}
                  <Link href="/ask" className="underline underline-offset-2 hover:text-amber-200">Ask StratIQ for a retention strategy →</Link>
                </p>
              </div>
            ) : undefined
          }
          aside={
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#6f82ac]">Last refresh</p>
                <p className="mt-1 text-sm font-semibold text-[#f0f4ff]">
                  {refreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#6f82ac]">At-risk accounts</p>
                <p className="mt-1 text-sm font-semibold text-[#f0f4ff]">{loading ? '...' : atRisk}</p>
              </div>
            </div>
          }
          actions={
            <>
              <button onClick={load} className="btn-ghost flex items-center gap-2">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <Link href="/ask" className="btn-primary flex items-center gap-2">
                <BrainCircuit className="w-4 h-4" />
                Ask StratIQ
              </Link>
            </>
          }
        />

        {error && (
          <div className="mb-6">
            <StatePanel
              tone="error"
              title="Dashboard data could not be loaded"
              body={error}
              actions={
                <button onClick={load} className="btn-primary">
                  Retry load
                </button>
              }
            />
          </div>
        )}



        <section className="mb-6 grid gap-4 xl:grid-cols-3">
          {[
            {
              label: 'Immediate focus',
              value: loading ? 'Loading...' : `${atRisk} at-risk accounts`,
              detail: 'Best starting point for retention planning this week.',
              icon: <TrendingDown className="h-4 w-4 text-amber-300" />,
            },
            {
              label: 'Coverage',
              value: loading ? 'Loading...' : `${customers.length} tracked customers`,
              detail: 'Live register for customer health, renewal, and support signals.',
              icon: <ShieldCheck className="h-4 w-4 text-blue-300" />,
            },
            {
              label: 'AI workflow',
              value: 'Ask -> Decide -> Approve',
              detail: 'Use Ask StratIQ for an executive brief, then route next steps to Actions.',
              icon: <Activity className="h-4 w-4 text-emerald-300" />,
            },
          ].map((item) => (
            <div key={item.label} className="card p-5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6f82ac]">{item.label}</p>
                {item.icon}
              </div>
              <p className="mt-3 font-outfit text-2xl font-bold text-[#f0f4ff]">{item.value}</p>
              <p className="mt-2 text-sm leading-relaxed text-[#8fa2ca]">{item.detail}</p>
            </div>
          ))}
        </section>

        {/* KPI grid */}
        <section className="mb-8 min-w-0">
          <KPICards kpis={latestKpis} loading={loading} />
        </section>

        {/* Charts + Table */}
        <div className="mb-8 grid min-w-0 grid-cols-1 gap-6 2xl:grid-cols-5">
          <div className="min-w-0 2xl:col-span-2">
            <ChurnChart data={kpiSnapshots} loading={loading} />
          </div>
          <div className="min-w-0 2xl:col-span-3">
            <CustomerTable customers={customers} loading={loading} />
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            { label: 'Analyze Churn Drivers', q: 'What are the top drivers of customer churn this quarter?', icon: '🔍' },
            { label: 'Retention Strategy',    q: 'Recommend a retention strategy for our at-risk enterprise customers.', icon: '🎯' },
            { label: 'Revenue Impact',        q: 'What is the projected revenue impact if we reduce churn by 5%?', icon: '📈' },
          ].map(({ label, q, icon }) => (
            <Link key={label} href={`/ask?q=${encodeURIComponent(q)}`}
              className="card p-4 hover:border-blue-500/40 transition-all duration-200 group">
              <span className="text-2xl mb-3 block">{icon}</span>
              <p className="text-sm font-semibold text-[#f0f4ff] group-hover:text-blue-400 transition-colors">{label}</p>
              <p className="text-xs text-[#4a5a7a] mt-1 line-clamp-2">{q}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
