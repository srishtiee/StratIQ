import type { ApprovalStatus, RiskLevel, WorkflowStatus } from "@shared/contracts";

type BadgeValue = RiskLevel | ApprovalStatus | WorkflowStatus;

const toneMap: Record<string, string> = {
  Critical: "critical",
  High: "high",
  Moderate: "moderate",
  Low: "low",
  Pending: "pending",
  Ready: "ready",
  Approved: "approved",
  Executed: "executed",
  reviewing: "reviewing",
  ready: "ready",
  approved: "approved",
};

export function StatusBadge({ value }: { value: BadgeValue }) {
  const tone = toneMap[value] ?? "pending";

  return <span className={`status-badge status-badge--${tone}`}>{value}</span>;
}
