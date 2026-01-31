"use client";

import { useEffect } from "react";
import { StatePanel } from "@/components/state-panel";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="page-stack">
      <section className="hero-card">
        <div>
          <span className="eyebrow">System interruption</span>
          <h2 className="hero-title">The workspace hit an unexpected issue.</h2>
          <p className="hero-copy">
            StratIQ could not finish loading this view. You can retry the request without leaving the current route.
          </p>
          <div className="button-row" style={{ marginTop: "1rem" }}>
            <button className="button-primary" type="button" onClick={reset}>
              Retry view
            </button>
          </div>
        </div>
      </section>

      <StatePanel
        title="Recovery guidance"
        message="If the issue persists, verify the frontend and API are running, then reload the route. The fallback mock layer still allows the core demo flow to continue when the API is unavailable."
        tone="error"
      />
    </div>
  );
}
