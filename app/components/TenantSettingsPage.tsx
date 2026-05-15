"use client";

import { useState, useTransition } from "react";
import type { AppSettings } from "@/lib/settings";
import type { DepartmentInfo } from "@/lib/departments";
import {
  actionSaveSettings,
  actionAddDepartment,
  actionUpdateDepartment,
  actionDeleteDepartment,
  actionReorderDepartments,
} from "@/app/actions";
import MIcon from "./MIcon";
import { ConfirmModal } from "./ConfirmModal";

const ACCENT_OPTIONS = [
  { value: "blue",   label: "Modrá" },
  { value: "rust",   label: "Rezavá" },
  { value: "green",  label: "Zelená" },
  { value: "amber",  label: "Jantarová" },
  { value: "navy",   label: "Námořnická" },
  { value: "orange", label: "Oranžová" },
  { value: "red",    label: "Červená" },
];

const ACCENT_COLORS: Record<string, string> = {
  blue: "#3B82F6", rust: "#C2654D", green: "#4F8A53",
  amber: "#F59E0B", navy: "#1e40af", orange: "#EA580C", red: "#dc2626",
};

interface Props {
  departments: DepartmentInfo[];
  settings: AppSettings;
  tenantSlug: string;
}

export default function TenantSettingsPage({ departments: initialDepts, settings, tenantSlug }: Props) {
  const [departments, setDepartments] = useState(initialDepts);
  const [deptEditId, setDeptEditId] = useState<number | null>(null);
  const [deptDeleteConfirm, setDeptDeleteConfirm] = useState<DepartmentInfo | null>(null);
  const [deptError, setDeptError] = useState("");
  const [smtpStatus, setSmtpStatus] = useState<"idle" | "ok" | "error">("idle");
  const [smtpMsg, setSmtpMsg] = useState("");
  const [saveMsg, setSaveMsg] = useState("");
  const [isPending, startTransition] = useTransition();

  // ── SMTP form state ──────────────────────────────────────────────────────
  const [smtp, setSmtp] = useState({
    host: settings.smtpHost ?? "",
    port: settings.smtpPort ?? "587",
    user: settings.smtpUser ?? "",
    pass: settings.smtpPass ?? "",
    from: settings.smtpFrom ?? "",
    replyTo: settings.smtpReplyTo ?? "",
    secure: settings.smtpSecure ?? "false",
  });

  const handleSmtpTest = async () => {
    setSmtpStatus("idle");
    setSmtpMsg("Testuji připojení…");
    try {
      const res = await fetch(`/t/${tenantSlug}/api/smtp-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host: smtp.host, port: smtp.port, user: smtp.user, pass: smtp.pass, secure: smtp.secure }),
      });
      const j = await res.json() as { ok: boolean; error?: string };
      setSmtpStatus(j.ok ? "ok" : "error");
      setSmtpMsg(j.ok ? "Připojení úspěšné ✓" : (j.error ?? "Neznámá chyba"));
    } catch (e) {
      setSmtpStatus("error");
      setSmtpMsg("Chyba sítě");
    }
  };

  const handleSmtpSave = () => {
    startTransition(async () => {
      setSaveMsg("");
      await actionSaveSettings({
        smtpHost: smtp.host,
        smtpPort: smtp.port,
        smtpUser: smtp.user,
        smtpPass: smtp.pass,
        smtpFrom: smtp.from,
        smtpReplyTo: smtp.replyTo,
        smtpSecure: smtp.secure,
      });
      setSaveMsg("Uloženo");
    });
  };

  // ── Departments ──────────────────────────────────────────────────────────
  const handleAddDept = async () => {
    setDeptError("");
    const name = prompt("Název (interní klíč, bez diakritiky):");
    if (!name) return;
    const label = prompt("Zobrazovaný název:") ?? name;
    try {
      await actionAddDepartment({ name, label, emailLabel: label, accent: "blue" });
      const res = await fetch("/api/order-refresh");
      const fresh = await res.json() as { departments: DepartmentInfo[] };
      if (fresh.departments) setDepartments(fresh.departments);
    } catch (e) {
      setDeptError(e instanceof Error ? e.message : "Chyba");
    }
  };

  const handleDeleteDept = async (dept: DepartmentInfo) => {
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
    <div className="k-shell">
      <div className="v2-content max-w-2xl mx-auto pb-24">
        <h1 className="font-display font-bold text-xl text-stone-900 mb-6 mt-2">Nastavení firmy</h1>

        {/* ── SMTP override ─────────────────────────────────────────────── */}
        <section className="glass-soft rounded-2xl p-5 mb-4">
          <h2 className="font-display font-semibold text-[15px] text-stone-800 mb-3 flex items-center gap-2">
            <MIcon name="mail" size={18} className="text-amber-600" />
            E-mail (SMTP override)
          </h2>
          <p className="text-[12px] text-stone-400 mb-3">
            Pokud vyplníte, objednávky budou odesílány přes tento server místo výchozího.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wide">SMTP server</span>
              <input className="modal-input" value={smtp.host} onChange={(e) => setSmtp({ ...smtp, host: e.target.value })} placeholder="smtp.gmail.com" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wide">Port</span>
              <input className="modal-input" value={smtp.port} onChange={(e) => setSmtp({ ...smtp, port: e.target.value })} placeholder="587" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wide">Uživatel</span>
              <input className="modal-input" value={smtp.user} onChange={(e) => setSmtp({ ...smtp, user: e.target.value })} type="email" autoComplete="off" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wide">Heslo</span>
              <input className="modal-input" value={smtp.pass} onChange={(e) => setSmtp({ ...smtp, pass: e.target.value })} type="password" autoComplete="new-password" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wide">Od (From)</span>
              <input className="modal-input" value={smtp.from} onChange={(e) => setSmtp({ ...smtp, from: e.target.value })} placeholder="Kancelář &lt;office@firma.cz&gt;" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wide">Reply-To</span>
              <input className="modal-input" value={smtp.replyTo} onChange={(e) => setSmtp({ ...smtp, replyTo: e.target.value })} type="email" />
            </label>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={handleSmtpTest} className="v2-btn v2-btn--secondary text-[12px] py-1.5 px-3">
              Testovat připojení
            </button>
            <button onClick={handleSmtpSave} disabled={isPending} className="v2-btn v2-btn--primary text-[12px] py-1.5 px-3">
              {isPending ? "Ukládám…" : "Uložit"}
            </button>
          </div>
          {smtpMsg && (
            <p className={`mt-2 text-[12px] font-medium ${smtpStatus === "ok" ? "text-green-600" : smtpStatus === "error" ? "text-red-600" : "text-stone-500"}`}>
              {smtpMsg}
            </p>
          )}
          {saveMsg && <p className="mt-1 text-[12px] text-stone-500">{saveMsg}</p>}
        </section>

        {/* ── Departments ───────────────────────────────────────────────── */}
        <section className="glass-soft rounded-2xl p-5 mb-4">
          <h2 className="font-display font-semibold text-[15px] text-stone-800 mb-3 flex items-center gap-2">
            <MIcon name="corporate_fare" size={18} className="text-amber-600" />
            Oddělení
          </h2>
          {deptError && <p className="text-[12px] text-red-600 mb-2">{deptError}</p>}
          <div className="flex flex-col gap-2">
            {departments.map((dept, idx) => (
              <div key={dept.id} className={`flex items-center gap-2 p-2.5 rounded-xl glass-btn ${!dept.active ? "opacity-50" : ""}`}>
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: ACCENT_COLORS[dept.accent] ?? "#999" }}
                />
                <span className="flex-1 font-display font-semibold text-[13px] text-stone-800">{dept.label}</span>
                <button onClick={() => handleMoveUp(idx)} disabled={idx === 0} className="p-1 rounded-lg hover:bg-white/60 disabled:opacity-30">
                  <MIcon name="arrow_upward" size={15} className="text-stone-400" />
                </button>
                <button onClick={() => handleMoveDown(idx)} disabled={idx === departments.length - 1} className="p-1 rounded-lg hover:bg-white/60 disabled:opacity-30">
                  <MIcon name="arrow_downward" size={15} className="text-stone-400" />
                </button>
                <button
                  onClick={() => setDeptDeleteConfirm(dept)}
                  className="p-1 rounded-lg hover:bg-red-50 text-stone-400 hover:text-red-500"
                >
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
        </section>

        {deptDeleteConfirm && (
          <ConfirmModal
            title="Smazat oddělení"
            message={`Opravdu smazat oddělení „${deptDeleteConfirm.label}"? Tuto akci nelze vrátit.`}
            confirmLabel="Smazat"
            onConfirm={() => handleDeleteDept(deptDeleteConfirm)}
            onClose={() => setDeptDeleteConfirm(null)}
          />
        )}
      </div>
    </div>
  );
}
