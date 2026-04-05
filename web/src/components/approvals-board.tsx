"use client";

import { useEffect, useState, useTransition } from "react";
import type {
  ActionResult,
  ApprovalRequest,
  ApprovalStatus,
} from "@shared/contracts";
import { ActionCard } from "@/components/action-card";
import { RejectReasonModal } from "@/components/reject-reason-modal";
import { ApiError, executeAction, getRuntimeActor, subscribeRuntimeActor } from "@/lib/service";

const statusMap: Record<"approve" | "mark_ready" | "reject" | "execute", ApprovalStatus> = {
  approve: "approved",
  mark_ready: "approved",
  reject: "rejected",
  execute: "executed",
};
const actionRoles = new Set(["approver", "executive", "admin"]);

function normalizeStatus(status: ApprovalStatus): "pending" | "approved" | "rejected" | "executed" | "cancelled" {
  const value = status.toLowerCase();
  if (value === "pending") return "pending";
  if (value === "approved" || value === "ready") return "approved";
  if (value === "rejected") return "rejected";
  if (value === "executed") return "executed";
  return "cancelled";
}

export function ApprovalsBoard({ approvals }: { approvals: ApprovalRequest[] }) {
  const [items, setItems] = useState(approvals);
  const [actionResults, setActionResults] = useState<Record<string, ActionResult>>({});
  const [errorsByApproval, setErrorsByApproval] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [actor, setActor] = useState(() => getRuntimeActor());
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const canActByRole = actionRoles.has(actor.role);

  useEffect(() => subscribeRuntimeActor(() => setActor(getRuntimeActor())), []);

  const handleAction = (
    approval: ApprovalRequest,
    decision: "approve" | "mark_ready" | "reject" | "execute",
  ) => {
    const approvalId = approval.id;
    if (!canActByRole) {
      setErrorsByApproval((current) => ({
        ...current,
        [approvalId]: `Role '${actor.role}' cannot approve or execute actions.`,
      }));
      return;
    }
    if (decision === "execute" && normalizeStatus(approval.status) !== "approved") {
      setErrorsByApproval((current) => ({
        ...current,
        [approvalId]: "Only approved items can be executed.",
      }));
      return;
    }
    if (decision !== "execute" && normalizeStatus(approval.status) !== "pending") {
      setErrorsByApproval((current) => ({
        ...current,
        [approvalId]: "Only pending approvals can be approved or rejected.",
      }));
      return;
    }

    if (decision === "reject") {
      setRejectTargetId(approvalId);
      return;
    }

    void runAction(approval, decision);
  };

  const runAction = async (
    approval: ApprovalRequest,
    decision: "approve" | "mark_ready" | "reject" | "execute",
    reason?: string,
  ): Promise<string | null> => {
    const approvalId = approval.id;
    return new Promise<string | null>((resolve) =>
    startTransition(async () => {
      try {
        const result = await executeAction({ approvalId, decision, reason });
        setActionResults((current) => ({ ...current, [approvalId]: result }));
        setErrorsByApproval((current) => ({ ...current, [approvalId]: "" }));
        setItems((current) =>
          current.map((approval) =>
            approval.id === approvalId
              ? { ...approval, status: statusMap[decision] }
              : approval,
          ),
        );
        if (decision === "reject") {
          setRejectTargetId(null);
        }
        resolve(null);
      } catch (error) {
        const message =
          error instanceof ApiError
            ? `Action blocked (${error.status}): ${error.message}`
            : error instanceof Error
              ? error.message
              : "Action failed.";
        setErrorsByApproval((current) => ({ ...current, [approvalId]: message }));
        resolve(message);
      } finally {
      }
    }));
  };

  return (
    <section className="approval-grid">
      {items.map((approval) => (
        <ActionCard key={approval.id} approval={approval} result={actionResults[approval.id]}>
          <div className="button-row">
            <button
              className="button-secondary"
              type="button"
              onClick={() => handleAction(approval, "mark_ready")}
              disabled={isPending || !canActByRole || normalizeStatus(approval.status) !== "pending"}
            >
              Mark ready
            </button>
            <button
              className="button-secondary"
              type="button"
              onClick={() => handleAction(approval, "reject")}
              disabled={isPending || !canActByRole || normalizeStatus(approval.status) !== "pending"}
            >
              Reject
            </button>
            <button
              className="button-primary"
              type="button"
              onClick={() => handleAction(approval, "approve")}
              disabled={isPending || !canActByRole || normalizeStatus(approval.status) !== "pending"}
            >
              Approve
            </button>
            <button
              className="button-primary"
              type="button"
              onClick={() => handleAction(approval, "execute")}
              disabled={isPending || !canActByRole || normalizeStatus(approval.status) !== "approved"}
            >
              Execute log
            </button>
          </div>
          {errorsByApproval[approval.id] ? (
            <p className="muted-copy" style={{ marginTop: "0.75rem", color: "#9a3f3f" }}>
              {errorsByApproval[approval.id]}
            </p>
          ) : null}
        </ActionCard>
      ))}
      <RejectReasonModal
        key={rejectTargetId ?? "reject-modal-closed"}
        open={Boolean(rejectTargetId)}
        pending={isPending}
        onCancel={() => setRejectTargetId(null)}
        onConfirm={async (reason) => {
          const target = items.find((item) => item.id === rejectTargetId);
          if (!target) {
            return "Approval record not found.";
          }
          return runAction(target, "reject", reason);
        }}
      />
    </section>
  );
}
