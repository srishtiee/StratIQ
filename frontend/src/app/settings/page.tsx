'use client';
import Sidebar from '@/components/Sidebar';
import PageHeader from '@/components/PageHeader';
import { Settings, ShieldCheck, BrainCircuit, Workflow, BellRing } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-shell-main max-w-4xl">
        <PageHeader
          eyebrow="Workspace"
          title="Project"
          highlight="Settings"
          description="A clearer home for model, approval, governance, and notification controls. These are still placeholders, but the page now reflects the shape of a real product settings area."
          aside={
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#6f82ac]">Config surface</p>
              <p className="mt-1 text-sm font-semibold text-[#f0f4ff]">Ready for productization</p>
            </div>
          }
        />

        <div className="mb-6 grid gap-4 md:grid-cols-2">
          {[
            {
              title: 'Model routing',
              body: 'Choose default provider, fallback policy, and workflow-specific model profiles.',
              icon: <BrainCircuit className="h-4 w-4 text-blue-300" />,
            },
            {
              title: 'Approval rules',
              body: 'Define what should auto-queue, require review, or escalate before execution.',
              icon: <ShieldCheck className="h-4 w-4 text-emerald-300" />,
            },
            {
              title: 'Workflow defaults',
              body: 'Control templates, filters, and KPI packs for churn versus attrition analysis.',
              icon: <Workflow className="h-4 w-4 text-cyan-300" />,
            },
            {
              title: 'Notifications',
              body: 'Route approval alerts and decision summaries to the right executive channels.',
              icon: <BellRing className="h-4 w-4 text-amber-300" />,
            },
          ].map((item) => (
            <div key={item.title} className="card p-5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6f82ac]">{item.title}</p>
                {item.icon}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[#a0b2d7]">{item.body}</p>
            </div>
          ))}
        </div>

        <div className="card card-glow p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3">
              <Settings className="h-5 w-5 text-blue-300" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#f0f4ff]">Configuration Placeholder</h2>
              <p className="text-sm text-[#8b9cc5]">The visual system is ready even though the controls are not wired yet.</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ['Provider policy', 'OpenAI / Anthropic selection and fallback rules'],
              ['Approval thresholds', 'What actions require human sign-off'],
              ['Guardrails', 'Input sanitization and risk policy defaults'],
            ].map(([label, body]) => (
              <div key={label} className="rounded-2xl border border-[#1e2d45] bg-white/[0.03] p-4">
                <p className="text-sm font-semibold text-[#f0f4ff]">{label}</p>
                <p className="mt-2 text-xs leading-relaxed text-[#8b9cc5]">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
