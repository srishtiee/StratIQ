"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/service";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const success = await login(username, password);
    if (success) {
      router.push("/dashboard");
    } else {
      setError("Invalid username or password");
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card surface-card">
        <div className="login-header">
          <h1 className="hero-title">StratIQ</h1>
          <p className="muted-copy">Executive Decision Intelligence</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. kashish"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <p className="error-message">{error}</p>}

          <button type="submit" className="button-primary" disabled={loading}>
            {loading ? "Authenticating..." : "Sign In"}
          </button>
        </form>

        <div className="login-footer">
          <p className="muted-copy">
            Demo credentials: <strong>kashish</strong> / <strong>password123</strong>
          </p>
        </div>
      </div>

      <style jsx>{`
        .login-page {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: var(--bg-app);
        }
        .login-card {
          width: 100%;
          max-width: 420px;
          padding: 2.5rem;
          border-radius: 1.5rem;
        }
        .login-header {
          text-align: center;
          margin-bottom: 2rem;
        }
        .login-header h1 {
          font-size: 2.5rem;
          margin-bottom: 0.5rem;
          background: var(--gradient-hero);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .form-group label {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-muted);
        }
        .form-group input {
          padding: 0.75rem 1rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.75rem;
          color: var(--text-main);
          font-size: 1rem;
          transition: all 0.2s;
        }
        .form-group input:focus {
          outline: none;
          border-color: var(--brand-primary);
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
        }
        .error-message {
          color: #ef4444;
          font-size: 0.875rem;
          text-align: center;
        }
        .login-footer {
          margin-top: 2rem;
          text-align: center;
          font-size: 0.875rem;
        }
        .button-primary {
          padding: 0.875rem;
          font-size: 1rem;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
