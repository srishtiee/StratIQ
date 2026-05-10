import { StatusBadge } from "@/components/status-badge";

export function LaneSection({
  title,
  status,
  className,
  children,
}: {
  title: string;
  status: string;
  className?: string;
  children: React.ReactNode;
}) {
  const badgeStatus =
    status === "pending" ||
    status === "needs_review" ||
    status === "ready"
      ? "reviewing"
      : status === "completed" ||
          status === "approved" ||
          status === "executed"
        ? "approved"
        : status;

  return (
    <section className={`lane-card${className ? ` ${className}` : ""}`}>
      <div className="lane-card__title">
        <h3>{title}</h3>
        <StatusBadge value={badgeStatus as "ready" | "reviewing" | "approved"} />
      </div>
      <div className="lane-card__body">{children}</div>
    </section>
  );
}
