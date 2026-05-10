"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  applyAuthSession,
  loginWithGoogleCredential,
  loginWithPassword,
  registerAccount,
} from "@/lib/service";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (resp: { credential: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: { theme?: string; size?: string; text?: string; width?: string; shape?: string },
          ) => void;
        };
      };
    };
  }
}

const googleClientId = process.env.NEXT_PUBLIC_STRATIQ_GOOGLE_CLIENT_ID ?? "";

export default function LoginPage() {
  const router = useRouter();
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);

  useEffect(() => {
    if (!googleClientId || !googleButtonRef.current) {
      return;
    }
    let cancelled = false;
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      if (cancelled || !googleButtonRef.current || !window.google?.accounts?.id) {
        return;
      }
      const host = googleButtonRef.current;
      if (host.childElementCount > 0) {
        return;
      }
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (resp) => {
          setError(null);
          setBusy(true);
          try {
            const data = await loginWithGoogleCredential(resp.credential);
            applyAuthSession(data.accessToken, data.user);
            router.replace("/dashboard");
          } catch (e) {
            setError(e instanceof Error ? e.message : "Google sign-in failed");
          } finally {
            setBusy(false);
          }
        },
      });
      window.google.accounts.id.renderButton(host, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "pill",
        width: `${Math.max(220, Math.round(host.getBoundingClientRect().width))}`,
      });
      setGoogleReady(true);
    };
    script.onerror = () => setGoogleReady(false);
    document.body.appendChild(script);
    return () => {
      cancelled = true;
      script.remove();
    };
  }, [router]);

  async function onSubmit() {
    setError(null);
    setBusy(true);
    try {
      const data =
        mode === "register"
          ? await registerAccount(email, password, name)
          : await loginWithPassword(email, password);
      applyAuthSession(data.accessToken, data.user);
      router.replace("/dashboard");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sign-in failed";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "linear-gradient(160deg, #f6efe3 0%, #fbf7ef 52%, #efe4d1 100%)",
        padding: "24px",
        overflowX: "hidden",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "1120px",
          display: "grid",
          gridTemplateColumns: "1.45fr 0.95fr",
          gap: "22px",
          padding: "28px",
          borderRadius: "32px",
          background: "rgba(255,250,242,0.86)",
          border: "1px solid #e5dccd",
          boxShadow: "0 20px 45px rgba(26, 47, 56, 0.12)",
          alignItems: "stretch",
        }}
      >
        <aside
          style={{
            borderRadius: "26px",
            background: "linear-gradient(160deg, rgba(255, 251, 245, 0.96), rgba(245, 236, 222, 0.86))",
            border: "1px solid #e4dccf",
            padding: "40px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minHeight: "560px",
          }}
        >
          <div>
            <span
              className="eyebrow"
              style={{
                width: "fit-content",
                height: "34px",
                padding: "0 16px",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              STRATIQ PLATFORM
            </span>
            <h2
              style={{
                marginTop: "18px",
                color: "#173746",
                fontFamily: 'var(--font-display), "Iowan Old Style", Georgia, serif',
                fontSize: "clamp(2.4rem, 5.2vw, 4.6rem)",
                lineHeight: "0.95",
                letterSpacing: "-0.01em",
                maxWidth: "560px",
              }}
            >
              Executive
              <br />
              Decision
              <br />
              Intelligence
            </h2>
            <p
              style={{
                marginTop: "18px",
                maxWidth: "560px",
                color: "#5e7883",
                fontSize: "1rem",
                lineHeight: "1.65",
              }}
            >
              Drive churn mitigation with evidence-backed workflows, structured approvals, and role-based access for
              accountable execution.
            </p>
          </div>
          <p style={{ color: "#5e7883", fontSize: "0.9rem", lineHeight: "1.55" }}>
            Evidence-backed workflows &nbsp;&middot;&nbsp; Approval-gated actions &nbsp;&middot;&nbsp; Audit-ready
            decisions
          </p>
        </aside>

        <div
          style={{
            borderRadius: "26px",
            background: "#fffdf8",
            border: "1px solid #e4dccf",
            padding: "36px",
            minHeight: "560px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div style={{ width: "100%", maxWidth: "380px", margin: "0 auto" }}>
            <span
              className="eyebrow"
              style={{
                width: "fit-content",
                height: "34px",
                padding: "0 16px",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              LOGIN
            </span>
            <h2
              style={{
                marginTop: "18px",
                color: "#173746",
                fontFamily: 'var(--font-display), "Iowan Old Style", Georgia, serif',
                fontSize: "clamp(2.2rem, 4.6vw, 3.8rem)",
                lineHeight: "0.95",
                letterSpacing: "-0.01em",
              }}
            >
              StratIQ
            </h2>
            <p style={{ marginTop: "8px", color: "#5e7883", lineHeight: "1.55" }}>Sign in to continue to your workspace.</p>

            <div style={{ marginTop: "24px", display: "grid", gap: "20px" }}>
              <div
                style={{
                  width: "100%",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "8px",
                  borderRadius: "9999px",
                }}
              >
                <button
                  type="button"
                  style={{
                    minHeight: "46px",
                    borderRadius: "9999px",
                    border: mode === "login" ? "1px solid transparent" : "1px solid #d8d0c1",
                    background: mode === "login" ? "linear-gradient(135deg, #1f6f7a, #174d63)" : "#fff",
                    color: mode === "login" ? "#fff" : "#35525d",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                  onClick={() => setMode("login")}
                >
                  Login
                </button>
                <button
                  type="button"
                  style={{
                    minHeight: "46px",
                    borderRadius: "9999px",
                    border: mode === "register" ? "1px solid transparent" : "1px solid #d8d0c1",
                    background: mode === "register" ? "linear-gradient(135deg, #1f6f7a, #174d63)" : "#fff",
                    color: mode === "register" ? "#fff" : "#35525d",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                  onClick={() => setMode("register")}
                >
                  Create account
                </button>
              </div>

              {mode === "register" ? (
                <label className="muted-copy" style={{ display: "grid", gap: "8px" }}>
                  Name (optional)
                  <input
                    className="text-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    style={{
                      width: "100%",
                      height: "52px",
                      border: "1px solid #d9d1c4",
                      borderRadius: "16px",
                      padding: "0 15px",
                      background: "rgba(255, 255, 255, 0.94)",
                      outline: "none",
                    }}
                  />
                </label>
              ) : null}

              <label className="muted-copy" style={{ display: "grid", gap: "8px" }}>
                Email
                <input
                  className="text-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  style={{
                    width: "100%",
                    height: "52px",
                    border: "1px solid #d9d1c4",
                    borderRadius: "16px",
                    padding: "0 15px",
                    background: "rgba(255, 255, 255, 0.94)",
                    outline: "none",
                  }}
                />
              </label>

              <label className="muted-copy" style={{ display: "grid", gap: "8px" }}>
                Password
                <input
                  className="text-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  style={{
                    width: "100%",
                    height: "52px",
                    border: "1px solid #d9d1c4",
                    borderRadius: "16px",
                    padding: "0 15px",
                    background: "rgba(255, 255, 255, 0.94)",
                    outline: "none",
                  }}
                />
              </label>

              <button
                className="button-primary"
                style={{
                  width: "100%",
                  height: "52px",
                  borderRadius: "9999px",
                  marginTop: "4px",
                }}
                type="button"
                disabled={busy}
                onClick={() => void onSubmit()}
              >
                {mode === "register" ? "Create account" : "Continue"}
              </button>

              {googleClientId ? (
                <div style={{ marginTop: "2px", display: "grid", gap: "16px" }}>
                  <div
                    aria-hidden="true"
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      color: "#5e7883",
                      fontSize: "0.82rem",
                      letterSpacing: "0.08em",
                    }}
                  >
                    <span style={{ height: "1px", flex: 1, background: "rgba(23, 49, 63, 0.14)" }} />
                    <span>OR</span>
                    <span style={{ height: "1px", flex: 1, background: "rgba(23, 49, 63, 0.14)" }} />
                  </div>
                  <div
                    ref={googleButtonRef}
                    style={{ width: "100%", minHeight: "48px", borderRadius: "9999px", overflow: "hidden" }}
                  />
                  {!googleReady ? (
                    <p className="muted-copy" style={{ margin: 0, fontSize: "0.82rem" }}>
                      Google sign-in button is loading...
                    </p>
                  ) : null}
                </div>
              ) : null}

              {error ? (
                <p className="muted-copy" style={{ color: "#9a3f3f", margin: 0 }}>
                  {error}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>
      <style jsx>{`
        @media (max-width: 900px) {
          section {
            grid-template-columns: 1fr !important;
            padding: 16px !important;
            gap: 16px !important;
          }
          aside,
          section > div {
            min-height: auto !important;
            padding: 24px !important;
          }
          aside p:last-child {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
