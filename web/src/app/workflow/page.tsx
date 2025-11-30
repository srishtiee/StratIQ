"use client";

import { useState, useTransition } from "react";
import type { ActionResult, WorkflowResponse } from "@shared/contracts";
import { ActionCard } from "@/components/action-card";
import { EvidencePanel } from "@/components/evidence-panel";
import { LaneSection } from "@/components/lane-section";
import { executeAction, submitAsk, submitFeedback } from "@/lib/service";

const defaultPrompt =
  "Assess Northstar Fiber's churn risk and prepare a governed retention action that can be reviewed by leadership this week.";

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
          <span className="eyebrow">Workflow foundation</span>
          <h2 className="hero-title">Ask, Plan/Debate, and Approve in one visible decision flow.</h2>
          <p className="hero-copy">
            This page is designed as the clearest expression of the committed frontend ownership: request intake, reasoning visibility, approval flow, and stable contracts that can later swap from mocks to live services.
          </p>
        </div>

        <div className="hero-meta">
          <article className="meta-stat">
            <span>Workflow mode</span>
            <strong>Mock-backed</strong>
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
            <strong>No side effects</strong>
          </article>
        </div>
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
                {isPending ? "Running workflow..." : "Run ask lane"}
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
              Contracts mirror `POST /api/ask` so the UI can later switch to the FastAPI stub or a real orchestrator without a layout rewrite.
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
                  placeholder="Leave an approval or revision note for the debate lane."
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
                Audit note: Phase 1 stops at governed confirmation. The approval is recorded, but no downstream CRM or messaging action fires yet.
              </div>
            </>
          ) : (
            <div className="empty-state">
              Approval cards appear after the workflow has produced a recommendation package.
            </div>
          )}
        </LaneSection>
      </div>
    </div>
  );
}
