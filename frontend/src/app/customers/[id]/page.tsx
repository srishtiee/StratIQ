'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { api, type CustomerDetail } from '@/lib/api';
import {
  ArrowLeft, BrainCircuit, AlertTriangle, TrendingDown,
  Activity, MessageSquare, BarChart3, Calendar, Shield,
} from 'lucide-react';
import clsx from 'clsx';

const STATUS_COLOR: Record<string, string> = {
  active:   'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  at_risk:  'text-amber-400  bg-amber-500/10  border-amber-500/20',
  churned:  'text-rose-400   bg-rose-500/10   border-rose-500/20',
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'text-rose-400   bg-rose-500/10',
  high:     'text-amber-400  bg-amber-500/10',
  medium:   'text-blue-400   bg-blue-500/10',
  low:      'text-[#8b9cc5]  bg-white/5',
};

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <div className="card flex items-start gap-3 p-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-2.5 text-[#8fb6ff]">{icon}</div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6f82ac]">{label}</p>
        <p className="mt-1 font-outfit text-lg font-bold text-[#f0f4ff]">{value}</p>
        {sub && <p className="mt-1 text-[11px] text-[#7f91ba]">{sub}</p>}
      </div>
    </div>
  );
}

function SkeletonBlock({ h = 'h-24' }: { h?: string }) {
  return <div className={`card ${h} animate-pulse bg-white/[0.02]`} />;
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    api.customer(id)
      .then((data) => { if (!cancelled) setCustomer(data); })
      .catch((e: Error) => { if (!cancelled) setError(e.message ?? 'Failed to load customer'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const askQ = customer
    ? `What are the top churn risk factors for ${customer.name} and how should we retain them?`
    : '';

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-shell-main max-w-7xl">
        {/* Back */}
        <Link href="/customers"
          className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-[#1e2d45] bg-white/[0.02] px-3 py-1.5 text-xs text-[#7f91ba] transition-colors hover:text-[#d9e4ff]">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Risk Register
        </Link>

        {error && (
          <div className="card card-glow p-6 flex items-center gap-3 text-rose-400">
            <AlertTriangle className="w-5 h-5" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {loading && (
          <div className="space-y-4">
            <SkeletonBlock h="h-32" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1,2,3,4].map(i => <SkeletonBlock key={i} h="h-24" />)}
            </div>
            <SkeletonBlock h="h-48" />
          </div>
        )}

        {!loading && customer && (
          <div className="space-y-6">
            <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
              <div className="hero-panel overflow-hidden">
                <div className="relative z-10 border-b border-[#1e2d45] px-6 py-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7f91ba]">Customer Profile</p>
                      <div className="mb-1 mt-2 flex flex-wrap items-center gap-3">
                        <h1 className="font-outfit text-3xl font-bold tracking-tight">{customer.name}</h1>
                        {customer.subscription_status && (
                          <span className={clsx(
                            'rounded-full border px-2.5 py-1 text-xs font-semibold',
                            STATUS_COLOR[customer.subscription_status] ?? STATUS_COLOR.active
                          )}>
                            {customer.subscription_status === 'at_risk' ? 'At Risk'
                              : customer.subscription_status.charAt(0).toUpperCase() + customer.subscription_status.slice(1)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-[#8b9cc5]">
                        {[customer.tier, customer.industry, customer.region].filter(Boolean).join(' · ')}
                      </p>
                      {customer.account_owner && (
                        <p className="mt-2 text-xs text-[#6e81ad]">Owned by {customer.account_owner}</p>
                      )}
                    </div>
                    <Link
                      href={`/ask?q=${encodeURIComponent(askQ)}`}
                      id="ask-about-customer"
                      className="btn-primary flex items-center gap-2 whitespace-nowrap"
                    >
                      <BrainCircuit className="w-4 h-4" /> Ask StratIQ
                    </Link>
                  </div>
                </div>

                <div className="relative z-10 grid gap-4 px-6 py-5 md:grid-cols-3">
                  <div className="rounded-2xl border border-[#1e2d45] bg-white/[0.02] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6e81ad]">Renewal Probability</p>
                    <p className={clsx('mt-2 font-outfit text-4xl font-bold',
                      (customer.renewal_probability ?? 0) > 60 ? 'text-emerald-300'
                        : (customer.renewal_probability ?? 0) > 30 ? 'text-amber-300' : 'text-rose-300')}>
                      {customer.renewal_probability?.toFixed(0) ?? '—'}%
                    </p>
                    <p className="mt-2 text-xs text-[#8b9cc5]">Latest renewal confidence based on product and support signals.</p>
                  </div>
                  <div className="rounded-2xl border border-[#1e2d45] bg-white/[0.02] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6e81ad]">Revenue Exposure</p>
                    <p className="mt-2 font-outfit text-4xl font-bold text-[#f0f4ff]">
                      {customer.mrr ? `$${customer.mrr.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}
                    </p>
                    <p className="mt-2 text-xs text-[#8b9cc5]">Current monthly recurring revenue tied to this account.</p>
                  </div>
                  <div className="rounded-2xl border border-[#1e2d45] bg-white/[0.02] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6e81ad]">Open Signals</p>
                    <p className="mt-2 font-outfit text-4xl font-bold text-[#f0f4ff]">{customer.recent_signals.length}</p>
                    <p className="mt-2 text-xs text-[#8b9cc5]">Unresolved churn indicators from recent activity.</p>
                  </div>
                </div>

                {customer.renewal_probability !== undefined && (
                  <div className="px-6 pb-6">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6e81ad]">
                        Risk Bar
                      </p>
                      <p className="text-xs text-[#8b9cc5]">
                        {(customer.renewal_probability ?? 0) > 60 ? 'Healthy' : (customer.renewal_probability ?? 0) > 30 ? 'Needs attention' : 'Critical'}
                      </p>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#1e2d45]">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${customer.renewal_probability}%`,
                          background: (customer.renewal_probability ?? 0) > 60
                            ? 'linear-gradient(90deg, #10b981, #34d399)'
                            : (customer.renewal_probability ?? 0) > 30
                            ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                            : 'linear-gradient(90deg, #f43f5e, #fb7185)',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                <StatCard
                  icon={<BarChart3 className="w-4 h-4" />}
                  label="Monthly MRR"
                  value={customer.mrr ? `$${customer.mrr.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}
                  sub={customer.subscription?.plan ? `${customer.subscription.plan} plan` : undefined}
                />
                <StatCard
                  icon={<Activity className="w-4 h-4" />}
                  label="Logins / Period"
                  value={customer.latest_usage?.logins_count ?? '—'}
                  sub={customer.latest_usage ? `${customer.latest_usage.period_start} → ${customer.latest_usage.period_end}` : undefined}
                />
                <StatCard
                  icon={<MessageSquare className="w-4 h-4" />}
                  label="Support Tickets"
                  value={customer.latest_usage?.support_tickets ?? '—'}
                />
                <StatCard
                  icon={<TrendingDown className="w-4 h-4" />}
                  label="NPS Score"
                  value={customer.latest_usage?.nps_score != null
                    ? Number(customer.latest_usage.nps_score).toFixed(1) : '—'}
                />
              </div>
            </section>

            <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
              {/* Churn signals */}
              <div className="card card-glow overflow-hidden">
                <div className="flex items-center gap-2 border-b border-[#1e2d45] px-5 py-4">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <p className="text-sm font-semibold">
                    Risk Timeline
                    {customer.recent_signals.length > 0 && (
                      <span className="ml-2 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-400">
                        {customer.recent_signals.length}
                      </span>
                    )}
                  </p>
                </div>
                {customer.recent_signals.length === 0 ? (
                  <div className="p-8 text-center">
                    <Shield className="mx-auto mb-2 h-6 w-6 text-emerald-400" />
                    <p className="text-xs text-[#8b9cc5]">No open churn signals</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#1e2d45]">
                    {customer.recent_signals.map((sig, i) => (
                      <div key={i} className="flex items-start gap-3 px-5 py-4">
                        <span className={clsx(
                          'mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap',
                          SEVERITY_COLOR[sig.severity] ?? SEVERITY_COLOR.medium
                        )}>
                          {sig.severity}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-[#f0f4ff]">
                            {sig.signal_type.replace(/_/g, ' ')}
                          </p>
                          {sig.notes && (
                            <p className="mt-1 text-xs leading-relaxed text-[#8b9cc5]">{sig.notes}</p>
                          )}
                          <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-[#4a5a7a]">
                            {new Date(sig.detected_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-6">
                {/* Subscription details */}
                <div className="card card-glow overflow-hidden">
                  <div className="flex items-center gap-2 border-b border-[#1e2d45] px-5 py-4">
                    <Calendar className="w-4 h-4 text-blue-400" />
                    <p className="text-sm font-semibold">Subscription Details</p>
                  </div>
                  {!customer.subscription ? (
                    <div className="p-8 text-center text-xs text-[#8b9cc5]">No subscription data</div>
                  ) : (
                    <div className="p-5 space-y-3">
                      {[
                        { label: 'Plan',            value: customer.subscription.plan },
                        { label: 'MRR',             value: `$${customer.subscription.mrr.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
                        { label: 'Contract Start',  value: customer.subscription.contract_start },
                        { label: 'Contract End',    value: customer.subscription.contract_end },
                        { label: 'Renewal Prob.',   value: `${customer.subscription.renewal_probability?.toFixed(0)}%` },
                        { label: 'Status',          value: customer.subscription.status },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex items-center justify-between border-b border-[#1e2d45] py-1.5 last:border-0">
                          <p className="text-xs text-[#4a5a7a]">{label}</p>
                          <p className="text-xs font-medium text-[#f0f4ff]">{value ?? '—'}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Usage metrics */}
                {customer.latest_usage && (
                  <div className="card card-glow p-5">
                    <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6e81ad]">
                      Latest Usage Period
                    </p>
                    <p className="mb-4 text-sm text-[#8b9cc5]">
                      {customer.latest_usage.period_start} → {customer.latest_usage.period_end}
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {[
                        { label: 'Logins',           value: customer.latest_usage.logins_count },
                        { label: 'API Calls',        value: customer.latest_usage.api_calls.toLocaleString() },
                        { label: 'Support Tickets',  value: customer.latest_usage.support_tickets },
                        { label: 'NPS Score',        value: customer.latest_usage.nps_score != null ? Number(customer.latest_usage.nps_score).toFixed(1) : '—' },
                      ].map(({ label, value }) => (
                        <div key={label} className="rounded-2xl border border-[#1e2d45] bg-white/[0.02] p-4">
                          <p className="font-outfit text-3xl font-bold text-[#f0f4ff]">{value}</p>
                          <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[#4a5a7a]">{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
