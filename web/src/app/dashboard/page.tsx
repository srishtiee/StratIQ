import { CustomerTable } from "@/components/customer-table";
import { KpiCard } from "@/components/kpi-card";
import { getDashboardInsights, listCustomers } from "@/lib/service";

export default async function DashboardPage() {
  const [insights, customers] = await Promise.all([getDashboardInsights(), listCustomers()]);

  return (
    <div className="page-stack">
      <section className="hero-card">
        <div>
          <span className="eyebrow">Phase 1 foundation</span>
          <h2 className="hero-title">Executive churn workflow built around visible product ownership.</h2>
          <p className="hero-copy">
            This prototype centers on the dashboard, workflow lanes, approvals, and drill-down screens that map directly to the frontend and integration work committed in the contribution report.
          </p>
        </div>

        <div className="hero-meta">
          <article className="meta-stat">
            <span>Accounts at risk</span>
            <strong>{insights.portfolioAtRisk}</strong>
          </article>
          <article className="meta-stat">
            <span>Approvals in queue</span>
            <strong>{insights.actionQueue}</strong>
          </article>
          <article className="meta-stat">
            <span>Renewals this week</span>
            <strong>{insights.renewalWindow}</strong>
          </article>
          <article className="meta-stat">
            <span>Decision confidence</span>
            <strong>{insights.executiveConfidence}</strong>
          </article>
        </div>
      </section>

      <section className="kpi-grid">
        <KpiCard
          label="Retention actions ready"
          value="04"
          note="Governed actions prepared for approval this week."
        />
        <KpiCard
          label="Critical revenue exposure"
          value="$372k"
          note="Largest near-term exposure concentrated in one strategic telecom account."
        />
        <KpiCard
          label="Signal coverage"
          value="3 layers"
          note="Telemetry, support context, and renewal timing are fused in the workflow."
        />
        <KpiCard
          label="Frontend readiness"
          value="Phase 1"
          note="Dashboard, workflow, approvals, and drill-downs are wired for demo use."
        />
      </section>

      <section className="summary-grid">
        <article className="surface-card">
          <div className="section-header">
            <div>
              <h3>Risk distribution</h3>
              <p>Current portfolio segmentation designed for executive triage and workflow entry points.</p>
            </div>
          </div>
          <div className="risk-bar">
            {insights.riskMix.map((entry) => {
              const total = insights.riskMix.reduce((sum, item) => sum + item.count, 0);
              const width = `${(entry.count / total) * 100}%`;

              return (
                <div key={entry.label} className="risk-row">
                  <div className="risk-row__meta">
                    <span>{entry.label}</span>
                    <span>{entry.count} accounts</span>
                  </div>
                  <div className="risk-row__track">
                    <div
                      className="risk-row__fill"
                      style={{ width, background: entry.accent }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <article className="surface-card">
          <div className="section-header">
            <div>
              <h3>Executive highlights</h3>
              <p>Short signals the workflow should keep visible above the fold.</p>
            </div>
          </div>
          <div className="highlight-list">
            {insights.highlights.map((highlight) => (
              <div key={highlight} className="highlight-item">
                <p>{highlight}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <CustomerTable customers={customers} />
    </div>
  );
}
