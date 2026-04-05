import type { ActionStatus, ApprovalStatus, RiskLevel, WorkflowStatus } from "@shared/contracts";

type BadgeValue =
  | RiskLevel
  | ApprovalStatus
  | WorkflowStatus
  | ActionStatus
  | "ready"
  | "reviewing"
  | "approved";

const toneMap: Record<string, string> = {
  Critical: "critical",
  High: "high",
  Moderate: "moderate",
  Low: "low",
  pending: "pending",
  approved: "approved",
  rejected: "critical",
  executed: "executed",
  cancelled: "critical",
  queued: "ready",
  reviewing: "reviewing",
  ready: "ready",
  completed: "approved",
  needs_review: "high",
};

export function StatusBadge({ value }: { value: BadgeValue }) {
  const tone = toneMap[value] ?? "pending";
  const label =
    value === "pending"
      ? "Pending"
      : value === "approved"
        ? "Approved"
        : value === "rejected"
          ? "Rejected"
          : value === "executed"
            ? "Executed"
            : value === "cancelled"
              ? "Cancelled"
              : value;

  return <span className={`status-badge status-badge--${tone}`}>{label}</span>;
}
