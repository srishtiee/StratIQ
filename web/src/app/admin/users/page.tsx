"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiError, getRuntimeActor, listUsers, updateUserRole, type AuthUser, type UserRole } from "@/lib/service";

const ROLE_OPTIONS: UserRole[] = ["viewer", "analyst", "approver", "executive", "admin"];

export default function AdminUsersPage() {
  const actor = useMemo(() => getRuntimeActor(), []);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await listUsers();
        setUsers(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load users";
        setError(message);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  async function onRoleChange(userId: string, role: UserRole) {
    try {
      setSavingId(userId);
      setError(null);
      const updated = await updateUserRole(userId, role);
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
    } catch (err) {
      const message =
        err instanceof ApiError && err.status === 403
          ? "Only admins can update roles."
          : err instanceof Error
            ? err.message
            : "Role update failed";
      setError(message);
    } finally {
      setSavingId(null);
    }
  }

  const filteredUsers = users.filter((user) => {
    const roleMatch = roleFilter === "all" || user.role === roleFilter;
    const text = `${user.name} ${user.email} ${user.role}`.toLowerCase();
    const searchMatch = text.includes(search.trim().toLowerCase());
    return roleMatch && searchMatch;
  });

  if (actor.role !== "admin") {
    return (
      <section className="surface-card">
        <div className="section-header">
          <div>
            <h2>User Administration</h2>
            <p className="muted-copy">You need an admin account to access this page.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="surface-card">
      <div className="section-header">
        <div>
          <h2>User Administration</h2>
          <p className="muted-copy">Assign platform roles for authenticated users.</p>
        </div>
      </div>
      <div className="button-row" style={{ marginBottom: "0.9rem" }}>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name, email, or role"
          style={{
            minWidth: "260px",
            borderRadius: "999px",
            border: "1px solid var(--line)",
            padding: "0.55rem 0.9rem",
            background: "white",
          }}
        />
        <select
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value as "all" | UserRole)}
          style={{
            borderRadius: "999px",
            border: "1px solid var(--line)",
            padding: "0.55rem 0.9rem",
            background: "white",
          }}
        >
          <option value="all">All roles</option>
          {ROLE_OPTIONS.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </div>
      {error ? <p className="muted-copy" style={{ color: "#9a3f3f", marginBottom: "0.8rem" }}>{error}</p> : null}
      {loading ? (
        <p className="muted-copy">Loading users...</p>
      ) : filteredUsers.length === 0 ? (
        <p className="muted-copy">No users match the current filters.</p>
      ) : (
        <table className="customer-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td>{user.email || "—"}</td>
                <td>
                  <select
                    value={user.role}
                    onChange={(event) => void onRoleChange(user.id, event.target.value as UserRole)}
                    disabled={savingId === user.id}
                    style={{
                      borderRadius: "999px",
                      border: "1px solid var(--line)",
                      padding: "0.35rem 0.75rem",
                      background: "white",
                    }}
                  >
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
