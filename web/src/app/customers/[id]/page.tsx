import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
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
            <Link className="text-link" href="/workflow">
              Open workflow
            </Link>
          </div>
          <div className="driver-list">
            {customer.topDrivers.map((driver) => (
              <div key={driver} className="driver-item">
                {driver}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
