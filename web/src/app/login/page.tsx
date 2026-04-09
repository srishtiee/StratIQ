"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getDemoUsers, hasDemoSession, loginAsDemoUser } from "@/lib/service";

export default function LoginPage() {
  const router = useRouter();
  const demoUsers = useMemo(() => getDemoUsers(), []);
  const [selectedEmail, setSelectedEmail] = useState(demoUsers[0]?.email ?? "");
  const [error, setError] = useState<string | null>(null);
  const [alreadyLoggedIn] = useState(() => hasDemoSession());

  useEffect(() => {
    if (hasDemoSession()) {
      router.replace("/dashboard");
    }
  }, [router]);

  if (alreadyLoggedIn) return null;

  return (
    <div className="page-stack">
      <section className="hero-card" style={{ gridTemplateColumns: "1fr" }}>
        <div>
          <span className="eyebrow">Demo login</span>
          <h2 className="hero-title" style={{ maxWidth: "13ch" }}>
            Choose a pre-registered user
          </h2>
          <p className="hero-copy">
            Select a demo identity to test role-based workflows. This is a prototype login path for local and
            evaluator demos.
          </p>
          <div className="workflow-form" style={{ marginTop: "1rem", maxWidth: "520px" }}>
            <label htmlFor="demo-email" className="muted-copy">
              Demo account
            </label>
            <select
              id="demo-email"
              value={selectedEmail}
              onChange={(event) => setSelectedEmail(event.target.value)}
              style={{
                border: "1px solid rgba(23, 49, 63, 0.12)",
                borderRadius: "0.9rem",
                padding: "0.85rem",
                background: "rgba(255,255,255,0.84)",
              }}
            >
              {demoUsers.map((user) => (
                <option key={user.email} value={user.email}>
                  {user.email} ({user.role})
                </option>
              ))}
            </select>
            <div className="button-row">
              <button
                className="button-primary"
                type="button"
                onClick={() => {
                  const ok = loginAsDemoUser(selectedEmail);
                  if (!ok) {
                    setError("Unable to sign in with selected demo user.");
                    return;
                  }
                  router.push("/dashboard");
                }}
              >
                Continue to dashboard
              </button>
            </div>
            {error ? <p className="muted-copy" style={{ color: "#9a3f3f" }}>{error}</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
