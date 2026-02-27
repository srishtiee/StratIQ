import type { ActionResult, ApprovalRequest } from "@shared/contracts";
import { StatusBadge } from "@/components/status-badge";

export function ActionCard({
  approval,
  result,
  className,
  children,
}: {
  approval: ApprovalRequest;
  result?: ActionResult | null;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <article className={`approval-card${className ? ` ${className}` : ""}`}>
      <div className="approval-card__title">
        <div>
          <h3>{approval.actionTitle}</h3>
          <p className="muted-copy" style={{ marginTop: "0.25rem" }}>
            {approval.customerName}
          </p>
        </div>
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
        <div className="detail-metric">
          <span>Due window</span>
          <strong>{approval.dueLabel}</strong>
        </div>
        <div className="detail-metric">
          <span>Created</span>
          <strong>{new Date(approval.createdAt).toLocaleDateString()}</strong>
        </div>
      </div>

      {children ? <div style={{ marginTop: "0.9rem" }}>{children}</div> : null}

      {result ? (
        <div className="empty-state" style={{ marginTop: "0.9rem" }}>
          <strong>{result.summary}</strong>
          <p style={{ marginTop: "0.4rem" }}>{result.auditNote}</p>
        </div>
      ) : null}
    </article>
  );
}
