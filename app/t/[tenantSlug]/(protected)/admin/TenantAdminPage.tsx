"use client";

import { useState, useTransition } from "react";
import MIcon from "@/app/components/MIcon";
import { ConfirmModal } from "@/app/components/ConfirmModal";
import type { DepartmentInfo } from "@/lib/departments";
import {
  actionAddDepartment,
  actionDeleteDepartment,
  actionReorderDepartments,
  actionSaveSettings,
} from "@/app/actions";
import {
  actionChangeUserRole,
  actionAnonymizeUser,
  actionRegenerateJoinCode,
} from "./actions";

const ACCENT_COLORS: Record<string, string> = {
  blue: "#3B82F6", rust: "#C2654D", green: "#4F8A53",
  amber: "#F59E0B", navy: "#1e40af", orange: "#EA580C", red: "#dc2626",
};

type Tab = "prehled" | "uzivatele" | "oddeleni" | "nastaveni";
type UserFilter = "all" | "admin" | "inactive";

interface UserRow {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: "user" | "admin";
  active: boolean;
  createdAt: string;
}

interface Props {
  tenantSlug: string;
  tenantName: string;
  joinCode: string;
  users: UserRow[];
  userCount: number;
  ordersThisMonth: number;
  activeToday: number;
  departments: DepartmentInfo[];
}

function initials(u: UserRow): string {
  return ((u.firstName[0] ?? "") + (u.lastName[0] ?? "")).toUpperCase();
}

// ── Tab: Přehled ──────────────────────────────────────────────────────────────

function TabPrehled({
  tenantSlug,
  tenantName,
  joinCode: initialCode,
  userCount,
  ordersThisMonth,
  activeToday,
}: {
  tenantSlug: string;
  tenantName: string;
  joinCode: string;
  userCount: number;
  ordersThisMonth: number;
  activeToday: number;
}) {
  const [code, setCode] = useState(initialCode);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [regenConfirm, setRegenConfirm] = useState(false);

  const joinUrl = typeof window !== "undefined"
    ? `${window.location.origin}/join/${code}`
    : `/join/${code}`;

  const copy = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const regen = () => {
    setRegenConfirm(false);
    startTransition(async () => {
      const result = await actionRegenerateJoinCode(tenantSlug);
      if (result.code) setCode(result.code);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Aktivní uživatelé", value: userCount, icon: "groups" },
          { label: "Objednávek (měsíc)", value: ordersThisMonth, icon: "receipt_long" },
          { label: "Aktivních dnes", value: activeToday, icon: "today" },
        ].map((s) => (
          <div key={s.label} className="glass-soft rounded-2xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-amber-50">
              <MIcon name={s.icon} size={20} className="text-amber-600" />
            </div>
            <div>
              <div className="font-display font-bold text-xl text-stone-900 leading-tight">{s.value}</div>
              <div className="text-[11px] text-stone-500">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="glass-soft rounded-2xl p-5">
        <h3 className="font-display font-semibold text-[14px] text-stone-800 mb-3 flex items-center gap-2">
          <MIcon name="link" size={16} className="text-amber-600" />
          Přístupový odkaz ({tenantName})
        </h3>
        <div className="flex items-center gap-2 bg-stone-50 rounded-xl px-3 py-2 mb-3">
          <code className="text-[12px] text-stone-600 flex-1 truncate">/join/{code}</code>
          <button onClick={copy} className="p-1 rounded-lg hover:bg-stone-200 text-stone-500 hover:text-stone-700 transition-colors shrink-0">
            <MIcon name={copied ? "check" : "content_copy"} size={15} />
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={copy}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-xl glass-soft text-slate-700 transition"
          >
            <MIcon name={copied ? "check" : "content_copy"} size={14} />
            {copied ? "Zkopírováno" : "Kopírovat URL"}
          </button>
          <button
            onClick={() => setRegenConfirm(true)}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-xl glass-soft text-amber-700 transition"
          >
            <MIcon name="refresh" size={14} />
            Nový kód
          </button>
        </div>
      </div>

      {regenConfirm && (
        <ConfirmModal
          title="Vygenerovat nový kód"
          message="Starý odkaz přestane fungovat. Nový kód bude potřeba sdílet znovu."
          confirmLabel="Vygenerovat"
          onConfirm={regen}
          onClose={() => setRegenConfirm(false)}
        />
      )}
    </div>
  );
}

// ── Tab: Uživatelé ────────────────────────────────────────────────────────────

function TabUzivatele({ tenantSlug, users: initialUsers }: { tenantSlug: string; users: UserRow[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<UserFilter>("all");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [anonymizeConfirm, setAnonymizeConfirm] = useState<UserRow | null>(null);
  const [roleConfirm, setRoleConfirm] = useState<{ user: UserRow; newRole: "user" | "admin" } | null>(null);

  const adminCount = users.filter((u) => u.role === "admin" && u.active).length;
  const noAdmin = adminCount === 0;

  const filtered = users.filter((u) => {
    if (filter === "admin" && u.role !== "admin") return false;
    if (filter === "inactive" && u.active) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        u.firstName.toLowerCase().includes(q) ||
        u.lastName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleRoleChange = (user: UserRow, newRole: "user" | "admin") => {
    setRoleConfirm(null);
    setError("");
    startTransition(async () => {
      const result = await actionChangeUserRole(tenantSlug, user.id, newRole);
      if (result.error) { setError(result.error); return; }
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, role: newRole } : u));
    });
  };

  const handleAnonymize = (user: UserRow) => {
    setAnonymizeConfirm(null);
    setError("");
    startTransition(async () => {
      const result = await actionAnonymizeUser(tenantSlug, user.id);
      if (result.error) { setError(result.error); return; }
      setUsers((prev) => prev.map((u) =>
        u.id === user.id
          ? { ...u, firstName: "Anonymní", lastName: "uživatel", email: "–", active: false, role: "user" }
          : u
      ));
    });
  };

  return (
    <div>
      {noAdmin && (
        <div
          className="rounded-2xl px-4 py-3 mb-4 flex items-start gap-3"
          style={{
            background: "linear-gradient(135deg, rgba(239,68,68,0.12), rgba(220,38,38,0.06))",
            border: "1px solid rgba(239,68,68,0.28)",
          }}
        >
          <MIcon name="error" size={18} fill className="text-red-600 mt-0.5 shrink-0" />
          <div className="text-[12.5px] text-rose-900">
            <strong>Kantýna nemá žádného admina.</strong> Povyšte aspoň jednoho uživatele, aby kantýna mohla fungovat.
          </div>
        </div>
      )}

      {/* Search + filter bar */}
      <div className="glass-soft rounded-2xl flex items-center gap-2 px-3 py-2 mb-4">
        <MIcon name="search" size={17} className="text-slate-400 ml-1 shrink-0" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Hledat podle jména nebo e-mailu…"
          className="flex-1 bg-transparent outline-none text-[13.5px] placeholder:text-slate-400"
        />
        <div className="flex items-center gap-1 ml-2 pr-1">
          {(["all", "admin", "inactive"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`text-[12px] font-semibold px-3 py-1 rounded-xl transition ${
                filter === k ? "tab-active text-amber-900" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {k === "all" ? "Vše" : k === "admin" ? "Admini" : "Neaktivní"}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-[12px] text-red-600 mb-2">{error}</p>}

      {/* Table */}
      <div className="glass rounded-3xl overflow-hidden">
        <table className="k-table">
          <thead>
            <tr>
              <th style={{ width: "36%" }}>Uživatel</th>
              <th className="hidden sm:table-cell">E-mail</th>
              <th>Role</th>
              <th style={{ textAlign: "right" }}>Akce</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => {
              const isAdmin = user.role === "admin";
              return (
                <tr key={user.id} style={!user.active ? { opacity: 0.55 } : undefined}>
                  <td className="py-3.5">
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-flex items-center justify-center rounded-full shrink-0 font-display font-bold text-white text-[12px]"
                        style={{
                          width: 34, height: 34,
                          background: isAdmin
                            ? "linear-gradient(135deg,#fb923c,#EA580C)"
                            : "linear-gradient(135deg,#60a5fa,#3B82F6)",
                          boxShadow: "0 0 0 2px rgba(255,255,255,0.85)",
                        }}
                      >
                        {initials(user)}
                      </span>
                      <div>
                        <div className="font-semibold text-[13px] text-slate-900">{user.firstName} {user.lastName}</div>
                        {!user.active && <div className="text-[11px] italic text-slate-500">anonymizováno</div>}
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 hidden sm:table-cell">
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
                        <MIcon name="shield_person" size={12} fill /> Admin
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(148,163,184,0.18)", color: "#475569" }}
                      >
                        <MIcon name="person" size={12} fill /> Uživatel
                      </span>
                    )}
                  </td>
                  <td className="py-3.5" style={{ textAlign: "right" }}>
                    {user.active && (
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        {isAdmin ? (
                          <button
                            type="button"
                            onClick={() => setRoleConfirm({ user, newRole: "user" })}
                            disabled={isPending}
                            className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold font-display px-2.5 py-1.5 rounded-xl glass-soft text-slate-700 transition"
                          >
                            <MIcon name="remove_moderator" size={13} /> Odebrat admin
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setRoleConfirm({ user, newRole: "admin" })}
                            disabled={isPending}
                            className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold font-display px-2.5 py-1.5 rounded-xl transition text-white"
                            style={{
                              background: "linear-gradient(135deg,#F59E0B,#EA580C)",
                              boxShadow: "0 6px 14px -6px rgba(234,88,12,0.4)",
                            }}
                          >
                            <MIcon name="add_moderator" size={13} fill /> Povýšit
                          </button>
                        )}
                        <button
                          onClick={() => setAnonymizeConfirm(user)}
                          disabled={isPending}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                          title="Anonymizovat (GDPR)"
                        >
                          <MIcon name="person_off" size={15} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-[13px] text-slate-400">Žádní uživatelé.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {roleConfirm && (
        <ConfirmModal
          title={roleConfirm.newRole === "admin" ? "Povýšit na admina" : "Odebrat admin práva"}
          message={`${roleConfirm.newRole === "admin" ? "Povýšit" : "Degradovat"} uživatele ${roleConfirm.user.firstName} ${roleConfirm.user.lastName}?`}
          confirmLabel={roleConfirm.newRole === "admin" ? "Povýšit" : "Odebrat"}
          onConfirm={() => handleRoleChange(roleConfirm.user, roleConfirm.newRole)}
          onClose={() => setRoleConfirm(null)}
        />
      )}
      {anonymizeConfirm && (
        <ConfirmModal
          title="Anonymizovat uživatele"
          message={`Trvale anonymizovat ${anonymizeConfirm.firstName} ${anonymizeConfirm.lastName}? Jméno a e-mail budou nahrazeny — objednávky zůstanou jako číselné záznamy.`}
          confirmLabel="Anonymizovat"
          onConfirm={() => handleAnonymize(anonymizeConfirm)}
          onClose={() => setAnonymizeConfirm(null)}
        />
      )}
    </div>
  );
}

// ── Tab: Oddělení ─────────────────────────────────────────────────────────────

function TabOddeleni({ tenantSlug, departments: initialDepts }: { tenantSlug: string; departments: DepartmentInfo[] }) {
  const [departments, setDepartments] = useState(initialDepts);
  const [deptDeleteConfirm, setDeptDeleteConfirm] = useState<DepartmentInfo | null>(null);
  const [deptError, setDeptError] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleAddDept = async () => {
    setDeptError("");
    const name = prompt("Název (interní klíč, bez diakritiky):");
    if (!name) return;
    const label = prompt("Zobrazovaný název:") ?? name;
    try {
      await actionAddDepartment({ name, label, emailLabel: label, accent: "blue" });
      const res = await fetch(`/t/${tenantSlug}/api/order-refresh`);
      if (res.ok) {
        const fresh = await res.json() as { departments?: DepartmentInfo[] };
        if (fresh.departments) setDepartments(fresh.departments);
      }
    } catch (e) {
      setDeptError(e instanceof Error ? e.message : "Chyba");
    }
  };

  const handleDelete = async (dept: DepartmentInfo) => {
    setDeptDeleteConfirm(null);
    try {
      await actionDeleteDepartment(dept.id);
      setDepartments((d) => d.filter((x) => x.id !== dept.id));
    } catch (e) {
      setDeptError(e instanceof Error ? e.message : "Chyba");
    }
  };

  const handleMoveUp = (idx: number) => {
    if (idx === 0) return;
    const reordered = [...departments];
    [reordered[idx - 1], reordered[idx]] = [reordered[idx], reordered[idx - 1]];
    setDepartments(reordered);
    startTransition(async () => {
      await actionReorderDepartments(reordered.map((d) => d.id));
    });
  };

  const handleMoveDown = (idx: number) => {
    if (idx === departments.length - 1) return;
    const reordered = [...departments];
    [reordered[idx], reordered[idx + 1]] = [reordered[idx + 1], reordered[idx]];
    setDepartments(reordered);
    startTransition(async () => {
      await actionReorderDepartments(reordered.map((d) => d.id));
    });
  };

  return (
    <div>
      {deptError && <p className="text-[12px] text-red-600 mb-2">{deptError}</p>}
      <div className="flex flex-col gap-2">
        {departments.map((dept, idx) => (
          <div key={dept.id} className={`flex items-center gap-2 p-2.5 rounded-xl glass-btn ${!dept.active ? "opacity-50" : ""}`}>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: ACCENT_COLORS[dept.accent] ?? "#999" }} />
            <span className="flex-1 font-display font-semibold text-[13px] text-stone-800">{dept.label}</span>
            <button onClick={() => handleMoveUp(idx)} disabled={idx === 0} className="p-1 rounded-lg hover:bg-white/60 disabled:opacity-30">
              <MIcon name="arrow_upward" size={15} className="text-stone-400" />
            </button>
            <button onClick={() => handleMoveDown(idx)} disabled={idx === departments.length - 1} className="p-1 rounded-lg hover:bg-white/60 disabled:opacity-30">
              <MIcon name="arrow_downward" size={15} className="text-stone-400" />
            </button>
            <button onClick={() => setDeptDeleteConfirm(dept)} className="p-1 rounded-lg hover:bg-red-50 text-stone-400 hover:text-red-500">
              <MIcon name="delete" size={15} />
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={handleAddDept}
        className="mt-3 flex items-center gap-1.5 text-[12px] font-semibold text-amber-700 hover:text-amber-800"
      >
        <MIcon name="add" size={15} />
        Přidat oddělení
      </button>
      {deptDeleteConfirm && (
        <ConfirmModal
          title="Smazat oddělení"
          message={`Opravdu smazat „${deptDeleteConfirm.label}"?`}
          confirmLabel="Smazat"
          onConfirm={() => handleDelete(deptDeleteConfirm)}
          onClose={() => setDeptDeleteConfirm(null)}
        />
      )}
    </div>
  );
}

// ── Tab: Nastavení ────────────────────────────────────────────────────────────

function TabNastaveni({ tenantSlug }: { tenantSlug: string }) {
  const [smtpMsg, setSmtpMsg] = useState("");
  const [smtpStatus, setSmtpStatus] = useState<"idle" | "ok" | "error">("idle");
  const [isPending, startTransition] = useTransition();

  const handleSmtpSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await actionSaveSettings({
        smtpHost: fd.get("smtpHost") as string,
        smtpPort: fd.get("smtpPort") as string,
        smtpUser: fd.get("smtpUser") as string,
        smtpPass: fd.get("smtpPass") as string,
        smtpFrom: fd.get("smtpFrom") as string,
        smtpReplyTo: fd.get("smtpReplyTo") as string,
      });
      setSmtpMsg("Uloženo ✓");
      setSmtpStatus("ok");
    });
  };

  const handleSmtpTest = async (e: React.MouseEvent<HTMLButtonElement>) => {
    const form = e.currentTarget.closest("form") as HTMLFormElement;
    const fd = new FormData(form);
    setSmtpStatus("idle");
    setSmtpMsg("Testuji připojení…");
    try {
      const res = await fetch(`/t/${tenantSlug}/api/smtp-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: fd.get("smtpHost"), port: fd.get("smtpPort"),
          user: fd.get("smtpUser"), pass: fd.get("smtpPass"),
          secure: fd.get("smtpSecure"),
        }),
      });
      const j = await res.json() as { ok: boolean; error?: string };
      setSmtpStatus(j.ok ? "ok" : "error");
      setSmtpMsg(j.ok ? "Připojení úspěšné ✓" : (j.error ?? "Neznámá chyba"));
    } catch {
      setSmtpStatus("error");
      setSmtpMsg("Chyba sítě");
    }
  };

  return (
    <form onSubmit={handleSmtpSave}>
      <div className="glass rounded-3xl p-5 mb-4">
        <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-white/55">
          <span
            className="inline-flex items-center justify-center rounded-xl shrink-0"
            style={{ width: 32, height: 32, background: "rgba(59,130,246,0.14)" }}
          >
            <MIcon name="mail" size={17} fill className="text-blue-500" />
          </span>
          <div>
            <h3 className="font-display font-bold text-[14.5px] text-slate-900 leading-tight">E-mail</h3>
            <div className="text-[11px] text-slate-500">SMTP server pro odesílání objednávek</div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { name: "smtpHost", label: "SMTP server", placeholder: "smtp.gmail.com" },
            { name: "smtpPort", label: "Port", placeholder: "587" },
            { name: "smtpUser", label: "Uživatel", placeholder: "user@firma.cz", type: "email" },
            { name: "smtpPass", label: "Heslo", type: "password" },
            { name: "smtpFrom", label: "Od (From)", placeholder: "Kancelář <office@firma.cz>" },
            { name: "smtpReplyTo", label: "Reply-To", type: "email" },
          ].map((f) => (
            <label key={f.name} className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{f.label}</span>
              <input className="k-field" name={f.name} placeholder={f.placeholder} type={f.type ?? "text"} autoComplete="off" />
            </label>
          ))}
        </div>
        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={handleSmtpTest}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-xl glass-soft text-slate-700 transition"
          >
            <MIcon name="wifi_tethering" size={14} />
            Testovat
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold font-display px-4 py-2 rounded-2xl text-white transition disabled:opacity-55"
            style={{
              background: "linear-gradient(135deg,#F59E0B,#EA580C)",
              boxShadow: "0 6px 14px -6px rgba(234,88,12,0.4)",
            }}
          >
            <MIcon name="save" size={14} />
            {isPending ? "Ukládám…" : "Uložit"}
          </button>
        </div>
        {smtpMsg && (
          <p className={`mt-2 text-[12px] font-medium ${smtpStatus === "ok" ? "text-green-600" : smtpStatus === "error" ? "text-red-600" : "text-stone-500"}`}>
            {smtpMsg}
          </p>
        )}
      </div>
    </form>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "prehled",   label: "Přehled",   icon: "dashboard" },
  { id: "uzivatele", label: "Uživatelé", icon: "groups" },
  { id: "oddeleni",  label: "Oddělení",  icon: "corporate_fare" },
  { id: "nastaveni", label: "Nastavení", icon: "settings" },
];

export default function TenantAdminPage({
  tenantSlug,
  tenantName,
  joinCode,
  users,
  userCount,
  ordersThisMonth,
  activeToday,
  departments,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("prehled");
  const adminCount = users.filter((u) => u.role === "admin" && u.active).length;
  const activeCount = users.filter((u) => u.active).length;

  return (
    <div className="k-shell">
      {/* Header */}
      <div
        className="px-5 py-3 border-b border-white/50 flex items-center gap-3 shrink-0"
        style={{ background: "rgba(255,255,255,0.28)" }}
      >
        <MIcon name="admin_panel_settings" size={20} fill className="text-amber-600" />
        <h2 className="font-display font-extrabold text-[18px] text-slate-900">Admin — {tenantName}</h2>
        <span className="text-[11.5px] text-slate-500 hidden sm:inline">
          <strong className="text-slate-800">{activeCount}</strong> aktivních ·{" "}
          <strong className="text-slate-800">{adminCount}</strong> adminů
        </span>
      </div>

      <div className="p-5 max-w-3xl mx-auto pb-24">
        {/* Tab bar */}
        <div className="flex gap-1 mb-5 glass-soft rounded-2xl p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all ${
                activeTab === tab.id
                  ? "tab-active text-amber-900"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <MIcon name={tab.icon} size={15} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {activeTab === "prehled" && (
          <TabPrehled
            tenantSlug={tenantSlug}
            tenantName={tenantName}
            joinCode={joinCode}
            userCount={userCount}
            ordersThisMonth={ordersThisMonth}
            activeToday={activeToday}
          />
        )}
        {activeTab === "uzivatele" && (
          <TabUzivatele tenantSlug={tenantSlug} users={users} />
        )}
        {activeTab === "oddeleni" && (
          <TabOddeleni tenantSlug={tenantSlug} departments={departments} />
        )}
        {activeTab === "nastaveni" && (
          <TabNastaveni tenantSlug={tenantSlug} />
        )}
      </div>
    </div>
  );
}
