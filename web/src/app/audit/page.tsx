import { AuditFeed } from "@/components/audit-feed";
import { Pagination } from "@/components/pagination";
import { StatePanel } from "@/components/state-panel";
import { listAuditRecords } from "@/lib/service";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const page = parseInt((params.page as string) || "1", 10);
  const response = await listAuditRecords(page);
  const records = response.items;

  return (
    <div className="page-stack">
      <section className="hero-card">
        <div>
          <span className="eyebrow">Decision history</span>
          <h2 className="hero-title">Track workflow runs, approvals, and actions with a clean audit surface.</h2>
          <p className="hero-copy">
            StratIQ records the bounded reasoning flow as an enterprise-friendly trail so operators can explain what happened, who approved it, and what action state followed.
          </p>
        </div>
        <div className="hero-meta">
          <article className="meta-stat">
            <span>Total events</span>
            <strong>{response.total}</strong>
          </article>
          <article className="meta-stat">
            <span>Workflow events</span>
            <strong>{records.filter((record) => record.eventType === "workflow_run").length}</strong>
          </article>
          <article className="meta-stat">
            <span>Approval events</span>
            <strong>{records.filter((record) => record.eventType === "approval").length}</strong>
          </article>
          <article className="meta-stat">
            <span>Action events</span>
            <strong>{records.filter((record) => record.eventType === "action").length}</strong>
          </article>
        </div>
      </section>

      <section className="surface-card">
        <div className="section-header">
          <div>
            <h3>Latest audit records</h3>
            <p>Bounded reasoning, approvals, and action state changes are persisted here for review.</p>
          </div>
        </div>
        {records.length > 0 ? (
          <>
            <AuditFeed records={records} />
            <Pagination page={response.page} totalPages={response.totalPages} basePath="/audit" />
          </>
        ) : (
          <StatePanel
            title="No audit records available"
            message="Workflow runs and approval transitions will appear here once the system starts recording decisions."
          />
        )}
      </section>
    </div>
  );
}
