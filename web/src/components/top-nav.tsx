"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  getLastWorkflowCustomerId,
  getRuntimeActor,
  logout,
  subscribeLastWorkflowCustomer,
  subscribeRuntimeActor,
} from "@/lib/service";

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [actor, setActor] = useState(() => ({ userName: "", role: "" }));
  const [workflowHref, setWorkflowHref] = useState<string>(() => {
    const customerId = getLastWorkflowCustomerId();
    return customerId ? `/workflow?customer=${customerId}` : "/workflow";
  });

  useEffect(() => {
    queueMicrotask(() => {
      setActor({
        userName: getRuntimeActor().userName,
        role: getRuntimeActor().role,
      });
      setReady(true);
    });
  }, []);

  useEffect(
    () =>
      subscribeRuntimeActor(() => {
        const next = getRuntimeActor();
        setActor({ userName: next.userName, role: next.role });
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
    ...(actor.role === "admin" ? [{ href: "/admin/users", label: "Users" }] : []),
  ];

  const displayName = ready ? actor.userName || "Signed in" : "…";
  const displayRole = ready ? actor.role || "…" : "…";

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
            const base = link.href.split("?")[0] ?? link.href;
            const isActive = pathname.startsWith(base);

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
        <div style={{ display: "grid", justifyItems: "end", gap: "0.2rem" }}>
          <span className="muted-copy" style={{ fontSize: "0.85rem" }} suppressHydrationWarning>
            {displayName} ({displayRole})
          </span>
          <div className="button-row button-row--compact">
            <button
              type="button"
              className="button-secondary"
              style={{ padding: "0.45rem 0.8rem" }}
              onClick={() => {
                logout();
                router.replace("/login");
              }}
            >
              Log out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
