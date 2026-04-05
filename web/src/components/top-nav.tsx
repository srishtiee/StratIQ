"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  getLastWorkflowCustomerId,
  getRuntimeActor,
  setRuntimeActor,
  subscribeLastWorkflowCustomer,
  subscribeRuntimeActor,
} from "@/lib/service";
const enableRoleSwitcher = process.env.NEXT_PUBLIC_STRATIQ_ENABLE_ROLE_SWITCHER === "true";
const roles = ["executive", "approver", "analyst", "admin", "viewer"] as const;

export function TopNav() {
  const pathname = usePathname();
  const [role, setRole] = useState<string>(() => getRuntimeActor().role);
  const [workflowHref, setWorkflowHref] = useState<string>(() => {
    const customerId = getLastWorkflowCustomerId();
    return customerId ? `/workflow?customer=${customerId}` : "/workflow";
  });

  useEffect(
    () =>
      subscribeRuntimeActor(() => {
        setRole(getRuntimeActor().role);
        const customerId = getLastWorkflowCustomerId();
        setWorkflowHref(customerId ? `/workflow?customer=${customerId}` : "/workflow");
      }),
    [],
  );
  useEffect(
    () =>
      subscribeLastWorkflowCustomer(() => {
        const customerId = getLastWorkflowCustomerId();
        setWorkflowHref(customerId ? `/workflow?customer=${customerId}` : "/workflow");
      }),
    [],
  );

  const links = [
    { href: "/dashboard", label: "Dashboard" },
    { href: workflowHref, label: "Workflow" },
    { href: "/approvals", label: "Approvals" },
    { href: "/audit", label: "Audit" },
  ];

  const onRoleChange = (nextRole: string) => {
    setRole(nextRole);
    setRuntimeActor({
      role: nextRole,
      userId: `demo-${nextRole}`,
      userName: `Demo ${nextRole[0].toUpperCase()}${nextRole.slice(1)}`,
    });
  };

  return (
    <header className="top-nav">
      <div className="top-nav__inner">
        <div className="brand">
          <div className="brand-mark">S</div>
          <div className="brand-copy">
            <h1>StratIQ</h1>
            <p>CXO churn workflow foundation</p>
          </div>
        </div>

        <nav className="nav-links" aria-label="Primary navigation">
          {links.map((link) => {
            const isActive = pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`nav-link${isActive ? " is-active" : ""}`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        {enableRoleSwitcher ? (
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontSize: "0.9rem",
              color: "var(--text-muted)",
            }}
          >
            Role
            <select
              value={role}
              onChange={(event) => onRoleChange(event.target.value)}
              style={{
                borderRadius: "999px",
                border: "1px solid var(--stroke)",
                padding: "0.35rem 0.75rem",
                background: "white",
              }}
            >
              {roles.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span className="muted-copy" style={{ fontSize: "0.85rem" }}>
            Role: {role}
          </span>
        )}
      </div>
    </header>
  );
}
