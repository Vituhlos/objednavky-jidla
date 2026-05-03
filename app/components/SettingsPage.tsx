"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import type { AppSettings } from "@/lib/settings";
import type { DepartmentInfo } from "@/lib/departments";
import type { AuditEntry } from "@/lib/audit";
import {
  actionCheckPin,
  actionSaveSettings,
  actionAddDepartment,
  actionUpdateDepartment,
  actionDeleteDepartment,
  actionReorderDepartments,
  actionReopenOrder,
  actionResendOrder,
} from "@/app/actions";
import { ConfirmModal } from "./ConfirmModal";
import MIcon from "./MIcon";

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

const DAY_OPTIONS = [
  { code: "Po", label: "Po" },
  { code: "Út", label: "Út" },
  { code: "St", label: "St" },
  { code: "Čt", label: "Čt" },
  { code: "Pá", label: "Pá" },
];

const ACTION_LABELS: Record<string, string> = {
  row_add: "Přidání řádku",
  row_update: "Úprava řádku",
  row_delete: "Smazání řádku",
  order_send: "Odeslání objednávky",
  order_reopen: "Znovuotevření",
  order_clear: "Vymazání objednávky",
  auto_send: "Auto-odeslání",
  menu_reminder: "Upozornění na chybějící menu",
};

function formatTs(ts: string): string {
  const d = new Date(ts.replace(" ", "T") + "Z");
  return d.toLocaleString("cs-CZ", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Section card ──────────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon?: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-3xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/40" style={{ background: "rgba(245,158,11,0.07)" }}>
        {icon && <MIcon name={icon as "settings"} size={17} fill style={{ color: "#D97706" }} />}
        <span className="font-display font-bold text-[13.5px] text-stone-900">{title}</span>
      </div>
      <div className="p-4 flex flex-col gap-3">{children}</div>
    </div>
  );
}

// ── Field ─────────────────────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11.5px] font-semibold text-stone-600">{label}</span>
      {hint && <span className="text-[10.5px] text-stone-400 -mt-0.5">{hint}</span>}
      {children}
    </div>
  );
}

function EmailListInput({
  defaultValue,
  name,
  placeholder,
}: {
  defaultValue: string;
  name: string;
  placeholder: string;
}) {
  return (
    <input
      className="modal-input"
      defaultValue={defaultValue}
      name={name}
      placeholder={placeholder}
      type="text"
    />
  );
}

// ── Toggle checkbox ───────────────────────────────────────────────────────────

function Toggle({ name, defaultChecked, label }: { name: string; defaultChecked: boolean; label: string }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none">
      <div className="relative shrink-0">
        <input type="checkbox" className="peer sr-only" name={name} defaultChecked={defaultChecked} />
        <div className="w-11 h-[22px] rounded-full transition-colors bg-black/15 peer-checked:[background:linear-gradient(135deg,#F59E0B,#EA580C)]" />
        <div className="absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-[18px]" />
      </div>
      <span className="text-[13px] text-stone-700">{label}</span>
    </label>
  );
}

// ── Department row ────────────────────────────────────────────────────────────

function DeptRow({
  dept, onSave, onDelete, onMoveUp, onMoveDown, isFirst, isLast,
}: {
  dept: DepartmentInfo;
  onSave: (id: number, data: Partial<{ label: string; emailLabel: string; accent: string }>) => void;
  onDelete: (id: number) => void;
  onMoveUp: (id: number) => void;
  onMoveDown: (id: number) => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [label, setLabel] = useState(dept.label);
  const [emailLabel, setEmailLabel] = useState(dept.emailLabel);
  const [accent, setAccent] = useState(dept.accent);
  const dotColor = ACCENT_COLORS[dept.accent] ?? "#94a3b8";

  if (!editing) {
    return (
      <div className="glass-soft rounded-2xl px-3 py-2.5 flex items-center gap-3">
        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: dotColor }} />
        <span className="text-[13px] font-semibold text-stone-800 flex-1 min-w-0 truncate">{dept.label}</span>
        <span className="text-[11px] text-stone-400 hidden sm:inline shrink-0">({dept.name})</span>
        <div className="flex items-center gap-1 shrink-0">
          <button
            className="hidden sm:inline-flex w-7 h-7 rounded-full items-center justify-center text-stone-400 hover:bg-white/60 transition disabled:opacity-30"
            disabled={isFirst} onClick={() => onMoveUp(dept.id)} title="Nahoru" type="button"
          >↑</button>
          <button
            className="hidden sm:inline-flex w-7 h-7 rounded-full items-center justify-center text-stone-400 hover:bg-white/60 transition disabled:opacity-30"
            disabled={isLast} onClick={() => onMoveDown(dept.id)} title="Dolů" type="button"
          >↓</button>
          <button
            className="text-[11.5px] font-semibold px-2.5 py-1.5 rounded-lg glass-btn text-stone-600"
            onClick={() => setEditing(true)} type="button"
          >Upravit</button>
          <button
            className="text-[11.5px] font-semibold px-2.5 py-1.5 rounded-lg text-red-600"
            style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.15)" }}
            onClick={() => setConfirmDelete(true)} type="button"
          >Smazat</button>
        </div>
        {confirmDelete && (
          <ConfirmModal
            message={`Oddělení „${dept.label}" bude trvale smazáno.`}
            onClose={() => setConfirmDelete(false)}
            onConfirm={() => { onDelete(dept.id); setConfirmDelete(false); }}
            title="Smazat oddělení"
          />
        )}
      </div>
    );
  }

  return (
    <div className="glass-soft rounded-2xl p-3 flex flex-col gap-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Field label="Zobrazovaný název">
          <input className="modal-input" onChange={(e) => setLabel(e.target.value)} value={label} />
        </Field>
        <Field label="Název v e-mailu">
          <input className="modal-input" onChange={(e) => setEmailLabel(e.target.value)} value={emailLabel} />
        </Field>
        <Field label="Barva">
          <select className="k-select" onChange={(e) => setAccent(e.target.value)} value={accent}>
            {ACCENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      </div>
      <div className="flex gap-2">
        <button
          className="modal-btn modal-btn--primary"
          onClick={() => { onSave(dept.id, { label, emailLabel, accent }); setEditing(false); }}
          type="button"
        >Uložit</button>
        <button
          className="modal-btn modal-btn--secondary"
          onClick={() => { setLabel(dept.label); setEmailLabel(dept.emailLabel); setAccent(dept.accent); setEditing(false); }}
          type="button"
        >Zrušit</button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SettingsPage({
  settings, departments: initialDepts, auditLog: initialAuditLog, todayOrder,
}: {
  settings: AppSettings;
  departments: DepartmentInfo[];
  auditLog: AuditEntry[];
  todayOrder?: { id: number; status: string };
}) {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [isPending, startTransition] = useTransition();
  const pinInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!unlocked) {
      const t = setTimeout(() => pinInputRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [unlocked]);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [smtpTestStatus, setSmtpTestStatus] = useState<"idle" | "ok" | "error">("idle");
  const [smtpTestMsg, setSmtpTestMsg] = useState("");
  const [departments, setDepartments] = useState<DepartmentInfo[]>(initialDepts);
  const [deptError, setDeptError] = useState<string | null>(null);
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptLabel, setNewDeptLabel] = useState("");
  const [newDeptAccent, setNewDeptAccent] = useState("blue");
  const [showAddDept, setShowAddDept] = useState(false);
  const [reopenDone, setReopenDone] = useState(false);
  const [resendStatus, setResendStatus] = useState<"idle" | "pending" | "done" | "error">("idle");
  const formRef = useRef<HTMLFormElement>(null);

  // Restore state
  type RestoreResult = { orders: number; orderRows: number; menuWeeks: number; departments: number; settings: number };
  const [restoreFile, setRestoreFile] = useState<Record<string, unknown> | null>(null);
  const [restoreFileName, setRestoreFileName] = useState("");
  const [restoreIncludeSettings, setRestoreIncludeSettings] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState<"idle" | "pending" | "done" | "error">("idle");
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);
  const [restoreError, setRestoreError] = useState("");
  const restoreInputRef = useRef<HTMLInputElement>(null);

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreResult(null);
    setRestoreError("");
    setRestoreStatus("idle");
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as Record<string, unknown>;
        setRestoreFile(parsed);
        setRestoreFileName(file.name);
      } catch {
        setRestoreError("Soubor není platná záloha (neplatný JSON).");
        setRestoreFile(null);
      }
    };
    reader.readAsText(file);
  };

  const handleRestore = () => {
    if (!restoreFile) return;
    setRestoreStatus("pending");
    setRestoreError("");
    startTransition(async () => {
      try {
        const res = await fetch("/api/restore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ backup: restoreFile, restoreSettings: restoreIncludeSettings }),
        });
        const json = await res.json() as { ok: boolean; result?: RestoreResult; error?: string };
        if (json.ok && json.result) {
          setRestoreResult(json.result);
          setRestoreStatus("done");
          setRestoreFile(null);
          setRestoreFileName("");
          if (restoreInputRef.current) restoreInputRef.current.value = "";
        } else {
          setRestoreError(json.error ?? "Obnova selhala.");
          setRestoreStatus("error");
        }
      } catch {
        setRestoreError("Síťová chyba při obnově.");
        setRestoreStatus("error");
      }
    });
  };

  const backupOrders = Array.isArray((restoreFile as Record<string, unknown> | null)?.orders)
    ? ((restoreFile as Record<string, unknown>).orders as unknown[]).length : 0;
  const backupWeeks = restoreFile
    ? new Set(
        (((restoreFile as Record<string, unknown>).menu_items as Record<string, unknown>[] | undefined) ?? [])
          .map((i) => i.week_start as string)
          .filter(Boolean)
      ).size
    : 0;
  const backupDepts = Array.isArray((restoreFile as Record<string, unknown> | null)?.departments)
    ? ((restoreFile as Record<string, unknown>).departments as unknown[]).length : 0;
  const backupHasSettings = typeof (restoreFile as Record<string, unknown> | null)?.settings === "object";

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(false);
    startTransition(async () => {
      const ok = await actionCheckPin(pin);
      if (ok) setUnlocked(true);
      else { setPinError(true); setPin(""); }
    });
  };

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const autoSendDays = DAY_OPTIONS
      .filter((d) => fd.get(`autoSendDay_${d.code}`) === "on")
      .map((d) => d.code)
      .join(",");
    const updates: Partial<AppSettings> = {
      smtpHost: fd.get("smtpHost") as string,
      smtpPort: fd.get("smtpPort") as string,
      smtpUser: fd.get("smtpUser") as string,
      smtpPass: fd.get("smtpPass") as string,
      smtpFrom: fd.get("smtpFrom") as string,
      smtpSecure: fd.get("smtpSecure") === "on" ? "true" : "false",
      orderEmailTo: fd.get("orderEmailTo") as string,
      orderExtraEmail: fd.get("orderExtraEmail") as string,
      smtpReplyTo: fd.get("smtpReplyTo") as string,
      cutoffTime: fd.get("cutoffTime") as string,
      defaultSoupPrice: fd.get("defaultSoupPrice") as string,
      defaultMealPrice: fd.get("defaultMealPrice") as string,
      priceRoll: fd.get("priceRoll") as string,
      priceBreadDumpling: fd.get("priceBreadDumpling") as string,
      pricePotatoDumpling: fd.get("pricePotatoDumpling") as string,
      priceKetchup: fd.get("priceKetchup") as string,
      priceTatarka: fd.get("priceTatarka") as string,
      priceBbq: fd.get("priceBbq") as string,
      autoSendEnabled: fd.get("autoSendEnabled") === "on" ? "true" : "false",
      autoSendTime: fd.get("autoSendTime") as string,
      autoSendDays,
      autoSendMinOrders: fd.get("autoSendMinOrders") as string,
    };
    const newPin = (fd.get("newPin") as string).trim();
    if (newPin) updates.settingsPin = newPin;

    setSaveStatus("idle");
    startTransition(async () => {
      try {
        await actionSaveSettings(updates);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 3000);
      } catch {
        setSaveStatus("error");
      }
    });
  };

  const handleSmtpTest = () => {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    const config = {
      host: fd.get("smtpHost") as string,
      port: fd.get("smtpPort") as string,
      user: fd.get("smtpUser") as string,
      pass: fd.get("smtpPass") as string,
      secure: fd.get("smtpSecure") === "on" ? "true" : "false",
    };
    setSmtpTestStatus("idle");
    setSmtpTestMsg("Testuji připojení...");
    startTransition(async () => {
      try {
        const res = await fetch("/api/smtp-test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config),
        });
        const json = await res.json() as { ok: boolean; error?: string };
        if (json.ok) { setSmtpTestStatus("ok"); setSmtpTestMsg("Připojení proběhlo úspěšně."); }
        else { setSmtpTestStatus("error"); setSmtpTestMsg(json.error ?? "Nepodařilo se připojit."); }
      } catch {
        setSmtpTestStatus("error");
        setSmtpTestMsg("Síťová chyba při testu.");
      }
    });
  };

  const handleDeptSave = (id: number, data: Partial<{ label: string; emailLabel: string; accent: string }>) => {
    startTransition(async () => {
      const updated = await actionUpdateDepartment(id, data);
      setDepartments((prev) => prev.map((d) => (d.id === id ? updated : d)));
    });
  };

  const handleDeptDelete = (id: number) => {
    setDeptError(null);
    startTransition(async () => {
      try {
        await actionDeleteDepartment(id);
        setDepartments((prev) => prev.filter((d) => d.id !== id));
      } catch (err) {
        setDeptError(err instanceof Error ? err.message : "Chyba při mazání.");
      }
    });
  };

  const handleDeptMove = (id: number, direction: "up" | "down") => {
    const idx = departments.findIndex((d) => d.id === id);
    if (idx < 0) return;
    const swap = direction === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= departments.length) return;
    const next = [...departments];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setDepartments(next);
    startTransition(async () => { await actionReorderDepartments(next.map((d) => d.id)); });
  };

  const handleAddDept = () => {
    if (!newDeptName.trim() || !newDeptLabel.trim()) return;
    setDeptError(null);
    startTransition(async () => {
      try {
        const dept = await actionAddDepartment({
          name: newDeptName.trim(),
          label: newDeptLabel.trim(),
          emailLabel: newDeptLabel.trim(),
          accent: newDeptAccent,
        });
        setDepartments((prev) => [...prev, dept]);
        setNewDeptName("");
        setNewDeptLabel("");
        setNewDeptAccent("blue");
        setShowAddDept(false);
      } catch (err) {
        setDeptError(err instanceof Error ? err.message : "Chyba při přidávání.");
      }
    });
  };

  const activeDays = settings.autoSendDays.split(",").map((d) => d.trim());

  return (
    <div className="k-shell">

      {/* Desktop topbar */}
      <div className="hidden md:flex px-5 py-2.5 border-b border-white/50 items-center gap-3 topbar shrink-0">
        <MIcon name="settings" size={16} fill style={{ color: "#D97706" }} />
        <span className="font-display font-bold text-[15px] text-stone-900">Nastavení</span>
        <span className="text-[12px] text-stone-500">SMTP, příjemci, kopie, čas uzávěrky, PIN</span>
      </div>

      {/* Mobile topbar */}
      <div className="md:hidden border-b border-white/50 topbar shrink-0 px-4 py-2.5">
        <span className="font-display font-bold text-[14px] text-stone-900">Nastavení</span>
      </div>

      <main className="flex-1 overflow-y-auto scroll-area p-4 md:p-5 space-y-4 pb-28 md:pb-8">
        {!unlocked ? (
          /* PIN lock */
          <div className="glass rounded-3xl overflow-hidden max-w-sm mx-auto mt-8">
            <div className="flex flex-col items-center gap-4 p-8">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,rgba(245,158,11,0.15),rgba(234,88,12,0.15))" }}>
                <MIcon name="lock" size={28} fill style={{ color: "#EA580C" }} />
              </div>
              <div className="text-center">
                <p className="font-display font-bold text-[17px] text-stone-900">Přístup chráněn PINem</p>
                <p className="text-[12.5px] text-stone-500 mt-1">Zadejte PIN pro zobrazení nastavení</p>
              </div>
              <form className="w-full flex flex-col gap-3" onSubmit={handlePinSubmit}>
                <input
                  ref={pinInputRef}
                  className="modal-input text-center tracking-[0.5em] font-display font-bold"
                  inputMode="numeric"
                  maxLength={8}
                  onChange={(e) => setPin(e.target.value)}
                  pattern="[0-9]*"
                  placeholder="••••"
                  style={{ fontSize: "20px" }}
                  type="password"
                  value={pin}
                />
                {pinError && (
                  <p className="text-[12px] text-red-500 text-center -mt-1">Nesprávný PIN. Zkuste to znovu.</p>
                )}
                <button
                  className="modal-btn modal-btn--primary w-full"
                  disabled={isPending || pin.length === 0}
                  type="submit"
                >
                  {isPending ? "Ověřuji..." : "Odemknout"}
                </button>
              </form>
            </div>
          </div>
        ) : (
          <>
            {/* Reopen order — nahoře, aby k tomu nebylo třeba scrollovat */}
            {todayOrder && (todayOrder.status === "sent" || reopenDone) && (
              <Section icon="lock_open" title="Dnešní objednávka">
                {todayOrder.status === "sent" && !reopenDone ? (
                  <div className="flex flex-col gap-3">
                    <p className="text-[12.5px] text-stone-500">Objednávka je odeslána.</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-2xl glass-btn text-stone-600"
                        disabled={isPending}
                        onClick={() => {
                          startTransition(async () => {
                            await actionReopenOrder(todayOrder.id);
                            setReopenDone(true);
                          });
                        }}
                        type="button"
                      >
                        <MIcon name="lock_open" size={14} /> Znovu otevřít
                      </button>
                      <button
                        className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-2xl glass-btn text-stone-600"
                        disabled={isPending || resendStatus === "pending"}
                        onClick={() => {
                          setResendStatus("pending");
                          startTransition(async () => {
                            try {
                              await actionResendOrder(todayOrder.id);
                              setResendStatus("done");
                              setTimeout(() => setResendStatus("idle"), 4000);
                            } catch {
                              setResendStatus("error");
                            }
                          });
                        }}
                        type="button"
                      >
                        <MIcon name="send" size={14} /> {resendStatus === "pending" ? "Odesílám..." : "Znovu odeslat email"}
                      </button>
                    </div>
                    {resendStatus === "done" && (
                      <p className="text-[12px] text-green-700 inline-flex items-center gap-1.5">
                        <MIcon name="check_circle" size={13} fill /> Email byl znovu odeslán.
                      </p>
                    )}
                    {resendStatus === "error" && (
                      <p className="text-[12px] text-red-500">Chyba při odesílání. Zkontrolujte SMTP nastavení.</p>
                    )}
                  </div>
                ) : (
                  <p className="text-[12.5px] text-green-700 inline-flex items-center gap-1.5">
                    <MIcon name="check_circle" size={14} fill /> Objednávka byla znovu otevřena.
                  </p>
                )}
              </Section>
            )}

            <form id="settings-form" onSubmit={handleSave} ref={formRef}>
              <div className="flex flex-col gap-4">

                <Section icon="send" title="SMTP – odchozí pošta">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field hint="např. smtp.gmail.com" label="SMTP host">
                      <input className="modal-input" defaultValue={settings.smtpHost} name="smtpHost" placeholder="smtp.example.com" type="text" />
                    </Field>
                    <Field hint="obvykle 587 nebo 465" label="Port">
                      <input className="modal-input" defaultValue={settings.smtpPort} name="smtpPort" placeholder="587" type="number" />
                    </Field>
                    <Field label="Uživatel (e-mail)">
                      <input className="modal-input" defaultValue={settings.smtpUser} name="smtpUser" placeholder="user@example.com" type="email" />
                    </Field>
                    <Field label="Heslo">
                      <input className="modal-input" defaultValue={settings.smtpPass} name="smtpPass" placeholder="••••••••" type="password" />
                    </Field>
                    <Field hint="pokud prázdné, použije se uživatel" label="Odesílatel (From)">
                      <input className="modal-input" defaultValue={settings.smtpFrom} name="smtpFrom" placeholder="Objednávky <orders@example.com>" type="text" />
                    </Field>
                    <Field hint="zaškrtněte pro port 465" label="TLS (SMTP Secure)">
                      <Toggle defaultChecked={settings.smtpSecure === "true"} label="Použít TLS (SMTP Secure)" name="smtpSecure" />
                    </Field>
                  </div>
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-2xl glass-btn text-stone-600"
                      disabled={isPending}
                      onClick={handleSmtpTest}
                      type="button"
                    >
                      Testovat připojení
                    </button>
                    {smtpTestMsg && (
                      <span className={`text-[12px] font-medium ${smtpTestStatus === "ok" ? "text-emerald-600" : smtpTestStatus === "error" ? "text-red-500" : "text-stone-500"}`}>
                        {smtpTestMsg}
                      </span>
                    )}
                  </div>
                </Section>

                <Section icon="send" title="E-mail objednávky">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field hint="můžete zadat více adres oddělených čárkou, středníkem nebo novým řádkem" label="Příjemci objednávky (To)">
                      <EmailListInput
                        defaultValue={settings.orderEmailTo}
                        name="orderEmailTo"
                        placeholder="vedouci@firma.cz, kuchyne@firma.cz"
                      />
                    </Field>
                    <Field hint="uloží se k objednávce jako kopie a použije se při ručním i automatickém odeslání" label="Doplňkové kopie objednávky">
                      <EmailListInput
                        defaultValue={settings.orderExtraEmail}
                        name="orderExtraEmail"
                        placeholder="obchod@firma.cz; sklad@firma.cz"
                      />
                    </Field>
                    <Field hint="pokud prázdné, Reply-To se nenastavuje; více adres je podporováno" label="Adresa pro odpovědi (Reply-To)">
                      <EmailListInput
                        defaultValue={settings.smtpReplyTo}
                        name="smtpReplyTo"
                        placeholder="jiri@example.com, objednavky@firma.cz"
                      />
                    </Field>
                  </div>
                </Section>

                <Section icon="schedule" title="Provoz">
                  <Field hint="zobrazuje se v hlavičce objednávkové stránky" label="Čas uzávěrky">
                    <input className="modal-input w-32" defaultValue={settings.cutoffTime} name="cutoffTime" type="time" />
                  </Field>
                </Section>

                <Section icon="schedule" title="Automatické odeslání">
                  <p className="text-[12.5px] text-stone-500">
                    Objednávka se automaticky odešle v nastavenou dobu. Přeskočí se pokud je den označen jako zavřený nebo pokud není splněný minimální počet objednávek.
                  </p>
                  <Toggle defaultChecked={settings.autoSendEnabled === "true"} label="Zapnout automatické odeslání" name="autoSendEnabled" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field hint="čas kdy se objednávka automaticky odešle" label="Čas odeslání">
                      <input className="modal-input w-32" defaultValue={settings.autoSendTime} name="autoSendTime" type="time" />
                    </Field>
                    <Field hint="minimálně N objednávek, jinak se přeskočí" label="Minimální počet objednávek">
                      <input className="modal-input w-24" defaultValue={settings.autoSendMinOrders} min="1" name="autoSendMinOrders" type="number" />
                    </Field>
                  </div>
                  <Field label="Dny odeslání">
                    <div className="flex gap-3 flex-wrap mt-0.5">
                      {DAY_OPTIONS.map((d) => (
                        <label className="flex items-center gap-1.5 cursor-pointer" key={d.code}>
                          <div className="relative shrink-0">
                            <input
                              className="peer sr-only"
                              defaultChecked={activeDays.includes(d.code)}
                              name={`autoSendDay_${d.code}`}
                              type="checkbox"
                            />
                            <div className="w-9 h-[20px] rounded-full bg-black/15 transition-colors peer-checked:[background:linear-gradient(135deg,#F59E0B,#EA580C)]" />
                            <div className="absolute top-[3px] left-[3px] w-3.5 h-3.5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-[16px]" />
                          </div>
                          <span className="text-[12px] font-semibold text-stone-700">{d.label}</span>
                        </label>
                      ))}
                    </div>
                  </Field>
                </Section>

                <Section icon="restaurant" title="Ceník jídel">
                  <p className="text-[12.5px] text-stone-500">
                    Výchozí ceny používané při importu jídelního lístku z webu. Existující položky v menu se nemění.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <Field hint="Kč za porci" label="Výchozí cena polévky">
                      <input className="modal-input w-24" defaultValue={settings.defaultSoupPrice} min="0" name="defaultSoupPrice" type="number" />
                    </Field>
                    <Field hint="Kč za porci" label="Výchozí cena jídla">
                      <input className="modal-input w-24" defaultValue={settings.defaultMealPrice} min="0" name="defaultMealPrice" type="number" />
                    </Field>
                  </div>
                </Section>

                <Section icon="shopping_basket" title="Přílohy a doplňky">
                  <p className="text-[12.5px] text-stone-500">
                    Ceny příloh zobrazované v modalu a používané pro výpočet ceny řádku.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <Field hint="Kč/ks" label="Houska">
                      <input className="modal-input w-24" defaultValue={settings.priceRoll} min="0" name="priceRoll" type="number" />
                    </Field>
                    <Field hint="Kč/ks" label="Houskový knedlík">
                      <input className="modal-input w-24" defaultValue={settings.priceBreadDumpling} min="0" name="priceBreadDumpling" type="number" />
                    </Field>
                    <Field hint="Kč/ks" label="Bramborový knedlík">
                      <input className="modal-input w-24" defaultValue={settings.pricePotatoDumpling} min="0" name="pricePotatoDumpling" type="number" />
                    </Field>
                    <Field hint="Kč/ks" label="Kečup">
                      <input className="modal-input w-24" defaultValue={settings.priceKetchup} min="0" name="priceKetchup" type="number" />
                    </Field>
                    <Field hint="Kč/ks" label="Tatarka">
                      <input className="modal-input w-24" defaultValue={settings.priceTatarka} min="0" name="priceTatarka" type="number" />
                    </Field>
                    <Field hint="Kč/ks" label="BBQ omáčka">
                      <input className="modal-input w-24" defaultValue={settings.priceBbq} min="0" name="priceBbq" type="number" />
                    </Field>
                  </div>
                </Section>

                <Section icon="lock" title="Zabezpečení">
                  <Field hint="nechte prázdné pro zachování stávajícího PINu" label="Nový PIN (číslice)">
                    <input className="modal-input w-36" inputMode="numeric" maxLength={8} name="newPin" pattern="[0-9]*" placeholder="ponechte prázdné" type="password" />
                  </Field>
                </Section>

              </div>
            </form>

            {/* Departments — outside the form to avoid accidental submit */}
            <Section icon="groups" title="Oddělení">
              <p className="text-[12.5px] text-stone-500">
                Správa oddělení zobrazovaných v objednávkovém formuláři. Změny se projeví okamžitě.
              </p>
              {deptError && (
                <p className="text-[12px] text-red-500">{deptError}</p>
              )}
              <div className="flex flex-col gap-2">
                {departments.map((dept, idx) => (
                  <DeptRow
                    dept={dept}
                    isFirst={idx === 0}
                    isLast={idx === departments.length - 1}
                    key={dept.id}
                    onDelete={handleDeptDelete}
                    onMoveDown={(id) => handleDeptMove(id, "down")}
                    onMoveUp={(id) => handleDeptMove(id, "up")}
                    onSave={handleDeptSave}
                  />
                ))}
              </div>
              {showAddDept ? (
                <div className="glass-soft rounded-2xl p-3 flex flex-col gap-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Field hint="interní klíč (nelze měnit)" label="Kód oddělení">
                      <input className="modal-input" onChange={(e) => setNewDeptName(e.target.value)} placeholder="např. Sklad" value={newDeptName} />
                    </Field>
                    <Field hint="zobrazovaný název" label="Název">
                      <input className="modal-input" onChange={(e) => setNewDeptLabel(e.target.value)} placeholder="např. Sklad" value={newDeptLabel} />
                    </Field>
                    <Field label="Barva">
                      <select className="k-select" onChange={(e) => setNewDeptAccent(e.target.value)} value={newDeptAccent}>
                        {ACCENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </Field>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="modal-btn modal-btn--primary"
                      disabled={isPending || !newDeptName.trim() || !newDeptLabel.trim()}
                      onClick={handleAddDept}
                      type="button"
                    >Přidat</button>
                    <button
                      className="modal-btn modal-btn--secondary"
                      onClick={() => { setShowAddDept(false); setNewDeptName(""); setNewDeptLabel(""); }}
                      type="button"
                    >Zrušit</button>
                  </div>
                </div>
              ) : (
                <button
                  className="self-start inline-flex items-center gap-1 text-[12px] font-semibold px-3 py-1.5 rounded-xl glass-btn text-stone-600"
                  onClick={() => setShowAddDept(true)}
                  type="button"
                >
                  <MIcon name="add" size={14} /> Přidat oddělení
                </button>
              )}
            </Section>

            {/* Save button */}
            <div className="flex items-center justify-end gap-3 pt-1">
              {saveStatus === "saved" && (
                <span className="text-[12px] font-medium text-emerald-600">Nastavení uloženo.</span>
              )}
              {saveStatus === "error" && (
                <span className="text-[12px] font-medium text-red-500">Chyba při ukládání.</span>
              )}
              <button
                className="modal-btn modal-btn--primary"
                disabled={isPending}
                form="settings-form"
                type="submit"
              >
                {isPending ? "Ukládám..." : "Uložit nastavení"}
              </button>
            </div>

            {/* Backup & Restore */}
            <Section icon="build" title="Záloha a obnova dat">
              <p className="text-[12.5px] text-stone-500">
                Stáhněte zálohu objednávek, jídelníčků, oddělení a nastavení ve formátu JSON, nebo obnovte data ze starší zálohy.
              </p>
              <a
                className="self-start inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-2xl glass-btn text-stone-600"
                download
                href="/api/backup"
              >
                <MIcon name="download" size={14} /> Stáhnout zálohu
              </a>

              <div className="border-t border-white/40 pt-3 flex flex-col gap-3">
                <p className="text-[12px] font-semibold text-stone-700">Obnova ze zálohy</p>
                <p className="text-[12px] text-stone-500">
                  Obnova je přídavná — přidají se pouze data, která v aplikaci ještě nejsou (podle data objednávky, týdne jídelníčku a názvu oddělení). Existující záznamy zůstanou beze změny.
                </p>

                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    ref={restoreInputRef}
                    accept=".json"
                    className="sr-only"
                    id="restore-file-input"
                    onChange={handleRestoreFile}
                    type="file"
                  />
                  <label
                    className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-2xl glass-btn text-stone-600 cursor-pointer"
                    htmlFor="restore-file-input"
                  >
                    <MIcon name="upload_file" size={14} /> Vybrat soubor zálohy
                  </label>
                  {restoreFileName && (
                    <span className="text-[11.5px] text-stone-500 truncate max-w-[200px]">{restoreFileName}</span>
                  )}
                </div>

                {restoreFile && (
                  <div className="glass-soft rounded-2xl p-3 flex flex-col gap-2.5">
                    <p className="text-[12px] font-semibold text-stone-700">Obsah zálohy:</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[12px] text-stone-600">
                      <span>Objednávky: <strong>{backupOrders}</strong></span>
                      <span>Týdny menu: <strong>{backupWeeks}</strong></span>
                      <span>Oddělení: <strong>{backupDepts}</strong></span>
                    </div>
                    {backupHasSettings && (
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <div className="relative shrink-0">
                          <input
                            checked={restoreIncludeSettings}
                            className="peer sr-only"
                            onChange={(e) => setRestoreIncludeSettings(e.target.checked)}
                            type="checkbox"
                          />
                          <div className="w-9 h-[20px] rounded-full bg-black/15 transition-colors peer-checked:[background:linear-gradient(135deg,#F59E0B,#EA580C)]" />
                          <div className="absolute top-[3px] left-[3px] w-3.5 h-3.5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-[16px]" />
                        </div>
                        <span className="text-[12px] text-stone-700">Obnovit také nastavení aplikace (pouze chybějící hodnoty)</span>
                      </label>
                    )}
                    <button
                      className="self-start modal-btn modal-btn--primary"
                      disabled={isPending || restoreStatus === "pending"}
                      onClick={handleRestore}
                      type="button"
                    >
                      {restoreStatus === "pending" ? "Obnovuji..." : "Obnovit data"}
                    </button>
                  </div>
                )}

                {restoreStatus === "done" && restoreResult && (
                  <div className="glass-soft rounded-2xl p-3 flex flex-col gap-1 text-[12px]">
                    <p className="font-semibold text-emerald-700 flex items-center gap-1.5">
                      <MIcon name="check_circle" size={14} fill /> Obnova dokončena
                    </p>
                    <p className="text-stone-600">Přidáno: {restoreResult.orders} objednávek, {restoreResult.menuWeeks} týdnů menu, {restoreResult.departments} oddělení{restoreResult.settings > 0 ? `, ${restoreResult.settings} nastavení` : ""}.</p>
                  </div>
                )}

                {restoreStatus === "error" && restoreError && (
                  <p className="text-[12px] text-red-500">{restoreError}</p>
                )}
              </div>
            </Section>

            {/* Audit log */}
            <Section icon="history" title="Historie změn">
              {initialAuditLog.length === 0 ? (
                <p className="text-[12.5px] text-stone-400 text-center py-2">Zatím žádné záznamy.</p>
              ) : (
                <div className="overflow-x-auto -mx-4 -mb-4">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-white/40" style={{ background: "rgba(255,255,255,0.4)" }}>
                        <th className="text-left px-4 py-2 font-display font-semibold text-stone-500 text-[10.5px] uppercase tracking-wide">Čas</th>
                        <th className="text-left px-3 py-2 font-display font-semibold text-stone-500 text-[10.5px] uppercase tracking-wide">Akce</th>
                        <th className="text-left px-3 py-2 font-display font-semibold text-stone-500 text-[10.5px] uppercase tracking-wide hidden sm:table-cell">Oddělení</th>
                        <th className="text-left px-3 py-2 font-display font-semibold text-stone-500 text-[10.5px] uppercase tracking-wide hidden sm:table-cell">Osoba</th>
                        <th className="text-left px-3 py-2 font-display font-semibold text-stone-500 text-[10.5px] uppercase tracking-wide hidden md:table-cell">Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {initialAuditLog.map((entry) => (
                        <tr key={entry.id} className="border-b border-white/30 last:border-0 hover:bg-white/20 transition">
                          <td className="px-4 py-2 text-stone-500 font-mono text-[11px]">{formatTs(entry.ts)}</td>
                          <td className="px-3 py-2 font-medium text-stone-700">{ACTION_LABELS[entry.action] ?? entry.action}</td>
                          <td className="px-3 py-2 text-stone-500 hidden sm:table-cell">{entry.department ?? "—"}</td>
                          <td className="px-3 py-2 text-stone-500 hidden sm:table-cell">{entry.personName ?? "—"}</td>
                          <td className="px-3 py-2 text-stone-400 hidden md:table-cell">{entry.details ?? ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          </>
        )}
      </main>
    </div>
  );
}
