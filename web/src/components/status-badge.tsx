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
  Pending: "pending",
  Ready: "ready",
  Approved: "approved",
  Rejected: "critical",
  Executed: "executed",
  queued: "ready",
  rejected: "critical",
  executed: "approved",
  reviewing: "reviewing",
  ready: "ready",
  approved: "approved",
  pending: "pending",
  completed: "approved",
  needs_review: "high",
};

export function StatusBadge({ value }: { value: BadgeValue }) {
  const tone = toneMap[value] ?? "pending";

  return <span className={`status-badge status-badge--${tone}`}>{value}</span>;
}
