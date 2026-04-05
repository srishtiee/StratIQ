"use client";

import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import type {
  ActionResult,
  ApprovalStatus,
  CustomerDetail,
  IntentType,
  WorkflowResponse,
} from "@shared/contracts";
import { ActionCard } from "@/components/action-card";
import { EvidencePanel } from "@/components/evidence-panel";
import { LaneSection } from "@/components/lane-section";
import { RejectReasonModal } from "@/components/reject-reason-modal";
import { StatePanel } from "@/components/state-panel";
import {
  ApiError,
  executeAction,
  getCustomerById,
  getLatestWorkflow,
  getRuntimeActor,
  getLastWorkflowCustomerId,
  setLastWorkflowCustomerId,
  submitAsk,
  submitFeedback,
  subscribeRuntimeActor,
} from "@/lib/service";

const defaultPromptFor = (customerName = "Northstar Fiber") =>
  `Why did churn risk increase for ${customerName}, and which retention action should leadership approve first?`;

const intentLabels: Record<IntentType, string> = {
  churn_root_cause: "Root cause",
  retention_action: "Retention action",
  evidence_review: "Evidence review",
  approval_priority: "Approval priority",
  commercial_risk: "Commercial risk",
  support_risk: "Support risk",
  usage_decline: "Usage decline",
  adoption_risk: "Adoption risk",
  renewal_risk: "Renewal risk",
  general_churn: "Churn review",
};

export default function WorkflowPage() {
  const searchParams = useSearchParams();
  const customerId = searchParams.get("customer");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDetail | null>(null);
  const [prompt, setPrompt] = useState(defaultPromptFor());
  const [workflow, setWorkflow] = useState<WorkflowResponse | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [feedbackNote, setFeedbackNote] = useState("");
  const [lastFeedback, setLastFeedback] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<"overview" | "strategy" | "risk" | "evidence" | "audit">(
    "overview",
  );
  const [isPromptExpanded, setIsPromptExpanded] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [actor, setActor] = useState(() => getRuntimeActor());
  const [showRejectModal, setShowRejectModal] = useState(false);

  useEffect(() => subscribeRuntimeActor(() => setActor(getRuntimeActor())), []);

  const normalizedStatus = workflow?.approval.status.toLowerCase();
  const canActByRole = ["approver", "executive", "admin"].includes(actor.role);
  const canApproveOrReject = Boolean(workflow && canActByRole && normalizedStatus === "pending");
  const canExecute = Boolean(workflow && canActByRole && normalizedStatus === "approved");

  useEffect(() => {
    let active = true;
    const rememberedCustomerId = getLastWorkflowCustomerId();
    const activeCustomerId = customerId ?? rememberedCustomerId;

    startTransition(async () => {
      const [customer, latestWorkflow] = await Promise.all([
        activeCustomerId ? getCustomerById(activeCustomerId) : Promise.resolve(undefined),
        getLatestWorkflow(activeCustomerId ?? undefined),
      ]);
      if (!active) {
        return;
      }

      const targetName = customer?.name ?? latestWorkflow?.targetEntity.name ?? "Northstar Fiber";
      if (customer?.id ?? latestWorkflow?.targetEntity.id) {
        setLastWorkflowCustomerId(customer?.id ?? latestWorkflow?.targetEntity.id ?? "");
      }
      setSelectedCustomer(customer ?? null);
      setWorkflowError(null);

      if (!latestWorkflow) {
        setWorkflow(null);
        setResult(null);
        setPrompt(defaultPromptFor(targetName));
        setLastFeedback(null);
        setIsPromptExpanded(true);
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
    if (!canActByRole) {
      setWorkflowError(`Role '${actor.role}' cannot approve or execute actions.`);
      return;
    }
    if (decision === "execute" && !canExecute) {
      setWorkflowError("Only approved actions can be executed.");
      return;
    }
    if (decision !== "execute" && !canApproveOrReject) {
      setWorkflowError("Only pending approvals can be approved or rejected.");
      return;
    }
    if (decision === "reject") {
      setShowRejectModal(true);
      return;
    }
    void runAction(decision);
  };

  const runAction = (
    decision: "approve" | "mark_ready" | "reject" | "execute",
    reason?: string,
  ): Promise<string | null> => {
    if (!workflow) {
      return Promise.resolve("Workflow is unavailable.");
    }
    return new Promise<string | null>((resolve) => startTransition(async () => {
      try {
        const action = await executeAction({
          approvalId: workflow.approval.id,
          decision,
          reason,
        });
        setResult(action);
        setWorkflowError(null);

        const statusMap: Record<typeof decision, ApprovalStatus> = {
          approve: "approved",
          mark_ready: "approved",
          reject: "rejected",
          execute: "executed",
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
              actor: actor.userName,
              message: action.summary,
              createdAt: action.executedAt ?? new Date().toISOString(),
            },
            ...workflow.auditRecords,
          ],
        });
        resolve(null);
      } catch (error) {
        const message =
          error instanceof ApiError
            ? `Action blocked (${error.status}): ${error.message}`
            : error instanceof Error
              ? error.message
              : "Action failed.";
        setWorkflowError(message);
        resolve(message);
      }
    }));
  };

  const handleSubmit = () => {
    startTransition(async () => {
      try {
        setWorkflowError(null);
        const response = await submitAsk({
          prompt,
          focusCustomerId: customerId ?? selectedCustomer?.id ?? workflow?.targetEntity.id,
        });
        setLastWorkflowCustomerId(response.targetEntity.id);
        setWorkflow(response);
        setSelectedCustomer(null);
        setResult(null);
        setLastFeedback(null);
        setActivePanel("overview");
        setIsPromptExpanded(false);
      } catch (error) {
        setWorkflowError(
          error instanceof ApiError && error.status === 403
            ? `Role '${actor.role}' cannot submit Ask requests. Switch to executive, analyst, or admin.`
            : error instanceof ApiError && error.status === 409
              ? `Request blocked: ${error.message}`
              : error instanceof Error
                ? error.message
                : "Unable to generate workflow response.",
        );
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
  const targetName = workflow?.targetEntity.name ?? selectedCustomer?.name ?? "Northstar Fiber";

  return (
    <div className="page-stack">
      <section className="hero-card workflow-hero">
        <div>
          <span className="eyebrow">Operational workflow</span>
          <h2 className="hero-title workflow-hero__title">Retention decision workspace</h2>
          <p className="hero-copy">
            Review the ask, pressure-test the recommendation, and approve the next action without leaving the executive workflow.
          </p>
        </div>

        <div className="hero-meta workflow-hero__meta">
          <article className="meta-stat">
            <span>Target</span>
            <strong>{targetName}</strong>
          </article>
          <article className="meta-stat">
            <span>Request focus</span>
            <strong>{workflow ? intentLabels[workflow.detectedIntent] : "Ready"}</strong>
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
                      setPrompt(defaultPromptFor(targetName));
                      if (workflow) {
                        setIsPromptExpanded(false);
                      }
                    }}
                  >
                    {workflow ? "Collapse form" : "Reset prompt"}
                  </button>
                </div>
                {workflowError ? (
                  <StatePanel
                    title="Backend response needed"
                    message={workflowError}
                    tone="error"
                  />
                ) : null}
                <p className="muted-copy workflow-prompt-note">
                  This request drives the account evidence, recommendation, and approval details shown here.
                </p>
              </>
            )}
            {isPending ? (
              <StatePanel
                title="Preparing recommendation"
                message="StratIQ is reviewing customer signals, prioritizing evidence, and preparing the approval package."
                tone="loading"
              />
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
                        <span className="eyebrow">{intentLabels[workflow.detectedIntent]}</span>
                      </div>
                      <p>{workflow.summary}</p>
                      <p className="muted-copy" style={{ marginTop: "0.45rem" }}>
                        {workflow.targetEntity.name} is the account selected for this retention review.
                      </p>
                    </article>

                    <article className="agent-item">
                      <div className="lane-card__title" style={{ marginBottom: "0.5rem" }}>
                        <h3 style={{ fontSize: "1rem" }}>Final recommendation</h3>
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
                      <h3 style={{ fontSize: "1rem" }}>Recommended strategies</h3>
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
                      <h3 style={{ fontSize: "1rem" }}>Risk review</h3>
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
                        <p>Each decision and action update is recorded so the package can be reviewed later.</p>
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
              message="Submit an ask to populate the evidence, strategy, critique, final recommendation, and approval package."
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
                  <button className="button-secondary" type="button" onClick={() => handleAction("mark_ready")} disabled={isPending || !canApproveOrReject}>
                    Mark ready
                  </button>
                  <button className="button-secondary" type="button" onClick={() => handleAction("reject")} disabled={isPending || !canApproveOrReject}>
                    Reject
                  </button>
                  <button className="button-primary" type="button" onClick={() => handleAction("approve")} disabled={isPending || !canApproveOrReject}>
                    Approve
                  </button>
                  <button className="button-primary" type="button" onClick={() => handleAction("execute")} disabled={isPending || !canExecute}>
                    Execute log
                  </button>
                </div>
              </ActionCard>
              <RejectReasonModal
                key={showRejectModal ? "workflow-reject-open" : "workflow-reject-closed"}
                open={showRejectModal}
                pending={isPending}
                onCancel={() => setShowRejectModal(false)}
                onConfirm={async (reason) => {
                  if (!workflow) {
                    return "Workflow is no longer available.";
                  }
                  const actionError = await runAction("reject", reason);
                  if (!actionError) {
                    setShowRejectModal(false);
                  }
                  return actionError;
                }}
              />
              <div className="workflow-side-notes">
                <div className="button-row button-row--compact">
                  <LinkToApprovals />
                </div>
                <div className="workflow-compact-note">
                  <strong>Execution boundary</strong>
                  <p>
                    StratIQ records the approved decision and handoff while downstream CRM, pricing, or ticketing steps remain under operator control.
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
