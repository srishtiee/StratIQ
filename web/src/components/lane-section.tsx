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
  return (
    <section className="lane-card">
      <div className="lane-card__title">
        <h3>{title}</h3>
        <StatusBadge value={status as "ready" | "reviewing" | "approved"} />
      </div>
      <div className="lane-card__body">{children}</div>
    </section>
  );
}
