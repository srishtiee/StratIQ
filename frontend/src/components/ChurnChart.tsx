'use client';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts';
import type { KPISnapshot } from '@/lib/api';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmt = (d: string) => { const m = new Date(d).getMonth(); return MONTHS[m]; };

interface TooltipPayloadItem {
  color?: string;
  name?: string;
  value?: number | string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#111827] border border-[#1e2d45] rounded-xl px-4 py-3 shadow-2xl">
      <p className="text-xs text-[#8b9cc5] mb-2">{label}</p>
      {payload.map((p, index) => (
        <p key={p.name} className="text-sm font-semibold" style={{ color: p.color }}>
          {p.name ?? `Series ${index + 1}`}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}
        </p>
      ))}
    </div>
  );
}

interface Props { data: KPISnapshot[]; loading?: boolean; }

export default function ChurnChart({ data, loading }: Props) {
  if (loading) {
    return <div className="card card-glow h-64 animate-pulse flex items-center justify-center">
      <p className="text-[#4a5a7a] text-sm">Loading chart…</p>
    </div>;
  }

  const churnSeries = data
    .filter(s => s.metrics.some(m => m.name === 'churn_rate'))
    .map(s => ({
      date: fmt(s.snapshot_date),
      'Churn Rate': s.metrics.find(m => m.name === 'churn_rate')?.value as number ?? 0,
      'Retention':  s.metrics.find(m => m.name === 'retention_rate')?.value as number ?? 0,
      'MRR at Risk': s.metrics.find(m => m.name === 'mrr_at_risk')?.value as number ?? 0,
    }));

  return (
    <div className="space-y-6">
      {/* Churn trend */}
      <div className="card card-glow p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6f82ac]">Trend Monitor</p>
            <h3 className="mt-1 font-semibold text-sm">Churn & Retention Trends</h3>
            <p className="text-xs text-[#8b9cc5] mt-0.5">12-month rolling view for customer health</p>
          </div>
          <span className="badge bg-blue-500/10 text-blue-400 text-[10px]">LIVE</span>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={churnSeries} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradChurn" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradRetention" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" />
            <XAxis dataKey="date" tick={{ fill: '#8b9cc5', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#8b9cc5', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="Churn Rate" stroke="#f43f5e" strokeWidth={2} fill="url(#gradChurn)" dot={false} />
            <Area type="monotone" dataKey="Retention"  stroke="#10b981" strokeWidth={2} fill="url(#gradRetention)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* MRR at Risk */}
      <div className="card card-glow p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6f82ac]">Revenue Exposure</p>
            <h3 className="mt-1 font-semibold text-sm">MRR at Risk ($k)</h3>
            <p className="text-xs text-[#8b9cc5] mt-0.5">Monthly exposure across the last 12 periods</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={churnSeries} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" />
            <XAxis dataKey="date" tick={{ fill: '#8b9cc5', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#8b9cc5', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="MRR at Risk" radius={[4,4,0,0]}>
              {churnSeries.map((_, idx) => (
                <Cell key={idx} fill={`rgba(245, 158, 11, ${0.4 + (idx / churnSeries.length) * 0.5})`} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
