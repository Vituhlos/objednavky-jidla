"use client";

import { useState, useTransition } from "react";
import MIcon from "@/app/components/MIcon";
import { ConfirmModal } from "@/app/components/ConfirmModal";
import type { DepartmentInfo } from "@/lib/departments";
import {
  actionAddDepartment,
  actionUpdateDepartment,
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
      {/* Stat cards */}
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

      {/* Join URL */}
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
          <button onClick={copy} className="v2-btn v2-btn--secondary text-[12px] py-1.5 px-3 flex items-center gap-1.5">
            <MIcon name={copied ? "check" : "content_copy"} size={14} />
            {copied ? "Zkopírováno" : "Kopírovat URL"}
          </button>
          <button
            onClick={() => setRegenConfirm(true)}
            disabled={isPending}
            className="v2-btn v2-btn--secondary text-[12px] py-1.5 px-3 flex items-center gap-1.5 text-amber-700"
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
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [anonymizeConfirm, setAnonymizeConfirm] = useState<UserRow | null>(null);
  const [roleConfirm, setRoleConfirm] = useState<{ user: UserRow; newRole: "user" | "admin" } | null>(null);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.firstName.toLowerCase().includes(q) ||
      u.lastName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
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
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, firstName: "Anonymní", lastName: "uživatel", email: "–", active: false, role: "user" } : u));
    });
  };

  return (
    <div>
      <div className="mb-3">
        <input
          className="modal-input w-full max-w-xs text-[13px]"
          placeholder="Hledat jméno nebo e-mail…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {error && <p className="text-[12px] text-red-600 mb-2">{error}</p>}
      <div className="glass-soft rounded-2xl overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50/60">
              <th className="text-left px-4 py-2.5 text-[11px] font-bold text-stone-500 uppercase tracking-wide">Jméno</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-bold text-stone-500 uppercase tracking-wide hidden sm:table-cell">E-mail</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-bold text-stone-500 uppercase tracking-wide">Role</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => (
              <tr key={user.id} className={`border-b border-stone-100 last:border-0 ${!user.active ? "opacity-50" : ""}`}>
                <td className="px-4 py-3">
                  <div className="font-semibold text-[13px] text-stone-800">
                    {user.firstName} {user.lastName}
                    {!user.active && <span className="ml-2 text-[11px] text-stone-400 italic">anonymizováno</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-[12px] text-stone-500 hidden sm:table-cell">{user.email}</td>
                <td className="px-4 py-3">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${user.role === "admin" ? "bg-amber-50 text-amber-700" : "bg-stone-100 text-stone-500"}`}>
                    {user.role === "admin" ? "Admin" : "Uživatel"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {user.active && (
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => setRoleConfirm({ user, newRole: user.role === "admin" ? "user" : "admin" })}
                        disabled={isPending}
                        className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors"
                        title={user.role === "admin" ? "Odebrat admin" : "Povýšit na admin"}
                      >
                        <MIcon name={user.role === "admin" ? "person_remove" : "manage_accounts"} size={15} />
                      </button>
                      <button
                        onClick={() => setAnonymizeConfirm(user)}
                        disabled={isPending}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-stone-400 hover:text-red-500 transition-colors"
                        title="Anonymizovat (GDPR)"
                      >
                        <MIcon name="person_off" size={15} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-[13px] text-stone-400">Žádní uživatelé.</td>
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
      setSmtpMsg("Uloženo");
    });
  };

  const handleSmtpTest = async (e: React.MouseEvent<HTMLButtonElement>) => {
    const form = (e.currentTarget.closest("form") as HTMLFormElement);
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
      <div className="glass-soft rounded-2xl p-5 mb-4">
        <h3 className="font-display font-semibold text-[14px] text-stone-800 mb-3 flex items-center gap-2">
          <MIcon name="mail" size={16} className="text-amber-600" />
          SMTP override
        </h3>
        <p className="text-[12px] text-stone-400 mb-3">Vlastní SMTP server pro odesílání e-mailů místo výchozího.</p>
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
              <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wide">{f.label}</span>
              <input className="modal-input" name={f.name} placeholder={f.placeholder} type={f.type ?? "text"} autoComplete="off" />
            </label>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <button type="button" onClick={handleSmtpTest} className="v2-btn v2-btn--secondary text-[12px] py-1.5 px-3">
            Testovat
          </button>
          <button type="submit" disabled={isPending} className="v2-btn v2-btn--primary text-[12px] py-1.5 px-3">
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
  { id: "prehled",   label: "Přehled",    icon: "dashboard" },
  { id: "uzivatele", label: "Uživatelé",  icon: "groups" },
  { id: "oddeleni",  label: "Oddělení",   icon: "corporate_fare" },
  { id: "nastaveni", label: "Nastavení",  icon: "settings" },
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

  return (
    <div className="k-shell">
      <div className="v2-content max-w-3xl mx-auto pb-24">
        <div className="flex items-center gap-2 mb-5 mt-2">
          <MIcon name="admin_panel_settings" size={20} fill className="text-amber-600" />
          <h1 className="font-display font-bold text-xl text-stone-900">
            Admin — {tenantName}
          </h1>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mb-5 bg-stone-100 rounded-2xl p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all ${
                activeTab === tab.id
                  ? "bg-white text-stone-800 shadow-sm"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              <MIcon name={tab.icon} size={15} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
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
