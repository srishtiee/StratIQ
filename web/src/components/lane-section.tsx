import { StatusBadge } from "@/components/status-badge";

export function LaneSection({
  title,
  status,
  children,
}: {
  title: string;
  status: string;
  children: React.ReactNode;
}) {
  const badgeStatus =
    status === "pending" ||
    status === "needs_review" ||
    status === "ready" ||
    status === "Pending" ||
    status === "Ready"
      ? "reviewing"
      : status === "completed" ||
          status === "approved" ||
          status === "Approved" ||
          status === "Executed"
        ? "approved"
        : status;

  return (
    <section className="lane-card">
      <div className="lane-card__title">
        <h3>{title}</h3>
        <StatusBadge value={badgeStatus as "ready" | "reviewing" | "approved"} />
      </div>
      <div className="lane-card__body">{children}</div>
    </section>
  );
}
