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
  actionClearOrder,
  actionCheckImap,
  actionSendTestPush,
  actionSetTelegramWebhook,
  actionSendTelegramTest,
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
  if (!ts) return "—";
  const normalized =
    ts.includes("T") && (ts.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(ts))
      ? ts
      : ts.replace(" ", "T") + "Z";
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleString("cs-CZ", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Section card ──────────────────────────────────────────────────────────────

function Section({ title, icon, children, helpContent, action }: { title: string; icon?: string; children: React.ReactNode; helpContent?: React.ReactNode; action?: React.ReactNode }) {
  const [showHelp, setShowHelp] = useState(false);
  return (
    <div className="glass rounded-3xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/40" style={{ background: "rgba(245,158,11,0.07)" }}>
        {icon && <MIcon name={icon as "settings"} size={17} fill style={{ color: "#D97706" }} />}
        <span className="font-display font-bold text-[13.5px] text-stone-900 flex-1">{title}</span>
        {action}
        {helpContent && (
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            aria-label="Nápověda"
            className="w-7 h-7 rounded-full glass-btn inline-flex items-center justify-center text-stone-400 hover:text-amber-600 transition"
          >
            <MIcon name="info" size={15} />
          </button>
        )}
      </div>
      {helpContent && showHelp && (
        <div className="px-4 pt-3 pb-1 border-b border-white/40 flex flex-col gap-2" style={{ background: "rgba(245,158,11,0.04)" }}>
          {helpContent}
        </div>
      )}
      <div className="p-4 flex flex-col gap-3">{children}</div>
    </div>
  );
}

// ── Field ─────────────────────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[12px] font-semibold text-stone-600">{label}</span>
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
            aria-label={`Přesunout ${dept.label} nahoru`}
            className="inline-flex w-10 h-10 rounded-full items-center justify-center text-stone-400 hover:bg-white/60 transition disabled:opacity-30"
            disabled={isFirst} onClick={() => onMoveUp(dept.id)} type="button"
          >↑</button>
          <button
            aria-label={`Přesunout ${dept.label} dolů`}
            className="inline-flex w-10 h-10 rounded-full items-center justify-center text-stone-400 hover:bg-white/60 transition disabled:opacity-30"
            disabled={isLast} onClick={() => onMoveDown(dept.id)} type="button"
          >↓</button>
          <button
            className="text-[11.5px] font-semibold px-2.5 py-1.5 rounded-lg glass-btn text-stone-600"
            onClick={() => setEditing(true)} type="button"
          >Upravit</button>
          <button
            aria-label={`Smazat oddělení ${dept.label}`}
            className="text-[11.5px] font-semibold px-2.5 py-1.5 rounded-lg text-red-600 transition"
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

// ── Tabs ─────────────────────────────────────────────────

type Tab = "objednavka" | "email" | "ceny" | "oddeleni" | "system" | "telegram";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "objednavka", label: "Objednávka", icon: "assignment" },
  { id: "email",      label: "E-mail & IMAP", icon: "mail" },
  { id: "ceny",       label: "Ceny",       icon: "payments" },
  { id: "oddeleni",   label: "Oddělení",   icon: "groups" },
  { id: "system",     label: "Systém",     icon: "build" },
  { id: "telegram",   label: "Telegram",   icon: "send" },
];

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
  const [activeTab, setActiveTab] = useState<Tab>("objednavka");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [isPending, startTransition] = useTransition();
  const pinInputRef = useRef<HTMLInputElement>(null);
  const sessionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

  const resetSessionTimer = () => {
    if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
    sessionTimerRef.current = setTimeout(() => {
      setUnlocked(false);
      confirmedPinRef.current = "";
      sessionTimerRef.current = null;
    }, SESSION_TIMEOUT_MS);
  };

  useEffect(() => {
    if (unlocked) resetSessionTimer();
    else {
      if (sessionTimerRef.current) { clearTimeout(sessionTimerRef.current); sessionTimerRef.current = null; }
    }
    return () => { if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked]);

  useEffect(() => {
    if (!unlocked) {
      const t = setTimeout(() => pinInputRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [unlocked]);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [smtpTestStatus, setSmtpTestStatus] = useState<"idle" | "ok" | "error">("idle");
  const [smtpTestMsg, setSmtpTestMsg] = useState("");
  const [imapCheckStatus, setImapCheckStatus] = useState<"idle" | "pending" | "found" | "notfound" | "error">("idle");
  const [imapCheckMsg, setImapCheckMsg] = useState("");
  const [pushTestStatus, setPushTestStatus] = useState<"idle" | "pending" | "ok" | "error">("idle");
  const [telegramTestStatus, setTelegramTestStatus] = useState<"idle" | "pending" | "ok" | "error">("idle");
  const [telegramTestMsg, setTelegramTestMsg] = useState("");
  const [webhookStatus, setWebhookStatus] = useState<"idle" | "pending" | "ok" | "error">("idle");
  const [webhookMsg, setWebhookMsg] = useState("");
  const [showTelegramHelp, setShowTelegramHelp] = useState(false);
  const [pushTestMsg, setPushTestMsg] = useState("");
  const [departments, setDepartments] = useState<DepartmentInfo[]>(initialDepts);
  const [deptError, setDeptError] = useState<string | null>(null);
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptLabel, setNewDeptLabel] = useState("");
  const [newDeptAccent, setNewDeptAccent] = useState("blue");
  const [showAddDept, setShowAddDept] = useState(false);
  const [reopenDone, setReopenDone] = useState(false);
  const [resendStatus, setResendStatus] = useState<"idle" | "pending" | "done" | "error">("idle");
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearDone, setClearDone] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const confirmedPinRef = useRef("");
  const imapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (imapTimeoutRef.current) clearTimeout(imapTimeoutRef.current); }, []);

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
      if (ok) { setUnlocked(true); confirmedPinRef.current = pin; }
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
      reminderEmailTo: fd.get("reminderEmailTo") as string,
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
      autoSendFailureEmail: fd.get("autoSendFailureEmail") as string,
      imapEnabled: fd.get("imapEnabled") === "on" ? "true" : "false",
      imapHost: fd.get("imapHost") as string,
      imapPort: fd.get("imapPort") as string,
      imapUser: fd.get("imapUser") as string,
      imapPass: fd.get("imapPass") as string,
      imapSender: fd.get("imapSender") as string,
      imapCheckTime: fd.get("imapCheckTime") as string,
      imapCheckDays: DAY_OPTIONS
        .filter((d) => fd.get(`imapCheckDay_${d.code}`) === "on")
        .map((d) => d.code)
        .join(","),
      pushReminderMinutes: fd.get("pushReminderMinutes") as string,
      telegramEnabled: fd.get("telegramEnabled") === "on" ? "true" : "false",
      telegramBotToken: fd.get("telegramBotToken") as string,
      telegramChatId: fd.get("telegramChatId") as string,
    };
    const newPin = (fd.get("newPin") as string).trim();
    if (newPin) updates.settingsPin = newPin;

    setSaveStatus("idle");
    startTransition(async () => {
      try {
        await actionSaveSettings(updates, confirmedPinRef.current);
        resetSessionTimer();
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

  const handleImapCheck = () => {
    if (imapTimeoutRef.current) clearTimeout(imapTimeoutRef.current);
    setImapCheckStatus("pending");
    setImapCheckMsg("Připojuji se k poštovní schránce...");
    imapTimeoutRef.current = setTimeout(() => {
      imapTimeoutRef.current = null;
      setImapCheckStatus("error");
      setImapCheckMsg("Časový limit vypršel — zkontroluj nastavení IMAP (host, port, heslo).");
    }, 25000);
    startTransition(async () => {
      try {
        const result = await actionCheckImap();
        if (!imapTimeoutRef.current) return; // timeout already fired
        clearTimeout(imapTimeoutRef.current);
        imapTimeoutRef.current = null;
        if (result.found) {
          setImapCheckStatus("found");
          setImapCheckMsg(`Importován jídelníček ${result.weekLabel} (${result.itemCount} položek).`);
        } else if (result.error) {
          setImapCheckStatus("error");
          setImapCheckMsg(result.error);
        } else {
          setImapCheckStatus("notfound");
          setImapCheckMsg("Žádný nový mail s jídelníčkem nebyl nalezen.");
        }
      } catch {
        if (imapTimeoutRef.current) { clearTimeout(imapTimeoutRef.current); imapTimeoutRef.current = null; }
        setImapCheckStatus("error");
        setImapCheckMsg("Nepodařilo se připojit k poštovní schránce.");
      }
    });
  };

  const handleTestPush = () => {
    setPushTestStatus("pending");
    setPushTestMsg("Odesílám...");
    startTransition(async () => {
      try {
        const result = await actionSendTestPush();
        if (result.error) { setPushTestStatus("error"); setPushTestMsg(result.error); }
        else { setPushTestStatus("ok"); setPushTestMsg(`Notifikace odeslána do ${result.sent} prohlížeče/ů.`); }
      } catch {
        setPushTestStatus("error");
        setPushTestMsg("Nepodařilo se odeslat testovací notifikaci.");
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
  const activeImapDays = settings.imapCheckDays.split(",").map((d) => d.trim());

  return (
    <div className="k-shell">

      {/* Desktop topbar */}
      <div className="hidden md:flex px-5 py-2.5 border-b border-white/50 items-center gap-3 topbar shrink-0">
        <MIcon name="settings" size={16} fill style={{ color: "#D97706" }} />
        <span className="font-display font-bold text-[15px] text-stone-900">Nastavení</span>
      </div>

      {/* Mobile topbar */}
      <div className="md:hidden border-b border-white/50 topbar shrink-0 px-4 py-2.5">
        <span className="font-display font-bold text-[14px] text-stone-900">Nastavení</span>
      </div>

      <main className="flex-1 overflow-y-auto scroll-area p-4 md:p-5 space-y-4 pb-28 md:pb-24">
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
            {/* Tab bar */}
            <div className="overflow-x-auto no-scrollbar -mx-1 px-1">
              <div
                className="flex p-1 rounded-2xl gap-0.5"
                style={{ width: "max-content", background: "rgba(26,18,8,0.06)", border: "1px solid rgba(255,255,255,0.55)" }}
              >
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl text-[12.5px] font-semibold transition-all duration-200 active:scale-[0.96] ${
                      activeTab === tab.id ? "text-white" : "text-stone-500 hover:text-stone-700 hover:bg-white/60"
                    }`}
                    style={activeTab === tab.id ? {
                      background: "linear-gradient(135deg,#F59E0B,#EA580C)",
                      boxShadow: "0 2px 8px -2px rgba(234,88,12,0.35)",
                    } : {}}
                  >
                    <MIcon name={tab.icon as "settings"} size={14} />
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Objednávka — non-form sections ── */}
            {activeTab === "objednavka" && todayOrder && (
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
                ) : reopenDone ? (
                  <p className="text-[12.5px] text-green-700 inline-flex items-center gap-1.5">
                    <MIcon name="check_circle" size={14} fill /> Objednávka byla znovu otevřena.
                  </p>
                ) : null}
                {todayOrder.status === "draft" && !clearDone && (
                  <div className="flex flex-col gap-2 pt-1 border-t border-white/40">
                    <p className="text-[12.5px] text-stone-500">Objednávka je otevřená.</p>
                    <button
                      className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-2xl glass-btn-danger"
                      disabled={isPending}
                      onClick={() => setClearConfirm(true)}
                      type="button"
                    >
                      <MIcon name="delete" size={14} /> Smazat celou objednávku
                    </button>
                  </div>
                )}
                {clearDone && (
                  <p className="text-[12.5px] text-stone-500 inline-flex items-center gap-1.5">
                    <MIcon name="check_circle" size={14} fill style={{ color: "#94a3b8" }} /> Objednávka byla smazána.
                  </p>
                )}
              </Section>
            )}
            {clearConfirm && (
              <ConfirmModal
                confirmLabel="Smazat"
                isPending={isPending}
                message="Celá dnešní objednávka bude vymazána. Tuto akci nelze vrátit."
                onClose={() => setClearConfirm(false)}
                onConfirm={() => {
                  startTransition(async () => {
                    await actionClearOrder(todayOrder!.id);
                    setClearConfirm(false);
                    setClearDone(true);
                  });
                }}
                title="Smazat objednávku"
              />
            )}

            {/* ── Oddělení tab ── */}
            {activeTab === "oddeleni" && (
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
            )}

            {/* ── Form (all form-field sections, hidden per tab via CSS) ── */}
            <form id="settings-form" onSubmit={handleSave} ref={formRef}>

              {/* Objednávka tab: Provoz + AutoSend */}
              <div className="flex flex-col gap-4" style={{ display: activeTab === "objednavka" ? "flex" : "none" }}>

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
                  <Field hint="e-mail(y) kam přijde upozornění při selhání auto-send — prázdné = použije se adresa z upozornění na jídelníček" label="Upozornění při selhání">
                    <input className="modal-input" defaultValue={settings.autoSendFailureEmail} name="autoSendFailureEmail" placeholder="admin@firma.cz" type="email" />
                  </Field>
                </Section>

              </div>

              {/* E-mail & IMAP tab */}
              <div className="flex flex-col gap-4" style={{ display: activeTab === "email" ? "flex" : "none" }}>

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
                      <EmailListInput defaultValue={settings.orderEmailTo} name="orderEmailTo" placeholder="vedouci@firma.cz, kuchyne@firma.cz" />
                    </Field>
                    <Field hint="uloží se k objednávce jako kopie a použije se při ručním i automatickém odeslání" label="Doplňkové kopie objednávky">
                      <EmailListInput defaultValue={settings.orderExtraEmail} name="orderExtraEmail" placeholder="obchod@firma.cz; sklad@firma.cz" />
                    </Field>
                    <Field hint="pokud prázdné, Reply-To se nenastavuje; více adres je podporováno" label="Adresa pro odpovědi (Reply-To)">
                      <EmailListInput defaultValue={settings.smtpReplyTo} name="smtpReplyTo" placeholder="jiri@example.com, objednavky@firma.cz" />
                    </Field>
                    <Field hint="kam chodí upozornění na chybějící jídelníček; pokud prázdné, použijí se příjemci objednávky" label="Příjemci upozornění (jídelníček)">
                      <EmailListInput defaultValue={settings.reminderEmailTo} name="reminderEmailTo" placeholder="vedouci@firma.cz" />
                    </Field>
                  </div>
                </Section>

                <Section icon="menu_book" title="Automatický import jídelníčku" helpContent={
                  <div className="space-y-2.5 text-[12px] text-stone-600 pb-2">
                    <p className="font-semibold text-stone-800 text-[12.5px]">Jak nastavit automatický import z Gmailu</p>
                    <div className="space-y-1.5">
                      <p><span className="font-semibold text-stone-700">1. Zapni IMAP v Gmailu</span><br />Gmail → Nastavení (ozubené kolo) → Zobrazit všechna nastavení → záložka <em>Přesměrování a POP/IMAP</em> → sekce IMAP → vyber <strong>Zapnout IMAP</strong> → Uložit.</p>
                      <p><span className="font-semibold text-stone-700">2. Vytvoř App Password</span><br />Gmail normální heslo nefunguje — potřebuješ speciální. Jdi na <strong>myaccount.google.com/apppasswords</strong>, přihlas se, vytvoř nové heslo (název např. „Kantyna"). Google vygeneruje 16 znaků — zkopíruj je <strong>bez mezer</strong> a vlož sem jako heslo.</p>
                      <p><span className="font-semibold text-stone-700">3. Filtr odesílatele</span><br />Zadej e-mailovou adresu od které LIMA posílá jídelníčky (najdeš ji v hlavičce příchozího mailu). Tím se zajistí, že se nezpracuje žádný jiný mail.</p>
                      <p><span className="font-semibold text-stone-700">4. Jak to funguje</span><br />Každý pracovní den v nastavený čas appka zkontroluje schránku, najde nepřečtený mail s PDF od LIMY, importuje jídelníček a mail označí jako přečtený.</p>
                    </div>
                  </div>
                }>
                  <p className="text-[12.5px] text-stone-500">
                    Appka se každé ráno připojí k e-mailové schránce a automaticky importuje jídelníček z PDF přílohy od LIMY.
                  </p>
                  <Toggle defaultChecked={settings.imapEnabled === "true"} label="Zapnout automatický import" name="imapEnabled" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field hint="např. imap.gmail.com" label="IMAP server">
                      <input className="modal-input" defaultValue={settings.imapHost} name="imapHost" type="text" />
                    </Field>
                    <Field hint="obvykle 993 pro SSL" label="Port">
                      <input className="modal-input w-24" defaultValue={settings.imapPort} min="1" name="imapPort" type="number" />
                    </Field>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field hint="Gmail adresa schránky" label="Uživatel (e-mail)">
                      <input className="modal-input" defaultValue={settings.imapUser} name="imapUser" type="email" />
                    </Field>
                    <Field hint="Google App Password (16 znaků)" label="Heslo">
                      <input className="modal-input" defaultValue={settings.imapPass} name="imapPass" type="password" autoComplete="new-password" />
                    </Field>
                  </div>
                  <Field hint="e-mail od kterého chodí jídelníčky, např. info@lima.cz — prázdné = všechny nepřečtené maily" label="Filtr odesílatele">
                    <input className="modal-input" defaultValue={settings.imapSender} name="imapSender" placeholder="info@lima.cz" type="email" />
                  </Field>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field hint="čas kdy se provede kontrola schránky" label="Čas kontroly">
                      <input className="modal-input w-32" defaultValue={settings.imapCheckTime} name="imapCheckTime" type="time" />
                    </Field>
                    <Field label="Kontrolovat ve dny">
                      <div className="flex gap-3 flex-wrap mt-0.5">
                        {DAY_OPTIONS.map((d) => (
                          <label className="flex items-center gap-1.5 cursor-pointer" key={d.code}>
                            <div className="relative shrink-0">
                              <input
                                className="peer sr-only"
                                defaultChecked={activeImapDays.includes(d.code)}
                                name={`imapCheckDay_${d.code}`}
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
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      className="glass-btn px-4 py-2 rounded-xl text-[12.5px] font-semibold text-stone-700 inline-flex items-center gap-2"
                      disabled={isPending}
                      onClick={handleImapCheck}
                      type="button"
                    >
                      <MIcon name="refresh" size={16} />
                      Zkontrolovat schránku teď
                    </button>
                    {imapCheckStatus !== "idle" && (
                      <span className={`text-[12px] font-medium ${imapCheckStatus === "found" ? "text-green-600" : imapCheckStatus === "error" ? "text-red-500" : "text-stone-500"}`}>
                        {imapCheckStatus === "found" && "✓ "}
                        {imapCheckMsg}
                      </span>
                    )}
                  </div>
                </Section>

                <Section icon="notifications" title="Push notifikace">
                  <p className="text-[12.5px] text-stone-500">
                    Upozornění do prohlížeče před uzávěrkou. Každý si je povolí sám tlačítkem 🔔 na hlavní stránce.
                  </p>
                  <Field hint="kolik minut před uzávěrkou přijde upozornění" label="Upozornit před uzávěrkou (min)">
                    <input className="modal-input w-24" defaultValue={settings.pushReminderMinutes} min="1" max="120" name="pushReminderMinutes" type="number" />
                  </Field>
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      className="glass-btn px-4 py-2 rounded-xl text-[12.5px] font-semibold text-stone-700 inline-flex items-center gap-2"
                      disabled={isPending}
                      onClick={handleTestPush}
                      type="button"
                    >
                      <MIcon name="send" size={16} />
                      Odeslat testovací notifikaci
                    </button>
                    {pushTestStatus !== "idle" && (
                      <span className={`text-[12px] font-medium ${pushTestStatus === "ok" ? "text-green-600" : pushTestStatus === "error" ? "text-red-500" : "text-stone-500"}`}>
                        {pushTestStatus === "ok" && "✓ "}
                        {pushTestMsg}
                      </span>
                    )}
                  </div>
                </Section>

              </div>

              {/* Ceny tab */}
              <div className="flex flex-col gap-4" style={{ display: activeTab === "ceny" ? "flex" : "none" }}>

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

              </div>

              {/* Systém tab — form part (PIN only) */}
              <div className="flex flex-col gap-4" style={{ display: activeTab === "system" ? "flex" : "none" }}>

                <Section icon="lock" title="Zabezpečení">
                  <Field hint="nechte prázdné pro zachování stávajícího PINu" label="Nový PIN (číslice)">
                    <input className="modal-input w-36" inputMode="numeric" maxLength={8} name="newPin" pattern="[0-9]*" placeholder="ponechte prázdné" type="password" />
                  </Field>
                </Section>

              </div>

            </form>

            {/* ── Systém — non-form sections ── */}
            {activeTab === "system" && (
              <>
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

                <Section icon="history" title="Historie změn">
                  {initialAuditLog.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-state__icon">
                        <MIcon name="manage_history" size={22} style={{ color: "#94a3b8" }} />
                      </div>
                      <p className="empty-state__title">Zatím žádné záznamy</p>
                    </div>
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

          </>
        )}

            {/* ── Telegram tab ── */}
            {activeTab === "telegram" && (
              <>
                <div className="flex flex-col gap-4" style={{ display: "flex" }}>
                  <Section icon="send" title="Telegram bot" action={
                    <button
                      type="button"
                      onClick={() => setShowTelegramHelp(true)}
                      className="inline-flex items-center gap-1 text-[11.5px] font-semibold px-2.5 py-1.5 rounded-full glass-btn text-stone-500"
                    >
                      <MIcon name="help_outline" size={13} /> Jak nastavit?
                    </button>
                  }>
                    <p className="text-[12.5px] text-stone-500">
                      Připoj Telegram bota pro notifikace a příkazy.
                    </p>
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                      <div className="relative shrink-0">
                        <input className="peer sr-only" defaultChecked={settings.telegramEnabled === "true"} name="telegramEnabled" type="checkbox" />
                        <div className="w-9 h-[20px] rounded-full bg-black/15 transition-colors peer-checked:[background:linear-gradient(135deg,#F59E0B,#EA580C)]" />
                        <div className="absolute top-[3px] left-[3px] w-3.5 h-3.5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-[16px]" />
                      </div>
                      <span className="text-[13px] font-semibold text-stone-800">Zapnout Telegram notifikace</span>
                    </label>
                    <Field hint="Token z @BotFather, např. 123456:ABC-DEF..." label="Bot Token">
                      <input className="modal-input font-mono text-[12px]" defaultValue={settings.telegramBotToken} name="telegramBotToken" placeholder="123456789:ABCdefGHI..." type="text" />
                    </Field>
                    <Field hint="ID chatu nebo skupiny — pošli /start botovi a zkopíruj chat_id" label="Chat ID">
                      <input className="modal-input font-mono text-[12px]" defaultValue={settings.telegramChatId} name="telegramChatId" placeholder="-1001234567890" type="text" />
                    </Field>
                  </Section>

                  <Section icon="notifications" title="Co bot hlásí">
                    <ul className="text-[12.5px] text-stone-600 space-y-1.5">
                      <li className="flex items-center gap-2"><MIcon name="check_circle" size={14} fill style={{ color: "#16a34a" }} /> Objednávka odeslána (auto-send)</li>
                      <li className="flex items-center gap-2"><MIcon name="error" size={14} fill style={{ color: "#dc2626" }} /> Auto-send selhal</li>
                    </ul>
                    <p className="text-[12px] text-stone-400 mt-1">Další typy notifikací přibudou postupně.</p>
                  </Section>

                  <Section icon="terminal" title="Dostupné příkazy">
                    <ul className="text-[12.5px] text-stone-600 space-y-1.5 font-mono">
                      <li><span className="text-amber-700">/stav</span> <span className="font-sans text-stone-500">— přehled dnešní objednávky</span></li>
                      <li><span className="text-amber-700">/menu</span> <span className="font-sans text-stone-500">— dnešní jídelníček</span></li>
                      <li><span className="text-amber-700">/odeslat</span> <span className="font-sans text-stone-500">— ruční odeslání objednávky</span></li>
                      <li><span className="text-amber-700">/zrusit</span> <span className="font-sans text-stone-500">— znovu otevřít odeslanou objednávku</span></li>
                      <li><span className="text-amber-700">/pomoc</span> <span className="font-sans text-stone-500">— seznam příkazů</span></li>
                    </ul>
                  </Section>
                </div>

                <Section icon="integration_instructions" title="Nastavení webhooku">
                  <p className="text-[12.5px] text-stone-500">
                    Aby bot přijímal příkazy, musí Telegram vědět na jakou URL odesílat zprávy. Klikni na tlačítko níže po každé změně domény nebo tokenu.
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      className="modal-btn modal-btn--secondary"
                      disabled={webhookStatus === "pending"}
                      onClick={async () => {
                        setWebhookStatus("pending");
                        setWebhookMsg("");
                        const res = await actionSetTelegramWebhook();
                        setWebhookStatus(res.ok ? "ok" : "error");
                        setWebhookMsg(res.description ?? "");
                      }}
                      type="button"
                    >
                      {webhookStatus === "pending" ? "Nastavuji…" : "Nastavit webhook"}
                    </button>
                    <button
                      className="modal-btn modal-btn--secondary"
                      disabled={telegramTestStatus === "pending"}
                      onClick={async () => {
                        setTelegramTestStatus("pending");
                        setTelegramTestMsg("");
                        const res = await actionSendTelegramTest();
                        setTelegramTestStatus(res.ok ? "ok" : "error");
                        setTelegramTestMsg(res.error ?? "");
                      }}
                      type="button"
                    >
                      {telegramTestStatus === "pending" ? "Odesílám…" : "Testovat zprávu"}
                    </button>
                    {webhookStatus !== "idle" && (
                      <span className={`text-[12px] font-medium ${webhookStatus === "ok" ? "text-green-600" : "text-red-500"}`}>
                        {webhookStatus === "ok" ? "✓ Webhook nastaven" : `✗ ${webhookMsg}`}
                      </span>
                    )}
                    {telegramTestStatus !== "idle" && (
                      <span className={`text-[12px] font-medium ${telegramTestStatus === "ok" ? "text-green-600" : "text-red-500"}`}>
                        {telegramTestStatus === "ok" ? "✓ Zpráva odeslána" : `✗ ${telegramTestMsg || "Chyba"}`}
                      </span>
                    )}
                  </div>
                </Section>

                {/* Telegram help modal */}
                {showTelegramHelp && (
                  <div className="modal-overlay" onClick={() => setShowTelegramHelp(false)}>
                    <div className="modal-sheet" role="dialog" aria-modal="true" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
                      <div className="modal-sheet__header">
                        <h3 className="modal-sheet__title">Jak nastavit Telegram bota</h3>
                        <button aria-label="Zavřít" className="w-11 h-11 rounded-full glass-btn inline-flex items-center justify-center text-stone-500 text-lg font-bold" onClick={() => setShowTelegramHelp(false)} type="button">×</button>
                      </div>
                      <div className="modal-sheet__body space-y-4">

                        {/* Intro */}
                        <div className="px-3 py-2.5 rounded-2xl text-[12.5px] text-stone-600 leading-relaxed" style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.15)" }}>
                          <strong>Jak to funguje:</strong> Jeden bot slouží celé firmě. Vytvoříš Telegram skupinu, přidáš do ní kolegy a bota — a všichni ve skupině budou dostávat notifikace. Nikdo si nic individuálně nezakládá.
                        </div>

                        {/* Steps */}
                        {[
                          {
                            num: "1",
                            title: "Vytvoř bota (2 minuty)",
                            body: <>V Telegramu vyhledej <strong>@BotFather</strong> (modrý fajfkový odznak = oficiální). Pošli mu <code className="bg-black/5 px-1 rounded">/newbot</code>, zadej libovolný název a uživatelské jméno (musí končit na <em>bot</em>, např. <em>ObeduLIMAbot</em>). BotFather ti okamžitě odpoví s <strong>Bot Tokenem</strong> — zkopíruj ho.</>,
                          },
                          {
                            num: "2",
                            title: "Vytvoř skupinu a přidej do ní bota i kolegy",
                            body: <>Vytvoř novou Telegram skupinu (např. „Obědy LIMA"). Přidej do ní svého nového bota a všechny kolegy, kteří mají dostávat notifikace.</>,
                          },
                          {
                            num: "3",
                            title: "Zjisti Chat ID skupiny",
                            body: <>Do skupiny přidej bota <strong>@getidsbot</strong> — ten hned odpoví s ID skupiny (záporné číslo začínající <code className="bg-black/5 px-1 rounded">-100...</code>). Zkopíruj ho a @getidsbot pak ze skupiny odstraň.</>,
                          },
                          {
                            num: "4",
                            title: "Vyplň nastavení a ulož",
                            body: <>Vlož <strong>Bot Token</strong> a <strong>Chat ID skupiny</strong> do polí výše, zaškrtni přepínač a klikni <strong>Uložit nastavení</strong>.</>,
                          },
                          {
                            num: "5",
                            title: "Nastav webhook",
                            body: <>Klikni na <strong>Nastavit webhook</strong> — tím Telegramu řekneš, kam má posílat příkazy z bota. Stačí jednou (opakuj jen při změně domény).</>,
                          },
                          {
                            num: "6",
                            title: "Otestuj",
                            body: <>Klikni na <strong>Testovat zprávu</strong>. Pokud vše funguje, bot napíše do skupiny testovací zprávu. Pak zkus napsat <code className="bg-black/5 px-1 rounded">/pomoc</code> přímo ve skupině.</>,
                          },
                        ].map((step) => (
                          <div key={step.num} className="flex gap-3">
                            <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-white text-[12px] font-display font-bold mt-0.5" style={{ background: "linear-gradient(135deg,#F59E0B,#EA580C)" }}>
                              {step.num}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-display font-bold text-[13px] text-stone-900">{step.title}</p>
                              <p className="text-[12.5px] text-stone-600 leading-relaxed mt-0.5">{step.body}</p>
                            </div>
                          </div>
                        ))}

                        {/* Commands reference */}
                        <div className="glass-soft rounded-2xl p-3.5 flex flex-col gap-2">
                          <p className="font-display font-bold text-[12.5px] text-stone-800">Příkazy (pište přímo ve skupině)</p>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
                            {[
                              ["/stav", "přehled dnešní objednávky"],
                              ["/menu", "dnešní jídelníček"],
                              ["/odeslat", "ruční odeslání objednávky"],
                              ["/zrusit", "znovu otevřít odeslanou objednávku"],
                              ["/pomoc", "seznam příkazů"],
                            ].map(([cmd, desc]) => (
                              <div key={cmd} className="contents">
                                <span className="font-mono text-amber-700 font-semibold">{cmd}</span>
                                <span className="text-stone-500">{desc}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <p className="text-[11.5px] text-stone-400">Příkazy fungují jen ze zadané skupiny — nikdo zvenčí bota ovládat nemůže.</p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

        {/* Version info */}
        <div className="flex items-center justify-center gap-2 pt-2 pb-1 text-[11px] text-stone-400">
          <span>Objednávky LIMA</span>
          <span className="text-stone-300">·</span>
          <span>v{process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0"}</span>
          {process.env.NEXT_PUBLIC_COMMIT_SHA && (
            <>
              <span className="text-stone-300">·</span>
              <span className="font-mono">{process.env.NEXT_PUBLIC_COMMIT_SHA.slice(0, 7)}</span>
            </>
          )}
        </div>
      </main>

      {/* ── Floating save button ── */}
      {unlocked && activeTab !== "oddeleni" && (
        <div className="settings-save-fab">
          {saveStatus === "saved" && <span className="settings-save-fab__status text-emerald-700">Nastavení uloženo.</span>}
          {saveStatus === "error" && <span className="settings-save-fab__status text-red-600">Chyba při ukládání.</span>}
          <button className="modal-btn modal-btn--primary" disabled={isPending} form="settings-form" type="submit">
            {isPending ? "Ukládám..." : "Uložit nastavení"}
          </button>
        </div>
      )}
    </div>
  );
}
