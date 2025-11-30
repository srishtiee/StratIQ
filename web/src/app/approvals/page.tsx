import { ActionCard } from "@/components/action-card";
import { listApprovals } from "@/lib/service";

export default async function ApprovalsPage() {
  const approvals = await listApprovals();

  return (
    <div className="page-stack">
      <section className="hero-card">
        <div>
          <span className="eyebrow">Approval queue</span>
          <h2 className="hero-title">Governed action review for executive-ready retention decisions.</h2>
          <p className="hero-copy">
            This screen makes the approval lane explicit: ownership, impact, rationale, and timing are all visible before any downstream execution is allowed.
          </p>
        </div>
        <div className="hero-meta">
          <article className="meta-stat">
            <span>Open approvals</span>
            <strong>{approvals.length}</strong>
          </article>
          <article className="meta-stat">
            <span>Urgent actions</span>
            <strong>{approvals.filter((item) => item.priority === "Urgent").length}</strong>
          </article>
          <article className="meta-stat">
            <span>Routing owner</span>
            <strong>RevOps + CS</strong>
          </article>
          <article className="meta-stat">
            <span>Execution mode</span>
            <strong>Manual gate</strong>
          </article>
        </div>
      </section>

      <section className="approval-grid">
        {approvals.map((approval) => (
          <ActionCard key={approval.id} approval={approval} />
        ))}
      </section>
    </div>
  );
}
