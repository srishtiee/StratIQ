"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef } from "react";

interface TraceEvent {
  type: "stage" | "thought";
  agent: string;
  message: string;
}

interface ReasoningTraceProps {
  events: TraceEvent[];
}

export function ReasoningTrace({ events }: ReasoningTraceProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  return (
    <div 
      ref={scrollRef}
      className="reasoning-trace-container" 
      style={{ 
        marginTop: "1.25rem", 
        display: "flex", 
        flexDirection: "column", 
        gap: "0.75rem",
        maxHeight: "32rem",
        overflowY: "auto",
        paddingRight: "0.5rem",
        scrollbarWidth: "thin"
      }}
    >
      <AnimatePresence mode="popLayout">
        {events.map((evt, i) => (
          <motion.div
            key={`${evt.agent}-${i}`}
            initial={{ opacity: 0, x: -10, y: 10 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className={`trace-item trace-item--${evt.type}`}
            style={{
              padding: "1rem",
              borderRadius: "1.2rem",
              background: evt.type === "stage" 
                ? "rgba(255, 255, 255, 0.85)" 
                : "rgba(31, 109, 115, 0.05)",
              border: evt.type === "stage"
                ? "1px solid rgba(23, 49, 63, 0.12)"
                : "1px dashed rgba(31, 109, 115, 0.2)",
              boxShadow: evt.type === "stage" ? "0 4px 12px rgba(0,0,0,0.03)" : "none",
              position: "relative",
              overflow: "hidden"
            }}
          >
            {evt.type === "stage" && (
              <motion.div 
                layoutId="active-indicator"
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: "4px",
                  background: "var(--teal)",
                }}
              />
            )}
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
              <span style={{ 
                fontSize: "0.75rem", 
                fontWeight: 700, 
                textTransform: "uppercase", 
                letterSpacing: "0.05em",
                color: evt.type === "stage" ? "var(--teal)" : "var(--ink-soft)"
              }}>
                {evt.agent}
              </span>
              <span style={{ fontSize: "0.7rem", color: "var(--ink-soft)", opacity: 0.6 }}>
                {evt.type === "stage" ? "Action" : "Internal Thought"}
              </span>
            </div>
            
            <p style={{ 
              fontSize: "0.92rem", 
              lineHeight: 1.5,
              color: evt.type === "stage" ? "var(--ink)" : "var(--ink-soft)",
              fontStyle: evt.type === "thought" ? "italic" : "normal"
            }}>
              {evt.message}
            </p>
          </motion.div>
        ))}
      </AnimatePresence>
      
      {events.length > 0 && events[events.length - 1].type !== "stage" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          style={{ padding: "0.5rem", textAlign: "center" }}
        >
          <span className="dot-loader">Thinking...</span>
        </motion.div>
      )}
    </div>
  );
}
