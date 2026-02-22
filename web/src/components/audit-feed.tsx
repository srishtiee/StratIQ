import type { AuditRecord } from "@shared/contracts";

export function AuditFeed({ records }: { records: AuditRecord[] }) {
  return (
    <div className="audit-list">
      {records.map((record) => (
        <article key={record.id} className="audit-item">
          <div className="audit-item__meta">
            <strong>{record.eventType.replace("_", " ")}</strong>
            <span>{new Date(record.createdAt).toLocaleString()}</span>
          </div>
          <p>{record.message}</p>
          <p className="muted-copy">Actor: {record.actor}</p>
        </article>
      ))}
    </div>
  );
}
