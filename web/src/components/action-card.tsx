import type { ActionResult, ApprovalRequest } from "@shared/contracts";
import { StatusBadge } from "@/components/status-badge";

export function ActionCard({
  approval,
  result,
}: {
  approval: ApprovalRequest;
  result?: ActionResult | null;
}) {
  return (
    <article className="approval-card">
      <div className="approval-card__title">
        <h3>{approval.action}</h3>
        <StatusBadge value={approval.status} />
      </div>
      <p className="muted-copy">{approval.rationale}</p>
      <div className="detail-metrics" style={{ marginTop: "0.9rem" }}>
        <div className="detail-metric">
          <span>Owner</span>
          <strong>{approval.owner}</strong>
        </div>
        <div className="detail-metric">
          <span>Expected impact</span>
          <strong>{approval.estimatedImpact}</strong>
        </div>
      </div>

      {result ? (
        <div className="empty-state" style={{ marginTop: "0.9rem" }}>
          <strong>{result.summary}</strong>
          <p style={{ marginTop: "0.4rem" }}>{result.auditNote}</p>
        </div>
      ) : null}
    </article>
  );
}
