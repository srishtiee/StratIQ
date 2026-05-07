"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCurrentUser } from "@/lib/user-context";
import { logout } from "@/lib/service";

export function TopNav() {
  const pathname = usePathname();
  const { user } = useCurrentUser();

  const canSeeProtected = user?.role === "admin" || user?.role === "approver";

  const links = [
    { href: "/dashboard", label: "Dashboard", show: true },
    { href: "/workflow", label: "Workflow", show: canSeeProtected },
    { href: "/approvals", label: "Approvals", show: canSeeProtected },
    { href: "/audit", label: "Audit", show: canSeeProtected },
  ];

  return (
    <header className="top-nav">
      <div className="top-nav__inner">
        <div className="brand">
          <div className="brand-mark">S</div>
          <div className="brand-copy">
            <h1>StratIQ</h1>
            <p suppressHydrationWarning>{user ? `${user.name} · ${user.role}` : "Executive Decision Intelligence"}</p>
          </div>
        </div>

        <nav className="nav-links" aria-label="Primary navigation">
          {links
            .filter((link) => link.show)
            .map((link) => {
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
          <button
            className="nav-link"
            onClick={logout}
            style={{ cursor: "pointer", background: "none", border: "none", color: "inherit", font: "inherit" }}
          >
            Logout
          </button>
        </nav>
      </div>
    </header>
  );
}
