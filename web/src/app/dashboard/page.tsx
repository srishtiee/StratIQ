import Link from "next/link";
import { CustomerTable } from "@/components/customer-table";
import { KpiCard } from "@/components/kpi-card";
import { StatePanel } from "@/components/state-panel";
import { getDashboardInsights, listCustomers } from "@/lib/service";

export default async function DashboardPage() {
  const [insights, customers] = await Promise.all([getDashboardInsights(), listCustomers()]);

  return (
    <div className="page-stack">
      <section className="hero-card">
        <div>
          <span className="eyebrow">Enterprise decision intelligence</span>
          <h2 className="hero-title">Bring governed churn decisions into the workflow your teams already run.</h2>
          <p className="hero-copy">
            StratIQ helps revenue, customer success, and operations leaders identify churn risk, review evidence, and approve the next best retention action without forcing a rip-and-replace of the systems they already use.
          </p>
          <div className="button-row" style={{ marginTop: "1rem" }}>
            <Link className="button-primary" href="/workflow">
              View decision workflow
            </Link>
            <Link className="button-secondary" href="/approvals">
              Review approval queue
            </Link>
          </div>
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

      <section className="proof-grid">
        <article className="proof-card">
          <span className="proof-card__label">Workflow fit</span>
          <strong>Human-in-the-loop approvals before execution</strong>
          <p>Enterprise teams keep control while StratIQ compresses the path from signal to action.</p>
        </article>
        <article className="proof-card">
          <span className="proof-card__label">System fit</span>
          <strong>Designed to sit on top of telemetry, CRM, and support systems</strong>
          <p>The UI and contracts are structured for adoption inside an existing enterprise stack.</p>
        </article>
        <article className="proof-card">
          <span className="proof-card__label">Buyer fit</span>
          <strong>Built for operational adoption, not just model output</strong>
          <p>Leaders see the evidence, rationale, owner, and timing before they authorize a save action.</p>
        </article>
      </section>

      <section className="kpi-grid">
        <KpiCard
          label="Retention actions ready"
          value={String(insights.actionQueue).padStart(2, "0")}
          note="Governed actions packaged for review inside an enterprise approval flow."
        />
        <KpiCard
          label="Critical revenue exposure"
          value={`$${Math.round(insights.criticalRevenue / 1000)}k`}
          note="3-month revenue at risk for critical accounts, surfaced with revenue-aware prioritization."
        />
        <KpiCard
          label="Signal coverage"
          value="3 layers"
          note="Telemetry, support context, and renewal timing flow into one decision surface."
        />
        <KpiCard
          label="Adoption path"
          value="Low friction"
          note="The experience is shaped around existing ops teams, routing, and approval behavior."
        />
      </section>

      <section className="summary-grid">
        <article className="surface-card">
          <div className="section-header">
            <div>
              <h3>Risk distribution</h3>
              <p>Current portfolio segmentation designed for executive triage, owner routing, and approval readiness.</p>
            </div>
          </div>
          {insights.riskMix.length > 0 ? (
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
          ) : (
            <StatePanel
              title="No portfolio mix available"
              message="Risk segmentation will appear here once the workspace receives account scoring data."
            />
          )}
        </article>

        <article className="surface-card">
          <div className="section-header">
            <div>
              <h3>Boardroom highlights</h3>
              <p>Fast proof points for investors, operators, and enterprise buyers evaluating product fit.</p>
            </div>
          </div>
          {insights.highlights.length > 0 ? (
            <div className="highlight-list">
              {insights.highlights.map((highlight) => (
                <div key={highlight} className="highlight-item">
                  <p>{highlight}</p>
                </div>
              ))}
            </div>
          ) : (
            <StatePanel
              title="No executive highlights yet"
              message="Boardroom-ready proof points will appear here once risk monitoring runs."
            />
          )}
        </article>
      </section>

      <section className="adoption-grid">
        <article className="surface-card">
          <div className="section-header">
            <div>
              <h3>Why enterprise teams can adopt this quickly</h3>
              <p>StratIQ is framed as an operational layer across existing systems, not a replacement for them.</p>
            </div>
          </div>
          <div className="highlight-list">
            <div className="highlight-item">
              <strong>Connect to existing systems</strong>
              <p className="muted-copy">
                The product is positioned to ingest CRM, product telemetry, support, and renewal signals already present in enterprise workflows.
              </p>
            </div>
            <div className="highlight-item">
              <strong>Keep approvals where enterprises expect them</strong>
              <p className="muted-copy">
                Recommendations are visible, attributable, and reviewable before any downstream execution step is taken.
              </p>
            </div>
            <div className="highlight-item">
              <strong>Make value legible to buyers</strong>
              <p className="muted-copy">
                Instead of just a churn score, StratIQ surfaces account impact, owner, urgency, and the exact action to take next.
              </p>
            </div>
          </div>
        </article>

        <article className="surface-card">
          <div className="section-header">
            <div>
              <h3>Enterprise-readiness signals</h3>
              <p>These are the cues the expo audience will look for when judging whether this can slot into a real organization.</p>
            </div>
          </div>
          <div className="detail-metrics">
            <div className="detail-metric">
              <span>Owner routing</span>
              <strong>Built in</strong>
            </div>
            <div className="detail-metric">
              <span>Governance gate</span>
              <strong>Approval first</strong>
            </div>
            <div className="detail-metric">
              <span>Integration posture</span>
              <strong>API contract ready</strong>
            </div>
            <div className="detail-metric">
              <span>Actionability</span>
              <strong>Next-best action</strong>
            </div>
          </div>
        </article>
      </section>

      {customers.length > 0 ? (
        <CustomerTable customers={customers} />
      ) : (
        <StatePanel
          title="No accounts available"
          message="Connect telemetry, CRM, and support data to populate the portfolio and customer drill-down views."
        />
      )}
    </div>
  );
}
