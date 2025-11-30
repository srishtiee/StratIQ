import type { EvidenceItem } from "@shared/contracts";

export function EvidencePanel({ evidence }: { evidence: EvidenceItem[] }) {
  return (
    <div className="evidence-list">
      {evidence.map((item) => (
        <article key={item.id} className="evidence-item">
          <p className="eyebrow">{item.source}</p>
          <h4 style={{ marginTop: "0.7rem", marginBottom: "0.45rem" }}>{item.title}</h4>
          <p className="muted-copy">{item.snippet}</p>
        </article>
      ))}
    </div>
  );
}
