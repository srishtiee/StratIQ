"use client";

import { motion } from "framer-motion";

interface RiskDialProps {
  label: string;
  score: number;
  color: string;
}

export function RiskDial({ label, score, color }: RiskDialProps) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="risk-dial" style={{ textAlign: "center" }}>
      <div style={{ position: "relative", width: "90px", height: "90px", margin: "0 auto" }}>
        <svg width="90" height="90" viewBox="0 0 90 90">
          <circle
            cx="45"
            cy="45"
            r={radius}
            fill="none"
            stroke="rgba(23, 49, 63, 0.05)"
            strokeWidth="8"
          />
          <motion.circle
            cx="45"
            cy="45"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            strokeLinecap="round"
            transform="rotate(-90 45 45)"
          />
        </svg>
        <div style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column"
        }}>
          <strong style={{ fontSize: "1.1rem" }}>{Math.round(score)}</strong>
        </div>
      </div>
      <span style={{ 
        display: "block", 
        marginTop: "0.5rem", 
        fontSize: "0.75rem", 
        fontWeight: 700, 
        textTransform: "uppercase",
        color: "var(--ink-soft)",
        letterSpacing: "0.05em"
      }}>
        {label}
      </span>
    </div>
  );
}

export function DualRiskEngine({ quantitative, qualitative }: { quantitative: number, qualitative: number }) {
  return (
    <div className="surface-card" style={{ padding: "1.5rem" }}>
      <div className="section-header">
        <div>
          <h3>Dual-Signal Risk Engine</h3>
          <p>Holistic risk assessment combining data signals and contextual sentiment.</p>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginTop: "1rem" }}>
        <RiskDial label="Quantitative" score={quantitative} color="var(--teal)" />
        <RiskDial label="Qualitative" score={qualitative} color="var(--amber)" />
      </div>
      <div style={{ marginTop: "1.5rem", padding: "1rem", background: "rgba(23, 49, 63, 0.03)", borderRadius: "1rem" }}>
        <p style={{ fontSize: "0.88rem", color: "var(--ink-soft)", lineHeight: 1.5 }}>
          <strong>Assessment:</strong> The quantitative engine identifies {quantitative > 50 ? 'high' : 'moderate'} pressure from MRR and usage metrics, while the qualitative engine flags {qualitative > 50 ? 'significant' : 'low'} friction in support and adoption signals.
        </p>
      </div>
    </div>
  );
}
