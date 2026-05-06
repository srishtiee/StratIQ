"use client";

import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import type {
  ActionResult,
  ApprovalStatus,
  WorkflowResponse, WorkflowRunSummary,
} from "@shared/contracts";
import { ActionCard } from "@/components/action-card";
import { EvidencePanel } from "@/components/evidence-panel";
import { LaneSection } from "@/components/lane-section";
import { StatePanel } from "@/components/state-panel";
import { executeAction, getCustomerById, getLatestWorkflow, listWorkflows, streamAsk, submitAsk, submitFeedback } from "@/lib/service";

function makeDefaultPrompt(customerName?: string) {
  const subject = customerName ?? "the selected customer";
  return `Assess ${subject}'s churn risk and prepare a governed retention action that can be reviewed by leadership this week and adopted within an existing enterprise renewal workflow.`;
}

export default function WorkflowPage() {
  const searchParams = useSearchParams();
  const customerId = searchParams.get("customer");
  const [prompt, setPrompt] = useState(() => makeDefaultPrompt());
  const [workflow, setWorkflow] = useState<WorkflowResponse | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [feedbackNote, setFeedbackNote] = useState("");
  const [lastFeedback, setLastFeedback] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<"overview" | "strategy" | "risk" | "evidence" | "audit">(
    "overview",
  );
  const [isPromptExpanded, setIsPromptExpanded] = useState(true);
  const [streamEvents, setStreamEvents] = useState<{agent: string, message: string}[]>([]);
  const [history, setHistory] = useState<WorkflowRunSummary[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;

    startTransition(async () => {
      const latestWorkflow = await getLatestWorkflow(customerId ?? undefined);
      const recentHistory = await listWorkflows(customerId ?? undefined);
      if (active) setHistory(recentHistory);
      if (!active) {
        return;
      }

      if (!latestWorkflow) {
        setWorkflow(null);
        setResult(null);
        setLastFeedback(null);
        setIsPromptExpanded(true);
        if (customerId) {
          const customer = await getCustomerById(customerId);
          if (active) setPrompt(makeDefaultPrompt(customer?.name));
        }
        return;
      }

      setWorkflow(latestWorkflow);
      setPrompt(latestWorkflow.requestSummary);
      setResult(latestWorkflow.actionHistory[0] ?? null);
      setLastFeedback(null);
      setActivePanel("overview");
      setIsPromptExpanded(false);
    });

    return () => {
      active = false;
    };
  }, [customerId]);

  const handleAction = (decision: "approve" | "mark_ready" | "reject" | "execute") => {
    if (!workflow) {
      return;
    }

    startTransition(async () => {
      const action = await executeAction({
        approvalId: workflow.approval.id,
        decision,
      });
      setResult(action);

      const statusMap: Record<typeof decision, ApprovalStatus> = {
        approve: "Approved",
        mark_ready: "Ready",
        reject: "Rejected",
        execute: "Executed",
      };

      setWorkflow({
        ...workflow,
        approval: {
          ...workflow.approval,
          status: statusMap[decision],
        },
        actionHistory: [action, ...workflow.actionHistory],
        auditRecords: [
          {
            id: `audit-local-${Date.now()}`,
            runId: workflow.requestId,
            approvalId: workflow.approval.id,
            eventType: decision === "execute" ? "action" : "approval",
            actor: "Operator",
            message: action.summary,
            createdAt: action.executedAt ?? new Date().toISOString(),
          },
          ...workflow.auditRecords,
        ],
      });
    });
  };


  const handleSubmit = () => {
    startTransition(async () => {
      setWorkflow(null);
      setResult(null);
      setLastFeedback(null);
      setActivePanel("overview");
      setIsPromptExpanded(false);
      setStreamEvents([]);
      
      try {
        const response = await streamAsk(
          { prompt, focusCustomerId: customerId ?? undefined },
          (event) => {
             setStreamEvents(prev => [...prev, { agent: event.agent, message: event.message }]);
          }
        );
        setWorkflow(response);
        const recentHistory = await listWorkflows(customerId ?? undefined);
        setHistory(recentHistory);
      } catch (err) {
        console.error(err);
      }
    });
  };

  const handleFeedback = (verdict: "approve" | "revise") => {
    if (!workflow) {
      return;
    }

    startTransition(async () => {
      const payload = await submitFeedback({
        requestId: workflow.requestId,
        verdict,
        note: feedbackNote || "Feedback captured from workflow lane.",
      });
      setWorkflow({
        ...workflow,
        status: verdict === "approve" ? "approved" : "needs_review",
        auditRecords: [
          {
            id: `audit-feedback-${Date.now()}`,
            runId: workflow.requestId,
            eventType: "feedback",
            actor: "Operator",
            message: `Feedback recorded with verdict '${verdict}'.`,
            createdAt: payload.recordedAt,
          },
          ...workflow.auditRecords,
        ],
      });
      setLastFeedback(`${payload.verdict.toUpperCase()}: ${payload.note}`);
    });
  };

  const selectedStrategy = workflow
    ? workflow.plannerOutput.strategies.find(
        (strategy) => strategy.id === workflow.arbiterDecision.selectedStrategyId,
      ) ?? workflow.plannerOutput.strategies[0]
    : null;

  return (
    <div className="page-stack">
      <section className="hero-card workflow-hero">
        <div>
          <span className="eyebrow">Operational workflow</span>
          <h2 className="hero-title workflow-hero__title">Bounded churn decision workspace</h2>
          <p className="hero-copy">
            Review the ask, pressure-test the recommendation, and approve the next action without leaving the executive workflow.
          </p>
        </div>

        <div className="hero-meta workflow-hero__meta">
          <article className="meta-stat">
            <span>Target</span>
            <strong>{workflow?.targetEntity.name ?? "Not selected"}</strong>
          </article>
          <article className="meta-stat">
            <span>Workflow state</span>
            <strong>{workflow?.status ?? "Ready"}</strong>
          </article>
          <article className="meta-stat">
            <span>Primary action</span>
            <strong>{selectedStrategy?.title ?? "Pending package"}</strong>
          </article>
          <article className="meta-stat">
            <span>Approval</span>
            <strong>{workflow?.approval.status ?? "Not created"}</strong>
          </article>
        </div>
      </section>

      <div className="lane-grid workflow-lane-grid">
        <LaneSection
          title="Ask"
          status={workflow ? "reviewing" : "ready"}
          className="workflow-lane workflow-lane--sticky"
        >
          <div className="workflow-form">
            {workflow && !isPromptExpanded ? (
              <>
                <div className="workflow-prompt-summary">
                  <span className="muted-copy">Current executive request</span>
                  <p>{prompt}</p>
                </div>
                <div className="button-row button-row--compact">
                  <button
                    className="button-primary"
                    type="button"
                    onClick={handleSubmit}
                    disabled={isPending}
                  >
                    {isPending ? "Running workflow..." : "Rerun package"}
                  </button>
                  <button
                    className="button-secondary"
                    type="button"
                    onClick={() => setIsPromptExpanded(true)}
                  >
                    Edit request
                  </button>
                </div>
                <p className="muted-copy workflow-prompt-note">
                    The prompt can be edited and resubmitted to rerun the workflow with the same customer and update the existing package.
                </p>
              </>
            ) : (
              <>
                <label htmlFor="workflow-prompt" className="muted-copy">
                  Executive request
                </label>
                <textarea
                  id="workflow-prompt"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                />
                <div className="button-row">
                  <button className="button-primary" type="button" onClick={handleSubmit} disabled={isPending}>
                    {isPending ? "Running workflow..." : "Generate decision package"}
                  </button>
                  <button
                    className="button-secondary"
                    type="button"
                    onClick={() => {
                      setPrompt(makeDefaultPrompt(workflow?.targetEntity.name));
                      if (workflow) {
                        setIsPromptExpanded(false);
                      }
                    }}
                  >
                    {workflow ? "Collapse form" : "Reset prompt"}
                  </button>
                </div>
                <p className="muted-copy workflow-prompt-note">
                  Contracts mirror `POST /api/ask` so the UI can later swap from mock orchestration to an enterprise service without a layout rewrite.
                </p>
              </>
            )}
{isPending ? (
              <div className="stream-events-container" style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                 {streamEvents.map((evt, i) => (
                    <div key={i} className="stream-event" style={{ padding: "0.75rem", background: "var(--surface-sunken)", borderRadius: "var(--radius-sm)", borderLeft: "3px solid var(--accent-primary)", animation: "fadeIn 0.3s ease-out" }}>
                       <strong style={{ display: "block", fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>{evt.agent}</strong>
                       <span style={{ fontSize: "0.95rem" }}>{evt.message}</span>
                    </div>
                 ))}
                 <StatePanel
                   title="Generating workflow package"
                   message="StratIQ is collecting evidence, drafting the recommendation set, and preparing the approval package."
                   tone="loading"
                 />
              </div>
            ) : null}
          </div>
        </LaneSection>

        <LaneSection
          title="Plan / Debate"
          status={workflow ? workflow.status : "ready"}
          className="workflow-lane workflow-lane--primary"
        >
          {workflow ? (
            <>
              <div className="workflow-panel__header">
                <div className="empty-state">
                  <strong>Request summary</strong>
                  <p style={{ marginTop: "0.4rem" }}>{workflow.requestSummary}</p>
                </div>

                <div className="workflow-tabs" role="tablist" aria-label="Workflow reasoning panels">
                  <button
                    className={`workflow-tab${activePanel === "overview" ? " is-active" : ""}`}
                    type="button"
                    onClick={() => setActivePanel("overview")}
                  >
                    Overview
                  </button>
                  <button
                    className={`workflow-tab${activePanel === "strategy" ? " is-active" : ""}`}
                    type="button"
                    onClick={() => setActivePanel("strategy")}
                  >
                    Strategy
                  </button>
                  <button
                    className={`workflow-tab${activePanel === "risk" ? " is-active" : ""}`}
                    type="button"
                    onClick={() => setActivePanel("risk")}
                  >
                    Critique
                  </button>
                  <button
                    className={`workflow-tab${activePanel === "evidence" ? " is-active" : ""}`}
                    type="button"
                    onClick={() => setActivePanel("evidence")}
                  >
                    Evidence
                  </button>
                  <button
                    className={`workflow-tab${activePanel === "audit" ? " is-active" : ""}`}
                    type="button"
                    onClick={() => setActivePanel("audit")}
                  >
                    Audit
                  </button>
                </div>
              </div>

              <div className="workflow-panel-scroll">
                {activePanel === "overview" ? (
                  <div className="agent-list">
                    <article className="agent-item">
                      <div className="lane-card__title" style={{ marginBottom: "0.5rem" }}>
                        <h3 style={{ fontSize: "1rem" }}>Evidence review</h3>
                        <span className="eyebrow">Analyst + Researcher</span>
                      </div>
                      <p>{workflow.summary}</p>
                      <p className="muted-copy" style={{ marginTop: "0.45rem" }}>
                        {workflow.targetEntity.name} is the current target entity for this bounded churn workflow.
                      </p>
                    </article>

                    <article className="agent-item">
                      <div className="lane-card__title" style={{ marginBottom: "0.5rem" }}>
                        <h3 style={{ fontSize: "1rem" }}>{workflow.arbiterDecision.agent}</h3>
                        <span className="eyebrow">{workflow.arbiterDecision.confidenceLabel}</span>
                      </div>
                      <p>{workflow.arbiterDecision.finalRecommendation}</p>
                      <p className="muted-copy" style={{ marginTop: "0.45rem" }}>
                        {workflow.arbiterDecision.rationale}
                      </p>
                    </article>
                  </div>
                ) : null}

                {activePanel === "strategy" ? (
                  <article className="agent-item">
                    <div className="lane-card__title" style={{ marginBottom: "0.5rem" }}>
                      <h3 style={{ fontSize: "1rem" }}>{workflow.plannerOutput.agent}</h3>
                      <span className="eyebrow">{workflow.plannerOutput.strategies.length} strategy paths</span>
                    </div>
                    <p>{workflow.plannerOutput.summary}</p>
                    <div className="highlight-list" style={{ marginTop: "0.8rem" }}>
                      {workflow.plannerOutput.strategies.map((strategy) => (
                        <div key={strategy.id} className="highlight-item">
                          <strong>{strategy.title}</strong>
                          <p className="muted-copy" style={{ marginTop: "0.35rem" }}>
                            {strategy.description}
                          </p>
                          <p className="muted-copy" style={{ marginTop: "0.35rem" }}>
                            Owner: {strategy.owner} | Impact: {strategy.expectedImpact} | Window:{" "}
                            {strategy.deliveryWindow}
                          </p>
                        </div>
                      ))}
                    </div>
                  </article>
                ) : null}

                {activePanel === "risk" ? (
                  <article className="agent-item">
                    <div className="lane-card__title" style={{ marginBottom: "0.5rem" }}>
                      <h3 style={{ fontSize: "1rem" }}>{workflow.riskReview.agent}</h3>
                      <span className="eyebrow">{workflow.riskReview.verdict}</span>
                    </div>
                    <p>{workflow.riskReview.critique}</p>
                    <div className="driver-list" style={{ marginTop: "0.8rem" }}>
                      {workflow.riskReview.concerns.map((concern) => (
                        <div key={concern} className="driver-item">
                          {concern}
                        </div>
                      ))}
                      {workflow.riskReview.requiredChecks.map((check) => (
                        <div key={check} className="driver-item">
                          Required check: {check}
                        </div>
                      ))}
                    </div>
                  </article>
                ) : null}

                {activePanel === "evidence" ? <EvidencePanel evidence={workflow.evidence} /> : null}

                {activePanel === "audit" ? (
                  <div className="surface-card workflow-audit-card">
                    <div className="section-header">
                      <div>
                        <h3>Audit trail</h3>
                        <p>Each bounded workflow step is logged so the decision package can be reviewed later.</p>
                      </div>
                    </div>
                    <div className="audit-list">
                      {workflow.auditRecords.map((record) => (
                        <article key={record.id} className="audit-item">
                          <div className="audit-item__meta">
                            <strong>{record.eventType.replace("_", " ")}</strong>
                            <span>{new Date(record.createdAt).toLocaleString()}</span>
                          </div>
                          <p>{record.message}</p>
                          <p className="muted-copy">Actor: {record.actor}</p>
                        </article>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="feedback-form">
                <textarea
                  aria-label="Feedback note"
                  value={feedbackNote}
                  onChange={(event) => setFeedbackNote(event.target.value)}
                  placeholder="Leave an operator note that could be handed to leadership, RevOps, or Customer Success."
                />
                <div className="button-row">
                  <button className="button-secondary" type="button" onClick={() => handleFeedback("revise")}>
                    Request revision
                  </button>
                  <button className="button-primary" type="button" onClick={() => handleFeedback("approve")}>
                    Record approval note
                  </button>
                </div>
                {lastFeedback ? (
                  <StatePanel
                    title="Feedback recorded"
                    message={lastFeedback}
                  />
                ) : null}
              </div>
            </>
          ) : (
            <StatePanel
              title="Decision workspace is empty"
              message="Submit an ask to populate the evidence, strategy, critique, arbiter judgment, and approval package."
            />
          )}
        </LaneSection>

        <LaneSection
          title="Approve / Execute"
          status={workflow ? workflow.approval.status : "ready"}
          className="workflow-lane workflow-lane--sticky"
        >
          {workflow ? (
            <>
              <ActionCard approval={workflow.approval} result={result} className="approval-card--workflow">
                <div className="button-row">
                  <button className="button-secondary" type="button" onClick={() => handleAction("mark_ready")}>
                    Mark ready
                  </button>
                  <button className="button-secondary" type="button" onClick={() => handleAction("reject")}>
                    Reject
                  </button>
                  <button className="button-primary" type="button" onClick={() => handleAction("approve")}>
                    Approve
                  </button>
                  <button className="button-primary" type="button" onClick={() => handleAction("execute")}>
                    Execute log
                  </button>
                </div>
              </ActionCard>
              <div className="workflow-side-notes">
                <div className="button-row button-row--compact">
                  <LinkToApprovals />
                </div>
                <div className="workflow-compact-note">
                  <strong>Execution boundary</strong>
                  <p>
                    Phase 1 logs the governed decision and action handoff. CRM, pricing, and ticketing automation stay out of band for this base demo.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <StatePanel
              title="No action package yet"
              message="Approval cards appear after the workflow has produced a recommendation package."
            />
          )}
        </LaneSection>
      </div>
    </div>
  );
}

function LinkToApprovals() {
  return (
    <a className="button-secondary" href="/approvals">
      Open approval queue
    </a>
  );
}
