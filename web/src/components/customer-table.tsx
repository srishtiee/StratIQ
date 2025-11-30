import Link from "next/link";
import type { CustomerRiskSummary } from "@shared/contracts";
import { StatusBadge } from "@/components/status-badge";

export function CustomerTable({ customers }: { customers: CustomerRiskSummary[] }) {
  return (
    <div className="surface-card">
      <div className="section-header">
        <div>
          <h3>Priority accounts</h3>
          <p>Customer drill-downs are wired around the accounts most likely to appear in the workflow lane.</p>
        </div>
      </div>

      <table className="customer-table">
        <thead>
          <tr>
            <th>Customer</th>
            <th>Risk</th>
            <th>Health</th>
            <th>Renewal</th>
            <th>Owner</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {customers.map((customer) => (
            <tr key={customer.id}>
              <td>
                <strong>{customer.name}</strong>
                <div className="muted-copy">{customer.segment}</div>
              </td>
              <td>
                <StatusBadge value={customer.riskLevel} />
              </td>
              <td>{customer.healthScore}</td>
              <td>{customer.renewalDate}</td>
              <td>{customer.accountOwner}</td>
              <td>
                <Link className="text-link" href={`/customers/${customer.id}`}>
                  Open profile
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
