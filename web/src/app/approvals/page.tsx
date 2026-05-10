import { ApprovalsBoard } from "@/components/approvals-board";
import { StatePanel } from "@/components/state-panel";
import { listApprovals } from "@/lib/service";

export default async function ApprovalsPage() {
  const approvals = await listApprovals();

  return (
    <div className="page-stack">
      <section className="hero-card">
        <div>
          <span className="eyebrow">Enterprise approvals</span>
          <h2 className="hero-title">Keep execution accountable before any retention action enters the business.</h2>
          <p className="hero-copy">
            This screen is where enterprise buyers see operational realism: named owners, measurable impact, clear rationale, and a human checkpoint before execution moves downstream.
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
            <strong>Governed gate</strong>
          </article>
        </div>
      </section>

      {approvals.length > 0 ? (
        <ApprovalsBoard approvals={approvals} />
      ) : (
        <StatePanel
          title="Approval queue is clear"
          message="New governed actions will appear here when a workflow produces an approval-ready package."
        />
      )}
    </div>
  );
}
