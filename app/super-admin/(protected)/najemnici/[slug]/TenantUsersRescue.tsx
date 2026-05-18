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
  joinedAt: string;
}

function czechDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
}

function initials(u: UserRow): string {
  return ((u.firstName[0] ?? "") + (u.lastName[0] ?? "")).toUpperCase() || "?";
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
  const noAdmin = adminCount === 0;

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
      {/* Breadcrumb */}
      <Link
        href="/super-admin/najemnici"
        className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-500 hover:text-slate-900 transition mb-4"
      >
        <MIcon name="arrow_back" size={15} />
        Kantýny
        <span className="text-slate-300 mx-1">/</span>
        <span className="text-slate-700">{tenantName}</span>
      </Link>

      {/* Title row */}
      <div className="flex items-end justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <span
            className="inline-flex items-center justify-center rounded-2xl"
            style={{
              width: 48, height: 48,
              background: "linear-gradient(135deg, rgba(245,158,11,0.18), rgba(234,88,12,0.12))",
              border: "1px solid rgba(245,158,11,0.28)",
            }}
          >
            <MIcon name="health_and_safety" size={26} fill style={{ color: "#b45309" }} />
          </span>
          <div>
            <h2 className="font-display font-extrabold text-[22px] text-slate-900 leading-tight">Záchrana — uživatelé kantýny</h2>
            <p className="text-[12.5px] text-slate-500">
              <span className="font-mono">/{tenantSlug}</span> · {users.length} uživatelů ·{" "}
              <strong className="text-slate-700">{adminCount}</strong> aktivních adminů
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/t/${tenantSlug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-xl glass-soft text-slate-600 hover:text-slate-900 transition-colors"
          >
            <MIcon name="open_in_new" size={14} /> Otevřít kantýnu
          </a>
        </div>
      </div>

      {/* No-admin warning */}
      {noAdmin && (
        <div
          className="rounded-2xl px-4 py-3 mb-4 flex items-start gap-3"
          style={{
            background: "linear-gradient(135deg, rgba(239,68,68,0.12), rgba(220,38,38,0.06))",
            border: "1px solid rgba(239,68,68,0.28)",
          }}
        >
          <span
            className="inline-flex items-center justify-center rounded-xl shrink-0"
            style={{ width: 32, height: 32, background: "rgba(239,68,68,0.16)" }}
          >
            <MIcon name="error" size={18} fill style={{ color: "#dc2626" }} />
          </span>
          <div className="flex-1">
            <div className="font-display font-bold text-[13.5px] text-rose-900 leading-tight">Kantýna nemá žádného admina</div>
            <div className="text-[12px] text-rose-800/80 mt-0.5">
              Povyšte aspoň jednoho uživatele na admina, aby kantýna mohla pokračovat v provozu.
            </div>
          </div>
        </div>
      )}

      {error && (
        <div
          className="rounded-xl px-4 py-3 mb-4 text-[13px] text-red-700"
          style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)" }}
        >
          {error}
        </div>
      )}

      {/* Table */}
      <div className="glass rounded-3xl overflow-hidden">
        <table className="k-table">
          <thead>
            <tr>
              <th style={{ width: "34%" }}>Uživatel</th>
              <th>E-mail</th>
              <th>Role</th>
              <th>Připojen</th>
              <th style={{ textAlign: "right" }}>Akce</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isAdmin = user.role === "admin";
              return (
                <tr key={user.id} style={!user.active ? { opacity: 0.45 } : undefined}>
                  <td className="py-3.5">
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-flex items-center justify-center rounded-full shrink-0 font-display font-bold text-white text-[12.5px]"
                        style={{
                          width: 36, height: 36,
                          background: isAdmin
                            ? "linear-gradient(135deg,#fb923c,#EA580C)"
                            : "linear-gradient(135deg,#94a3b8,#64748b)",
                          boxShadow: "0 0 0 2px rgba(255,255,255,0.85)",
                        }}
                      >
                        {initials(user)}
                      </span>
                      <div>
                        <div className="font-semibold text-[13px] text-slate-900">
                          {user.firstName} {user.lastName}
                        </div>
                        {!user.active && <div className="text-[11px] italic text-slate-500">anonymizováno</div>}
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5">
                    {user.email
                      ? <span className="text-[12.5px] text-slate-700">{user.email}</span>
                      : <span className="text-[12px] italic text-slate-400">—</span>}
                  </td>
                  <td className="py-3.5">
                    {isAdmin ? (
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(245,158,11,0.16)", color: "#b45309" }}
                      >
                        <MIcon name="shield_person" size={11} fill /> Admin
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(148,163,184,0.18)", color: "#475569" }}
                      >
                        <MIcon name="person" size={11} fill /> Uživatel
                      </span>
                    )}
                  </td>
                  <td className="py-3.5">
                    <span className="text-[12.5px] text-slate-700 tabular-nums">{czechDate(user.joinedAt)}</span>
                  </td>
                  <td className="py-3.5" style={{ textAlign: "right" }}>
                    {user.active && (
                      isAdmin ? (
                        <button
                          onClick={() => setConfirm({ user, newRole: "user" })}
                          disabled={isPending}
                          className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold font-display px-2.5 py-1.5 rounded-xl glass-soft text-slate-700 transition"
                        >
                          <MIcon name="remove_moderator" size={13} /> Odebrat admin
                        </button>
                      ) : (
                        <button
                          onClick={() => setConfirm({ user, newRole: "admin" })}
                          disabled={isPending}
                          className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold font-display px-2.5 py-1.5 rounded-xl transition text-white"
                          style={{
                            background: "linear-gradient(135deg,#F59E0B,#EA580C)",
                            boxShadow: "0 6px 14px -6px rgba(234,88,12,0.4)",
                          }}
                        >
                          <MIcon name="add_moderator" size={13} fill /> Povýšit
                        </button>
                      )
                    )}
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-[13px] text-slate-400">
                  Kantýna nemá žádné uživatele.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div
          className="px-4 py-2.5 border-t border-white/50 flex items-center justify-between text-[11.5px] text-slate-500"
          style={{ background: "rgba(255,255,255,0.25)" }}
        >
          <span>Celkem <strong className="text-slate-700">{users.length}</strong> uživatelů</span>
          <span className="inline-flex items-center gap-1.5">
            <MIcon name="info" size={13} className="text-slate-400" />
            Akce v záchranném režimu se zapisují do audit logu.
          </span>
        </div>
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
