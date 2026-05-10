import Link from "next/link";
import { StatePanel } from "@/components/state-panel";

export default function NotFound() {
  return (
    <div className="page-stack">
      <section className="hero-card">
        <div>
          <span className="eyebrow">Route not found</span>
          <h2 className="hero-title">That StratIQ view does not exist.</h2>
          <p className="hero-copy">
            The page may have been removed, renamed, or the customer route may not match an account in the current dataset.
          </p>
          <div className="button-row" style={{ marginTop: "1rem" }}>
            <Link className="button-primary" href="/dashboard">
              Return to dashboard
            </Link>
            <Link className="button-secondary" href="/workflow">
              Open workflow
            </Link>
          </div>
        </div>
      </section>

      <StatePanel
        title="What to do next"
        message="Use the dashboard to reopen a tracked account, or go back to the workflow lane to generate a new decision package."
      />
    </div>
  );
}
