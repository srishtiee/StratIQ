"use client";

import { useState, useTransition } from "react";
import type {
  ActionResult,
  ApprovalRequest,
  ApprovalStatus,
} from "@shared/contracts";
import { ActionCard } from "@/components/action-card";
import { executeAction } from "@/lib/service";

const statusMap: Record<"approve" | "mark_ready" | "reject" | "execute", ApprovalStatus> = {
  approve: "Approved",
  mark_ready: "Ready",
  reject: "Rejected",
  execute: "Executed",
};

export function ApprovalsBoard({ approvals }: { approvals: ApprovalRequest[] }) {
  const [items, setItems] = useState(approvals);
  const [actionResults, setActionResults] = useState<Record<string, ActionResult>>({});
  const [isPending, startTransition] = useTransition();

  const handleAction = (approvalId: string, decision: "approve" | "mark_ready" | "reject" | "execute") => {
    startTransition(async () => {
      const result = await executeAction({ approvalId, decision });
      setActionResults((current) => ({ ...current, [approvalId]: result }));
      setItems((current) =>
        current.map((approval) =>
          approval.id === approvalId
            ? { ...approval, status: statusMap[decision] }
            : approval,
        ),
      );
    });
  };

  return (
    <section className="approval-grid">
      {items.map((approval) => (
        <ActionCard key={approval.id} approval={approval} result={actionResults[approval.id]}>
          <div className="button-row">
            <button className="button-secondary" type="button" onClick={() => handleAction(approval.id, "mark_ready")} disabled={isPending}>
              Mark ready
            </button>
            <button className="button-secondary" type="button" onClick={() => handleAction(approval.id, "reject")} disabled={isPending}>
              Reject
            </button>
            <button className="button-primary" type="button" onClick={() => handleAction(approval.id, "approve")} disabled={isPending}>
              Approve
            </button>
            <button className="button-primary" type="button" onClick={() => handleAction(approval.id, "execute")} disabled={isPending}>
              Execute log
            </button>
          </div>
        </ActionCard>
      ))}
    </section>
  );
}
