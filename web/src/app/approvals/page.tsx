import { ApprovalsBoard } from "@/components/approvals-board";
import { Pagination } from "@/components/pagination";
import { StatePanel } from "@/components/state-panel";
import { listApprovals } from "@/lib/service";

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const page = parseInt((params.page as string) || "1", 10);
  const response = await listApprovals(page);
  const approvals = response.items;

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
            <span>Total open approvals</span>
            <strong>{response.total}</strong>
          </article>
          <article className="meta-stat">
            <span>Urgent actions</span>
            <strong>{approvals.filter((item) => item.priority === "Urgent").length} (This Page)</strong>
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
        <>
          <ApprovalsBoard approvals={approvals} />
          <Pagination page={response.page} totalPages={response.totalPages} basePath="/approvals" />
        </>
      ) : (
        <StatePanel
          title="Approval queue is clear"
          message="New governed actions will appear here when a workflow produces an approval-ready package."
        />
      )}
    </div>
  );
}
