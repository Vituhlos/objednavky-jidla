"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import MIcon from "@/app/components/MIcon";
import { ConfirmModal } from "@/app/components/ConfirmModal";
import { saSetTenantUserRole } from "./actions";

interface UserRow {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: "user" | "admin";
  active: boolean;
}

export default function TenantUsersRescue({
  tenantSlug,
  tenantName,
  users: initialUsers,
}: {
  tenantSlug: string;
  tenantName: string;
  users: UserRow[];
}) {
  const [users, setUsers] = useState(initialUsers);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ user: UserRow; newRole: "user" | "admin" } | null>(null);

  const adminCount = users.filter((u) => u.role === "admin" && u.active).length;

  const handleRole = (user: UserRow, newRole: "user" | "admin") => {
    setConfirm(null);
    setError(null);
    startTransition(async () => {
      const result = await saSetTenantUserRole(tenantSlug, user.id, newRole);
      if (result.error) { setError(result.error); return; }
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, role: newRole } : u));
    });
  };

  return (
    <div>
      {/* Back + header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "1.5rem" }}>
        <Link href="/super-admin/najemnici" style={{ display: "flex", alignItems: "center", gap: 4, color: "#9b8474", fontSize: 13, textDecoration: "none" }}>
          <MIcon name="arrow_back" size={16} />
          Nájemníci
        </Link>
        <span style={{ color: "var(--sand)" }}>/</span>
        <span style={{ fontSize: 13, color: "var(--navy)", fontWeight: 600 }}>{tenantName}</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.25rem" }}>
        <MIcon name="shield_person" size={20} fill style={{ color: "#F59E0B" }} />
        <h1 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: "var(--navy)", margin: 0 }}>
          Rescue — uživatelé kantýny
        </h1>
      </div>

      {adminCount === 0 && (
        <div style={{ padding: "0.75rem 1rem", borderRadius: 12, background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.25)", color: "#b91c1c", fontSize: 13, marginBottom: "1rem", display: "flex", alignItems: "center", gap: 8 }}>
          <MIcon name="warning" size={16} fill />
          Kantýna nemá žádného admina — povyšte aspoň jednoho uživatele.
        </div>
      )}

      {error && (
        <div style={{ padding: "0.6rem 0.875rem", borderRadius: 10, background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", color: "#b91c1c", fontSize: 13, marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      <div className="glass" style={{ borderRadius: 16, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--sand)", background: "rgba(22,50,74,0.03)" }}>
              <th style={{ textAlign: "left", padding: "0.65rem 1rem", fontSize: 12, fontWeight: 700, color: "var(--navy)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Uživatel</th>
              <th style={{ textAlign: "left", padding: "0.65rem 1rem", fontSize: 12, fontWeight: 700, color: "var(--navy)", textTransform: "uppercase", letterSpacing: "0.05em", display: "table-cell" }}>E-mail</th>
              <th style={{ textAlign: "left", padding: "0.65rem 1rem", fontSize: 12, fontWeight: 700, color: "var(--navy)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Role</th>
              <th style={{ padding: "0.65rem 1rem" }} />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} style={{ borderBottom: "1px solid var(--sand)", opacity: user.active ? 1 : 0.45 }}>
                <td style={{ padding: "0.75rem 1rem" }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "var(--navy)" }}>
                    {user.firstName} {user.lastName}
                    {!user.active && <span style={{ marginLeft: 6, fontSize: 11, color: "#9b8474", fontStyle: "italic" }}>anonymizováno</span>}
                  </div>
                </td>
                <td style={{ padding: "0.75rem 1rem", fontSize: 13, color: "#9b8474" }}>{user.email}</td>
                <td style={{ padding: "0.75rem 1rem" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: user.role === "admin" ? "rgba(245,158,11,0.12)" : "rgba(0,0,0,0.05)", color: user.role === "admin" ? "#92560a" : "#6b7280" }}>
                    {user.role === "admin" ? "Admin" : "Uživatel"}
                  </span>
                </td>
                <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                  {user.active && (
                    <button
                      onClick={() => setConfirm({ user, newRole: user.role === "admin" ? "user" : "admin" })}
                      disabled={isPending}
                      title={user.role === "admin" ? "Odebrat admin" : "Povýšit na admin"}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: 8, color: "#9b8474", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <MIcon name={user.role === "admin" ? "person_remove" : "manage_accounts"} size={15} />
                      {user.role === "admin" ? "Odebrat admin" : "Povýšit"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: "2rem", textAlign: "center", fontSize: 13, color: "#9b8474" }}>
                  Kantýna nemá žádné uživatele.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {confirm && (
        <ConfirmModal
          title={confirm.newRole === "admin" ? "Povýšit na admina" : "Odebrat admin práva"}
          message={`${confirm.newRole === "admin" ? "Povýšit" : "Degradovat"} ${confirm.user.firstName} ${confirm.user.lastName} (${confirm.user.email})?`}
          confirmLabel={confirm.newRole === "admin" ? "Povýšit" : "Odebrat"}
          onConfirm={() => handleRole(confirm.user, confirm.newRole)}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
