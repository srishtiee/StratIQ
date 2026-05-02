'use client';
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { api, type AskResponse, type ReasoningStep, type ActionCreate } from '@/lib/api';
import {
  BrainCircuit, Send, ChevronDown, ChevronUp,
  CheckCircle2, AlertTriangle, BookOpen, Zap, Target,
  TrendingUp, PlusCircle, X, CheckSquare, ArrowRight,
} from 'lucide-react';
import clsx from 'clsx';

// ─── Agent pipeline display ───────────────────────────────────────────────────

const AGENT_CONFIG: Record<string, { toneClass: string; icon: string; label: string }> = {
  analyst:    { toneClass: 'text-blue-400',    icon: '📊', label: 'Analyst'     },
  researcher: { toneClass: 'text-cyan-400',    icon: '🔍', label: 'Researcher'  },
  planner:    { toneClass: 'text-purple-400',  icon: '🎯', label: 'Planner'     },
  risk:       { toneClass: 'text-amber-400',   icon: '⚠️', label: 'Risk Review' },
  arbiter:    { toneClass: 'text-emerald-400', icon: '⚖️', label: 'Arbiter'     },
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function AgentStep({ step, active, done, delay }: {
  step: ReasoningStep; active: boolean; done: boolean; delay: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = AGENT_CONFIG[step.agent] ?? { toneClass: 'text-blue-400', icon: '🤖', label: step.agent };
  return (
    <div
      className={clsx('card p-4 transition-all duration-500 animate-fade-up', done ? 'opacity-100' : 'opacity-40')}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => done && setExpanded(v => !v)}>
        <span className="text-lg">{cfg.icon}</span>
        <div className="flex-1 min-w-0">
          <p className={clsx('text-xs font-semibold', done ? cfg.toneClass : 'text-[#4a5a7a]')}>
            {step.label}
          </p>
          {active && !done && (
            <div className="flex items-center gap-1 mt-1">
              {[0, 1, 2].map(i => (
                <span key={i} className="w-1 h-1 rounded-full bg-blue-400 animate-pulse-glow"
                  style={{ animationDelay: `${i * 150}ms` }} />
              ))}
              <span className="text-[10px] text-[#4a5a7a] ml-1">Processing…</span>
            </div>
          )}
        </div>
        {done && (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            {step.content && (expanded
              ? <ChevronUp className="w-3 h-3 text-[#4a5a7a]" />
              : <ChevronDown className="w-3 h-3 text-[#4a5a7a]" />)}
          </div>
        )}
      </div>
      {done && expanded && step.content && (
        <p className="mt-3 text-xs text-[#8b9cc5] leading-relaxed border-t border-[#1e2d45] pt-3">
          {step.content}
        </p>
      )}
    </div>
  );
}

// ─── Create Action Modal ──────────────────────────────────────────────────────

interface CreateActionModalProps {
  runId: string;
  defaultTitle: string;
  onClose: () => void;
  onSuccess: () => void;
}

function CreateActionModal({ runId, defaultTitle, onClose, onSuccess }: CreateActionModalProps) {
  const [title, setTitle]           = useState(defaultTitle.slice(0, 200));
  const [description, setDesc]      = useState('');
  const [actionType, setActionType] = useState<ActionCreate['action_type']>('retention_outreach');
  const [priority, setPriority]     = useState<ActionCreate['priority']>('high');
  const [saving, setSaving]         = useState(false);
  const [err, setErr]               = useState('');

  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    setErr('');
    try {
      await api.createAction({
        run_id: runId,
        action_type: actionType,
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        target_entity: {},
      });
      onSuccess();
    } catch (error: unknown) {
      setErr(getErrorMessage(error, 'Failed to create action'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="card card-glow w-full max-w-md p-6 animate-fade-up">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-blue-400" />
            <h2 className="font-semibold text-sm">Create Action</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/5 transition-colors">
            <X className="w-4 h-4 text-[#4a5a7a]" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-[10px] font-semibold text-[#4a5a7a] uppercase tracking-widest mb-1.5">
              Action Title
            </label>
            <input
              id="action-title"
              className="input-field w-full text-sm"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={200}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] font-semibold text-[#4a5a7a] uppercase tracking-widest mb-1.5">
              Description (optional)
            </label>
            <textarea
              id="action-description"
              className="input-field w-full text-sm resize-none"
              rows={3}
              value={description}
              onChange={e => setDesc(e.target.value)}
              placeholder="Additional context for the approver…"
            />
          </div>

          {/* Type + Priority row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-[#4a5a7a] uppercase tracking-widest mb-1.5">
                Type
              </label>
              <select
                id="action-type"
                className="input-field w-full text-sm"
                value={actionType}
                onChange={e => setActionType(e.target.value as ActionCreate['action_type'])}
              >
                <option value="retention_outreach">Retention Outreach</option>
                <option value="strategy_brief">Strategy Brief</option>
                <option value="segment_flag">Segment Flag</option>
                <option value="internal_rec">Internal Rec</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-[#4a5a7a] uppercase tracking-widest mb-1.5">
                Priority
              </label>
              <select
                id="action-priority"
                className="input-field w-full text-sm"
                value={priority}
                onChange={e => setPriority(e.target.value as ActionCreate['priority'])}
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          {err && (
            <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 px-3 py-2 rounded-lg">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> {err}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button onClick={onClose} className="btn-ghost text-sm">Cancel</button>
            <button
              id="action-submit"
              onClick={save}
              disabled={!title.trim() || saving}
              className={clsx('btn-primary flex items-center gap-2 text-sm',
                (!title.trim() || saving) && 'opacity-50 cursor-not-allowed')}
            >
              {saving
                ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
                : <><CheckSquare className="w-3.5 h-3.5" /> Create Action</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Ask page ────────────────────────────────────────────────────────────

function AskContent() {
  const params = useSearchParams();
  const [question, setQuestion]     = useState(params.get('q') ?? '');
  const [result, setResult]         = useState<AskResponse | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [activeStep, setActiveStep] = useState(-1);
  const [liveReasoning, setLiveReasoning] = useState<ReasoningStep[]>([]);
  const [showModal, setShowModal]   = useState(false);
  const [actionCreated, setActionCreated] = useState(false);

  const STEP_LABELS: ReasoningStep[] = [
    { agent: 'analyst',    label: 'Structured Data Retrieval', content: '' },
    { agent: 'researcher', label: 'Evidence Retrieval',         content: '' },
    { agent: 'planner',    label: 'Strategy Generation',        content: '' },
    { agent: 'risk',       label: 'Risk & Compliance Critique', content: '' },
    { agent: 'arbiter',    label: 'Final Ruling',               content: '' },
  ];

  const submit = async () => {
    if (!question.trim() || loading) return;
    setLoading(true);
    setResult(null);
    setError('');
    setActiveStep(0);
    setLiveReasoning([]);
    setActionCreated(false);
    
    try {
      await api.askStream({ question, workflow: 'churn', filters: {} }, (eventName, data) => {
        if (eventName === 'step_start') {
          setActiveStep(data.step);
        } else if (eventName === 'step_done') {
          setLiveReasoning(prev => {
            const next = [...prev];
            next[data.step] = { agent: data.agent, label: STEP_LABELS[data.step].label, content: data.summary };
            return next;
          });
        } else if (eventName === 'complete') {
          setActiveStep(5);
          setResult(data as AskResponse);
        } else if (eventName === 'error') {
          setError(data.message);
          setActiveStep(-1);
        }
      });
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Something went wrong. Make sure your API keys are set.'));
      setActiveStep(-1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="app-shell-main">
      <section className="mb-8 grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.7fr)]">
        <div className="hero-panel overflow-hidden">
          <div className="relative z-10 border-b border-[#1e2d45] px-6 py-6">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7f91ba]">
              Bounded Adversarial Reasoning
            </p>
            <h1 className="font-outfit text-3xl font-bold tracking-tight sm:text-4xl">
              Ask <span className="text-gradient">StratIQ</span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#9fb0d8]">
              Turn churn questions into a concise executive brief, evidence trail, and a queued action for follow-up.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {['Executive brief', 'Evidence-backed', 'Action queue ready'].map((chip) => (
                <span key={chip} className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-medium text-[#d4e2ff]">
                  {chip}
                </span>
              ))}
            </div>
          </div>
          <div className="relative z-10 grid gap-4 px-6 py-5 md:grid-cols-3">
            {[
              ['Evidence-backed', 'Every response is grounded in KPIs and retrieved signals.'],
              ['Decision-ready', 'You get a recommendation, risks, and monitoring KPIs in one pass.'],
              ['Actionable', 'Successful runs now create a pending action automatically.'],
            ].map(([title, body]) => (
              <div key={title} className="rounded-[1.25rem] border border-white/10 bg-white/[0.05] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <p className="text-sm font-semibold text-[#f0f4ff]">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-[#7f91ba]">{body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7f91ba]">Prompt Starters</p>
          <p className="mt-2 text-sm leading-relaxed text-[#8fa2ca]">
            Start with a decision-oriented question, not just a metric lookup.
          </p>
          <div className="mt-4 space-y-3">
            {[
              'Which signals are most strongly correlated with churn in enterprise accounts?',
              'Where should customer success intervene first this week?',
              'How much revenue is exposed if our at-risk cohort converts to churn?',
            ].map(prompt => (
              <button
                key={prompt}
                onClick={() => setQuestion(prompt)}
                className="group flex w-full items-center justify-between rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3.5 text-left text-sm text-[#9fb0d8] transition-all hover:border-blue-500/40 hover:bg-blue-500/[0.06] hover:text-[#f0f4ff]"
              >
                <span className="flex-1 pr-4">{prompt}</span>
                <ArrowRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Input card */}
      <div className="card card-glow mb-6 overflow-hidden">
        <div className="border-b border-[#1e2d45] px-6 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7f91ba]">Question Composer</p>
          <p className="mt-1 text-sm text-[#8fa2ca]">Ask for the decision you need, the risk behind it, and the action you want recommended.</p>
        </div>
        <div className="p-6">
        <div className="flex items-start gap-3">
          <BrainCircuit className="w-5 h-5 text-blue-400 flex-shrink-0 mt-3" />
          <textarea
            rows={3}
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) submit(); }}
            placeholder="e.g. What are the top drivers of churn in our enterprise segment?"
            className="input-field flex-1 resize-none min-h-[80px]"
          />
        </div>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {[
              'Top churn drivers this quarter?',
              'Recommend retention strategy for at-risk accounts',
              'Revenue impact of 5% churn reduction?',
            ].map(s => (
              <button key={s} onClick={() => setQuestion(s)}
                className="rounded-full border border-[#1e2d45] px-3 py-1.5 text-xs text-[#8b9cc5] transition-all hover:border-blue-500/40 hover:text-[#f0f4ff]">
                {s}
              </button>
            ))}
          </div>
          <button
            id="ask-submit"
            onClick={submit}
            disabled={!question.trim() || loading}
            className={clsx(
              'btn-primary flex w-full items-center justify-center gap-2 lg:w-auto lg:min-w-[140px]',
              (!question.trim() || loading) && 'opacity-50 cursor-not-allowed',
            )}
          >
            {loading
              ? <span className="flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Thinking…
                </span>
              : <><Send className="w-4 h-4" /> Analyze</>}
          </button>
        </div>
        {error && (
          <div className="mt-3 flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 px-3 py-2 rounded-lg">
            <AlertTriangle className="w-3.5 h-3.5" /> {error}
          </div>
        )}
        </div>
      </div>

      {/* Pipeline + Results */}
      {(loading || result) && (
        <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-5">
          {/* Left: reasoning pipeline */}
          <div className="min-w-0 space-y-3 xl:col-span-2">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#4a5a7a]">
              Reasoning Pipeline
            </p>
            {STEP_LABELS.map((s, i) => (
              <AgentStep
                key={s.agent}
                step={result?.reasoning?.[i] ?? liveReasoning[i] ?? s}
                active={i === activeStep}
                done={!!result || !!liveReasoning[i]}
                delay={i * 80}
              />
            ))}
          </div>

          {/* Right: decision brief */}
          {result && (
            <div className="min-w-0 space-y-4 xl:col-span-3">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#4a5a7a]">
                Decision Brief
              </p>

              {/* Headline */}
              <div className="card card-glow overflow-hidden" style={{ borderColor: 'rgba(59,130,246,0.2)' }}>
                <div className="border-b border-[#1e2d45] bg-[linear-gradient(135deg,rgba(59,130,246,0.12),rgba(16,185,129,0.06))] px-5 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7f91ba]">Recommended Strategy</p>
                </div>
                <div className="flex items-start gap-3 p-5">
                  <Zap className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h2 className="mb-2 font-outfit text-xl font-bold">{result.decision_card.headline}</h2>
                    <p className="text-sm text-[#8b9cc5] leading-relaxed">{result.decision_card.rationale}</p>
                  </div>
                </div>
              </div>

              {/* Recommended action + Create Action button */}
              <div className="card p-4" style={{ borderColor: 'rgba(16,185,129,0.2)' }}>
                <div className="flex items-start gap-3">
                  <Target className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="mb-1 text-xs font-semibold text-emerald-400">Recommended Action</p>
                    <p className="mb-4 text-sm leading-relaxed text-[#f0f4ff]">{result.decision_card.action_suggestion}</p>
                    <div className="flex flex-wrap items-center gap-3">
                      {(result.action_status === 'pending' || actionCreated) && (
                        <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Action queued for approval
                        </div>
                      )}
                      <Link
                        href="/actions"
                        className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-300 transition-all hover:border-blue-400/40 hover:bg-blue-500/20"
                      >
                        View queue
                      </Link>
                      <button
                        id="create-action-btn"
                        onClick={() => setShowModal(true)}
                        className="flex items-center gap-1.5 rounded-full border border-[#1e2d45] px-3 py-1.5 text-xs font-medium text-[#8b9cc5] transition-all hover:border-blue-500/30 hover:text-[#f0f4ff]"
                      >
                        <PlusCircle className="w-3.5 h-3.5" /> Add custom action
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {result.kpis.length > 0 && (
                <div className="grid gap-3 md:grid-cols-3">
                  {result.kpis.slice(0, 3).map((kpi) => (
                    <div key={kpi.name} className="card p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6e81ad]">
                        {kpi.name.replace(/_/g, ' ')}
                      </p>
                      <p className="mt-2 font-outfit text-2xl font-bold text-[#f0f4ff]">
                        {String(kpi.value)}
                        {kpi.unit && <span className="ml-1 text-sm font-medium text-[#8b9cc5]">{kpi.unit}</span>}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Key Risks */}
              {result.decision_card.main_risks.length > 0 && (
                <div className="card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <p className="text-xs font-semibold text-amber-400">Key Risks</p>
                  </div>
                  <ul className="space-y-2">
                    {result.decision_card.main_risks.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-[#8b9cc5]">
                        <span className="w-1 h-1 rounded-full bg-amber-400 flex-shrink-0 mt-1.5" />{r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Evidence */}
              {result.evidence.length > 0 && (
                <div className="card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="w-4 h-4 text-purple-400" />
                    <p className="text-xs font-semibold text-purple-400">Supporting Evidence</p>
                  </div>
                  <div className="space-y-3">
                    {result.evidence.slice(0, 3).map((e, i) => (
                      <div key={i} className="rounded-2xl border border-[#1e2d45] bg-white/[0.02] p-4">
                        <p className="text-[10px] font-semibold text-[#4a5a7a] mb-1">{e.source_title}</p>
                        <p className="text-xs text-[#8b9cc5] leading-relaxed">{e.snippet}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* KPIs to monitor */}
              {result.decision_card.kpis_to_monitor.length > 0 && (
                <div className="card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-cyan-400" />
                    <p className="text-xs font-semibold text-cyan-400">KPIs to Monitor</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {result.decision_card.kpis_to_monitor.map((k, i) => (
                      <span key={i}
                        className="text-xs px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Create Action modal */}
      {showModal && result && (
        <CreateActionModal
          runId={result.run_id}
          defaultTitle={result.decision_card.action_suggestion}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); setActionCreated(true); }}
        />
      )}
    </main>
  );
}

export default function AskPage() {
  return (
    <div className="app-shell">
      <Sidebar />
      <Suspense fallback={<main className="px-4 py-6 text-sm text-[#4a5a7a] sm:px-6 lg:px-8">Loading…</main>}>
        <AskContent />
      </Suspense>
    </div>
  );
}
