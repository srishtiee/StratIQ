import Link from "next/link";
import { notFound } from "next/navigation";
import { EvidencePanel } from "@/components/evidence-panel";
import { StatusBadge } from "@/components/status-badge";
import { StatePanel } from "@/components/state-panel";
import { getCustomerById } from "@/lib/service";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await getCustomerById(id);

  if (!customer) {
    notFound();
  }

  return (
    <div className="page-stack">
      <section className="hero-card">
        <div>
          <span className="eyebrow">{customer.segment}</span>
          <h2 className="hero-title">{customer.name}</h2>
          <p className="hero-copy">
            This detail view is the drill-down surface for the dashboard and workflow. It keeps the risk signal, top drivers, and recommended action in one place for faster executive review.
          </p>
        </div>

        <div className="hero-meta">
          <article className="meta-stat">
            <span>Risk level</span>
            <strong>{customer.riskLevel}</strong>
          </article>
          <article className="meta-stat">
            <span>Health score</span>
            <strong>{customer.healthScore}</strong>
          </article>
          <article className="meta-stat">
            <span>Renewal</span>
            <strong>{customer.renewalDate}</strong>
          </article>
          <article className="meta-stat">
            <span>MRR</span>
            <strong>${customer.monthlyRevenue.toLocaleString()}</strong>
          </article>
        </div>
      </section>

      <div className="details-grid">
        <section className="customer-card">
          <div className="customer-card__title">
            <h3>Account summary</h3>
            <StatusBadge value={customer.riskLevel} />
          </div>
          <div className="detail-metrics">
            <div className="detail-metric">
              <span>Plan</span>
              <strong>{customer.plan}</strong>
            </div>
            <div className="detail-metric">
              <span>Account owner</span>
              <strong>{customer.accountOwner}</strong>
            </div>
            <div className="detail-metric">
              <span>Ticket load</span>
              <strong>{customer.ticketLoad}</strong>
            </div>
            <div className="detail-metric">
              <span>Last activity</span>
              <strong>{customer.lastActivity}</strong>
            </div>
          </div>
          <div className="empty-state" style={{ marginTop: "1rem" }}>
            <strong>Recommended action</strong>
            <p style={{ marginTop: "0.4rem" }}>{customer.recommendedAction}</p>
          </div>
        </section>

        <section className="customer-card">
          <div className="customer-card__title">
            <h3>Top drivers</h3>
            <Link className="text-link" href={`/workflow?customer=${customer.id}`}>
              Open workflow
            </Link>
          </div>
          <div className="driver-list">
            {customer.topDrivers.length > 0 ? (
              customer.topDrivers.map((driver) => (
                <div key={driver} className="driver-item">
                  {driver}
                </div>
              ))
            ) : (
              <StatePanel
                title="No primary drivers available"
                message="Customer-level drivers will appear here once StratIQ receives enough signal history for this account."
              />
            )}
          </div>
        </section>
      </div>

      <div className="summary-grid">
        <section className="surface-card">
          <div className="section-header">
            <div>
              <h3>Latest evidence</h3>
              <p>Retrieved signals and support context currently shaping the churn recommendation.</p>
            </div>
          </div>
          {customer.evidence.length > 0 ? (
            <EvidencePanel evidence={customer.evidence} />
          ) : (
            <StatePanel
              title="No evidence captured yet"
              message="Run the bounded workflow for this account to store support snippets and structured signals."
            />
          )}
        </section>

        <section className="surface-card">
          <div className="section-header">
            <div>
              <h3>Latest approval package</h3>
              <p>Most recent action package tied to this account.</p>
            </div>
          </div>
          {customer.latestApproval ? (
            <div className="highlight-list">
              <div className="highlight-item">
                <strong>{customer.latestApproval.actionTitle}</strong>
                <p className="muted-copy" style={{ marginTop: "0.35rem" }}>
                  {customer.latestApproval.rationale}
                </p>
                <p className="muted-copy" style={{ marginTop: "0.35rem" }}>
                  Owner: {customer.latestApproval.owner} | Impact: {customer.latestApproval.estimatedImpact}
                </p>
              </div>
            </div>
          ) : (
            <StatePanel
              title="No approval package stored"
              message="The next workflow run for this account will generate an approval-ready retention action."
            />
          )}
        </section>
      </div>

      <section className="surface-card">
        <div className="section-header">
          <div>
            <h3>Recent workflow runs</h3>
            <p>Previous bounded decision packages recorded for this account.</p>
          </div>
        </div>
        {customer.recentRuns.length > 0 ? (
          <div className="audit-list">
            {customer.recentRuns.map((run) => (
              <article key={run.id} className="audit-item">
                <div className="audit-item__meta">
                  <strong>{run.workflowType.replace("_", " ")}</strong>
                  <span>{new Date(run.submittedAt).toLocaleString()}</span>
                </div>
                <p>{run.summary}</p>
                <p className="muted-copy" style={{ marginTop: "0.35rem" }}>
                  Final recommendation: {run.finalRecommendation}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <StatePanel
            title="No workflow history yet"
            message="This account has not yet been processed through the bounded churn pipeline."
          />
        )}
      </section>
    </div>
  );
}
