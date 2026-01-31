export function RouteLoadingState({
  label,
  title,
  message,
}: {
  label: string;
  title: string;
  message: string;
}) {
  return (
    <div className="page-stack">
      <section className="hero-card">
        <div>
          <span className="eyebrow">{label}</span>
          <h2 className="hero-title">{title}</h2>
          <p className="hero-copy">{message}</p>
        </div>

        <div className="hero-meta">
          <article className="meta-stat meta-stat--loading" />
          <article className="meta-stat meta-stat--loading" />
          <article className="meta-stat meta-stat--loading" />
          <article className="meta-stat meta-stat--loading" />
        </div>
      </section>

      <section className="skeleton-grid">
        <div className="skeleton-card" />
        <div className="skeleton-card" />
        <div className="skeleton-card" />
      </section>

      <section className="skeleton-grid skeleton-grid--wide">
        <div className="skeleton-card skeleton-card--tall" />
        <div className="skeleton-card skeleton-card--tall" />
      </section>
    </div>
  );
}
