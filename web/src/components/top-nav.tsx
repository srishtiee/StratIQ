"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/workflow", label: "Workflow" },
  { href: "/approvals", label: "Approvals" },
  { href: "/audit", label: "Audit" },
];

export function TopNav() {
  const pathname = usePathname();

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
      </div>
    </header>
  );
}
