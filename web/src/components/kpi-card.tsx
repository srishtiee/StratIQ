export function KpiCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article className="kpi-card">
      <p className="kpi-card__label">{label}</p>
      <strong className="kpi-card__value">{value}</strong>
      <p className="kpi-card__note">{note}</p>
    </article>
  );
}
