"use client";

import { useState, useTransition } from "react";
import type { ActionResult, WorkflowResponse } from "@shared/contracts";
import { ActionCard } from "@/components/action-card";
import { EvidencePanel } from "@/components/evidence-panel";
import { LaneSection } from "@/components/lane-section";
import { executeAction, submitAsk, submitFeedback } from "@/lib/service";

const defaultPrompt =
  "Assess Northstar Fiber's churn risk and prepare a governed retention action that can be reviewed by leadership this week and adopted within an existing enterprise renewal workflow.";

export default function WorkflowPage() {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [workflow, setWorkflow] = useState<WorkflowResponse | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [feedbackNote, setFeedbackNote] = useState("");
  const [lastFeedback, setLastFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    startTransition(async () => {
      const response = await submitAsk({ prompt, focusCustomerId: "c-102" });
      setWorkflow(response);
      setResult(null);
      setLastFeedback(null);
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
      setLastFeedback(`${payload.verdict.toUpperCase()}: ${payload.note}`);
    });
  };

  const handleApprove = () => {
    if (!workflow) {
      return;
    }

    startTransition(async () => {
      const action = await executeAction(workflow.approval.id);
      setResult(action);
    });
  };

  return (
    <div className="page-stack">
      <section className="hero-card">
        <div>
          <span className="eyebrow">Operational workflow</span>
          <h2 className="hero-title">Move from signal to approved action without breaking enterprise process.</h2>
          <p className="hero-copy">
            This flow is designed for real operators: intake, evidence review, recommendation synthesis, and approval capture all happen in one governed interface that can sit on top of an enterprise stack.
          </p>
        </div>

        <div className="hero-meta">
          <article className="meta-stat">
            <span>Workflow fit</span>
            <strong>Ops-ready</strong>
          </article>
          <article className="meta-stat">
            <span>API alignment</span>
            <strong>Stable</strong>
          </article>
          <article className="meta-stat">
            <span>Approval safety</span>
            <strong>Governed</strong>
          </article>
          <article className="meta-stat">
            <span>Execution</span>
            <strong>Controlled handoff</strong>
          </article>
        </div>
      </section>

      <section className="proof-grid">
        <article className="proof-card">
          <span className="proof-card__label">Step 1</span>
          <strong>Capture the business question in operational language</strong>
          <p>Leaders ask for a decision, not just a model score, so the interface starts with a workflow-ready request.</p>
        </article>
        <article className="proof-card">
          <span className="proof-card__label">Step 2</span>
          <strong>Review evidence before acting</strong>
          <p>The debate lane exposes the rationale, confidence, and source signals so teams can trust the recommendation.</p>
        </article>
        <article className="proof-card">
          <span className="proof-card__label">Step 3</span>
          <strong>Approve with accountability</strong>
          <p>The action package includes owner, expected impact, and audit posture before it enters downstream systems.</p>
        </article>
      </section>

      <div className="lane-grid">
        <LaneSection title="Ask" status={workflow ? "reviewing" : "ready"}>
          <div className="workflow-form">
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
                onClick={() => setPrompt(defaultPrompt)}
              >
                Reset prompt
              </button>
            </div>
            <p className="muted-copy">
              Contracts mirror `POST /api/ask` so the UI can later swap from mock orchestration to an enterprise service without a layout rewrite.
            </p>
          </div>
        </LaneSection>

        <LaneSection title="Plan / Debate" status={workflow ? workflow.status : "ready"}>
          {workflow ? (
            <>
              <div className="empty-state">
                <strong>Request summary</strong>
                <p style={{ marginTop: "0.4rem" }}>{workflow.requestSummary}</p>
              </div>
              <div className="agent-list">
                {workflow.messages.map((message) => (
                  <article key={message.id} className="agent-item">
                    <div className="lane-card__title" style={{ marginBottom: "0.5rem" }}>
                      <h3 style={{ fontSize: "1rem" }}>{message.agent}</h3>
                      <span className="eyebrow">{Math.round(message.confidence * 100)}% confidence</span>
                    </div>
                    <p>{message.summary}</p>
                    <p className="muted-copy" style={{ marginTop: "0.45rem" }}>
                      {message.recommendation}
                    </p>
                  </article>
                ))}
              </div>
              <EvidencePanel evidence={workflow.evidence} />
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
                {lastFeedback ? <div className="empty-state">{lastFeedback}</div> : null}
              </div>
            </>
          ) : (
            <div className="empty-state">
              Submit an ask to populate the evidence panel, reasoning cards, and decision proposal.
            </div>
          )}
        </LaneSection>

        <LaneSection title="Approve / Execute" status={workflow ? "approved" : "ready"}>
          {workflow ? (
            <>
              <ActionCard approval={workflow.approval} result={result} />
              <div className="button-row">
                <button className="button-primary" type="button" onClick={handleApprove}>
                  Capture approval
                </button>
              </div>
              <div className="empty-state">
                Audit note: Phase 1 stops at governed confirmation. The approval is recorded, but no downstream CRM, ticketing, or messaging side effect fires yet.
              </div>
            </>
          ) : (
            <div className="empty-state">
              Approval cards appear after the workflow has produced a recommendation package.
            </div>
          )}
        </LaneSection>
      </div>

      <section className="adoption-grid">
        <article className="surface-card">
          <div className="section-header">
            <div>
              <h3>How this fits existing enterprise workflows</h3>
              <p>Investors and buyers will care less about the model alone and more about whether teams can adopt this with low operational disruption.</p>
            </div>
          </div>
          <div className="highlight-list">
            <div className="highlight-item">
              <strong>Request comes from a real operator</strong>
              <p className="muted-copy">
                The workflow starts with a business decision request that could come from CS leadership, RevOps, or account teams.
              </p>
            </div>
            <div className="highlight-item">
              <strong>Recommendation is reviewed before execution</strong>
              <p className="muted-copy">
                The system keeps a visible governance gate instead of pushing silent automation into enterprise systems.
              </p>
            </div>
            <div className="highlight-item">
              <strong>Handoff is structured</strong>
              <p className="muted-copy">
                Approval packages are shaped so they could be handed to CRM, support, or pricing workflows in a later integration pass.
              </p>
            </div>
          </div>
        </article>

        <article className="surface-card">
          <div className="section-header">
            <div>
              <h3>What an investor should notice</h3>
              <p>The product story here is adoption and process leverage, not just prediction quality.</p>
            </div>
          </div>
          <div className="detail-metrics">
            <div className="detail-metric">
              <span>Buyer pain</span>
              <strong>Slow decisions</strong>
            </div>
            <div className="detail-metric">
              <span>Product value</span>
              <strong>Faster action</strong>
            </div>
            <div className="detail-metric">
              <span>Trust model</span>
              <strong>Evidence visible</strong>
            </div>
            <div className="detail-metric">
              <span>Adoption barrier</span>
              <strong>No rip-and-replace</strong>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
