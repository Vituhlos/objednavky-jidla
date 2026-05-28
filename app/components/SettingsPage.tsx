"use client";

import { useState, useTransition, useRef, useEffect, memo, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  actionSendOrder,
  actionClearOrder,
  actionCheckImap,
  actionSendTestPush,
  actionSetTelegramWebhook,
  actionSendTelegramTest,
  actionGetTelegramSubscriptions,
  actionRemoveTelegramSubscription,
  actionSetTelegramAdmin,
  actionGetTelegramBotInfo,
  actionGetTelegramWebhookStatus,
  actionSetTelegramCommands,
  actionSetAppUserRole,
  actionAdminForceVerifyEmail,
  actionAdminResetPassword,
  actionAdminDeleteUser,
  getSettingsHealth,
  type SettingsHealth,
  type HealthStatus,
} from "@/app/actions";
import type { TelegramSubscription } from "@/lib/telegram";
import type { SafeUserRow, UserRole } from "@/lib/users";
import { ConfirmModal } from "./ConfirmModal";
import MIcon from "./MIcon";
import { useModalSwipe } from "@/app/hooks/useModalSwipe";
import { formatTs, getNextAutoSend, Section, Field, EmailListInput, Toggle } from "./settings/_shared";
import { getBuildInfo } from "@/lib/build-info";

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

const WEEKEND_DAYS = [
  { code: "So", label: "So" },
  { code: "Ne", label: "Ne" },
];

function ScheduleWeekStrip({ activeDays: initialActive, time }: { activeDays: string[]; time: string }) {
  // Kontrolovaný state s checkboxy pro form submit
  const [days, setDays] = useState<string[]>(initialActive);
  const toggle = (code: string) => {
    setDays((prev) => prev.includes(code) ? prev.filter((d) => d !== code) : [...prev, code]);
  };
  const all = [...DAY_OPTIONS, ...WEEKEND_DAYS];
  return (
    <>
      <div className="schedule-week mt-1">
        {all.map((d) => {
          const isWeekend = d.code === "So" || d.code === "Ne";
          const active = days.includes(d.code);
          return (
            <button
              key={d.code}
              type="button"
              onClick={() => toggle(d.code)}
              className={`schedule-day${active ? " active" : ""}${isWeekend ? " weekend" : ""}`}
              aria-pressed={active}
            >
              <span className="schedule-day__name">{d.label}</span>
              <span className="schedule-day__time">{active ? time : "—"}</span>
            </button>
          );
        })}
      </div>
      {/* Hidden checkboxes pro form submit — replicating original interface */}
      <div className="sr-only" aria-hidden>
        {DAY_OPTIONS.map((d) => (
          <input
            key={d.code}
            type="checkbox"
            name={`autoSendDay_${d.code}`}
            checked={days.includes(d.code)}
            onChange={() => toggle(d.code)}
          />
        ))}
      </div>
    </>
  );
}

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

// Helpers (Section, Field, EmailListInput, Toggle, formatTs, getNextAutoSend)
// moved to ./settings/_shared

// ── Department row ────────────────────────────────────────────────────────────

const DeptRow = memo(function DeptRow({
  dept, dailyCount = 0, onSave, onDelete, onMoveUp, onMoveDown, isFirst, isLast,
}: {
  dept: DepartmentInfo;
  dailyCount?: number;
  onSave: (id: number, data: Partial<{ label: string; emailLabel: string; accent: string }>) => void;
  onDelete: (id: number) => void;
  onMoveUp: (id: number) => void;
  onMoveDown: (id: number) => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [editingField, setEditingField] = useState<"label" | "emailLabel" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [tempLabel, setTempLabel] = useState(dept.label);
  const [tempEmailLabel, setTempEmailLabel] = useState(dept.emailLabel);
  const menuRef = useRef<HTMLDivElement>(null);
  const dotColor = ACCENT_COLORS[dept.accent] ?? "#94a3b8";

  useEffect(() => {
    if (!showMenu) return;
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showMenu]);

  const handleLabelSave = () => {
    if (tempLabel.trim() && tempLabel !== dept.label) {
      onSave(dept.id, { label: tempLabel.trim() });
    } else {
      setTempLabel(dept.label);
    }
    setEditingField(null);
  };

  const handleEmailLabelSave = () => {
    if (tempEmailLabel.trim() && tempEmailLabel !== dept.emailLabel) {
      onSave(dept.id, { emailLabel: tempEmailLabel.trim() });
    } else {
      setTempEmailLabel(dept.emailLabel);
    }
    setEditingField(null);
  };

  return (
    <div className="dept-editor-row" data-dept-id={dept.id}>
      <div
        className="dept-editor-row__grip"
        title="Přetáhni pro řazení"
        aria-label={`Přesunout ${dept.label}`}
      >
        <MIcon name="drag_indicator" size={16} />
      </div>
      <div
        className="dept-editor-row__icon"
        style={{ background: `${dotColor}22`, color: dotColor }}
      >
        <MIcon name="groups" size={15} fill />
      </div>
      <div className="dept-editor-row__body">
        {editingField === "label" ? (
          <input
            autoFocus
            className="modal-input !py-1 !text-[13px] !font-bold"
            value={tempLabel}
            onChange={(e) => setTempLabel(e.target.value)}
            onBlur={handleLabelSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleLabelSave();
              if (e.key === "Escape") { setTempLabel(dept.label); setEditingField(null); }
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingField("label")}
            className="dept-editor-row__name text-left hover:underline hover:underline-offset-2 truncate w-full"
            title="Klik pro editaci"
          >
            {dept.label}
          </button>
        )}
        {editingField === "emailLabel" ? (
          <input
            autoFocus
            className="modal-input !py-0.5 !text-[11px] mt-1"
            value={tempEmailLabel}
            onChange={(e) => setTempEmailLabel(e.target.value)}
            onBlur={handleEmailLabelSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleEmailLabelSave();
              if (e.key === "Escape") { setTempEmailLabel(dept.emailLabel); setEditingField(null); }
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingField("emailLabel")}
            className="dept-editor-row__sub text-left hover:underline hover:underline-offset-2 truncate w-full"
            title="Klik pro editaci názvu v e-mailu"
          >
            Email štítek: {dept.emailLabel}
          </button>
        )}
      </div>

      {/* Color swatches */}
      <div className="color-swatches">
        {ACCENT_OPTIONS.map((opt) => {
          const color = ACCENT_COLORS[opt.value];
          const active = dept.accent === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              aria-label={`Barva ${opt.label}`}
              title={opt.label}
              onClick={() => onSave(dept.id, { accent: opt.value })}
              className={`color-swatch${active ? " active" : ""}`}
              style={{ background: color, ["--swatch-color" as string]: color }}
            />
          );
        })}
      </div>

      <span
        className={`dept-editor-row__count${dailyCount === 0 ? " dept-editor-row__count--zero" : ""}`}
        title={dailyCount > 0 ? `${dailyCount} dnešních objednávek` : "Dnes nikdo neobjednal"}
      >
        {dailyCount} dnes
      </span>

      <div className="relative" ref={menuRef}>
        <button
          aria-label={`Menu oddělení ${dept.label}`}
          type="button"
          onClick={() => setShowMenu((v) => !v)}
          className="w-7 h-7 rounded-full inline-flex items-center justify-center text-stone-400 hover:bg-white/70 hover:text-stone-700"
        >
          <MIcon name="more_horiz" size={16} />
        </button>
        {showMenu && (
          <div className="row-menu-dropdown absolute right-0 top-full mt-1 z-30" style={{ minWidth: 160 }}>
            <button
              type="button"
              disabled={isFirst}
              onClick={() => { onMoveUp(dept.id); setShowMenu(false); }}
              className="disabled:opacity-30"
            >Přesunout nahoru</button>
            <button
              type="button"
              disabled={isLast}
              onClick={() => { onMoveDown(dept.id); setShowMenu(false); }}
              className="disabled:opacity-30"
            >Přesunout dolů</button>
            <button
              type="button"
              className="row-menu-danger"
              onClick={() => { setShowMenu(false); setConfirmDelete(true); }}
            >Smazat oddělení</button>
          </div>
        )}
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
});

// ── Tabs ─────────────────────────────────────────────────

type Tab = "objednavka" | "notifikace" | "ceny" | "email" | "oddeleni" | "uzivatele" | "telegram" | "prihlaseni" | "system";

const TABS: { id: Tab; label: string; icon: string; healthKey?: keyof SettingsHealth }[] = [
  { id: "objednavka",  label: "Provoz",      icon: "schedule",       healthKey: "autoSend" },
  { id: "notifikace",  label: "Notifikace",  icon: "notifications",  healthKey: "push" },
  { id: "ceny",        label: "Ceník",       icon: "payments",       healthKey: "prices" },
  { id: "email",       label: "E-mail",      icon: "mail",           healthKey: "smtp" },
  { id: "oddeleni",    label: "Oddělení",    icon: "groups",         healthKey: "departments" },
  { id: "uzivatele",   label: "Uživatelé",   icon: "person" },
  { id: "telegram",    label: "Telegram",    icon: "send" },
  { id: "prihlaseni",  label: "Přihlášení",  icon: "login",          healthKey: "google" },
  { id: "system",      label: "Systém",      icon: "build",          healthKey: "pin" },
];

// Index for ⌘K search
const SETTINGS_INDEX: Array<{ tab: Tab; field: string; label: string; keywords: string }> = [
  { tab: "objednavka", field: "field-cutoffTime",      label: "Čas uzávěrky",            keywords: "uzávěrka cutoff čas hodina kdy uzavřít" },
  { tab: "objednavka", field: "field-autoSendEnabled", label: "Automatické odeslání",    keywords: "auto send automatika odeslání schedule plán" },
  { tab: "objednavka", field: "field-autoSendTime",    label: "Čas auto-odeslání",       keywords: "auto čas send" },
  { tab: "objednavka", field: "field-autoSendDays",    label: "Dny auto-odeslání",       keywords: "auto dny send týden" },
  { tab: "objednavka", field: "field-imapEnabled",     label: "Auto-import jídelníčku",  keywords: "imap import jídelníček menu pdf email" },
  { tab: "objednavka", field: "field-pizzaCutoffTime", label: "Uzávěrka pizzy",          keywords: "pizza cutoff čas" },
  { tab: "notifikace", field: "field-pushReminderMinutes", label: "Připomínka před uzávěrkou", keywords: "push notifikace připomínka reminder" },
  { tab: "notifikace", field: "field-reminderEmailTo", label: "E-mailové připomínky",    keywords: "email připomínka reminder" },
  { tab: "ceny",       field: "field-defaultSoupPrice", label: "Cena polévky",           keywords: "cena polévka soup price" },
  { tab: "ceny",       field: "field-defaultMealPrice", label: "Cena hlavního jídla",    keywords: "cena jídlo meal hlavní" },
  { tab: "ceny",       field: "field-priceRoll",        label: "Cena housky",            keywords: "houska rohlík cena příloha" },
  { tab: "ceny",       field: "field-priceBreadDumpling", label: "Cena houskového knedlíku", keywords: "knedlík houskový cena příloha" },
  { tab: "ceny",       field: "field-pricePotatoDumpling", label: "Cena bramborového knedlíku", keywords: "knedlík bramborový cena příloha" },
  { tab: "email",      field: "field-smtpHost",         label: "SMTP server",            keywords: "smtp host server email gmail outlook" },
  { tab: "email",      field: "field-smtpUser",         label: "SMTP uživatel",          keywords: "smtp user uživatel přihlášení login email" },
  { tab: "email",      field: "field-smtpFrom",         label: "Odesílatel (From)",      keywords: "smtp from odesílatel adresa" },
  { tab: "email",      field: "field-orderEmailTo",     label: "Příjemce objednávky",    keywords: "příjemce to email lima" },
  { tab: "oddeleni",   field: "field-departments",     label: "Oddělení",               keywords: "oddělení department konstrukce dílna kanceláře" },
  { tab: "telegram",   field: "field-telegramBotToken", label: "Telegram bot token",    keywords: "telegram bot token botfather" },
  { tab: "telegram",   field: "field-telegramAppUrl",   label: "URL aplikace",          keywords: "telegram url aplikace webhook" },
  { tab: "system",      field: "field-settingsPin",       label: "PIN",                    keywords: "pin heslo přístup zámek security" },
  { tab: "system",      field: "field-backup",            label: "Záloha",                 keywords: "backup záloha export json" },
  { tab: "system",      field: "field-restore",           label: "Obnova",                 keywords: "restore obnova import" },
  { tab: "system",      field: "field-auditLog",          label: "Audit log",              keywords: "audit log historie změny" },
  { tab: "prihlaseni",  field: "field-googleClientId",    label: "Google Client ID",       keywords: "google oauth sso přihlášení client id" },
  { tab: "prihlaseni",  field: "field-adminEmails",       label: "Admin e-maily",          keywords: "admin email správce role oprávnění" },
];

// ── Main component ────────────────────────────────────────────────────────────

export default function SettingsPage({
  settings,
  departments: initialDepts,
  auditLog: initialAuditLog,
  todayOrder,
  adminUnlocked = false,
  appUsers: initialAppUsers = [],
  currentUserId,
}: {
  settings: AppSettings;
  departments: DepartmentInfo[];
  auditLog: AuditEntry[];
  todayOrder?: { id: number; status: string };
  adminUnlocked?: boolean;
  appUsers?: SafeUserRow[];
  currentUserId?: number;
}) {
  const [unlocked, setUnlocked] = useState(adminUnlocked);
  const [activeTab, setActiveTab] = useState<Tab>("objednavka");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [isPending, startTransition] = useTransition();
  const pinInputRef = useRef<HTMLInputElement>(null);
  const sessionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

  const resetSessionTimer = () => {
    if (adminUnlocked) return;
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
  const [commandsStatus, setCommandsStatus] = useState<"idle" | "pending" | "ok" | "error">("idle");
  const [showTelegramHelp, setShowTelegramHelp] = useState(false);
  const { sheetRef: telegramHelpSheetRef } = useModalSwipe(useCallback(() => setShowTelegramHelp(false), []));
  const [telegramSubs, setTelegramSubs] = useState<TelegramSubscription[]>([]);
  const [telegramSubsLoaded, setTelegramSubsLoaded] = useState(false);
  const router = useRouter();
  const [appUsers, setAppUsers] = useState<SafeUserRow[]>(initialAppUsers);
  const [appUserError, setAppUserError] = useState<string | null>(null);
  const [resetUserId, setResetUserId] = useState<number | null>(null);
  const [resetPwd, setResetPwd] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [botInfo, setBotInfo] = useState<{ ok: boolean; firstName?: string; username?: string; error?: string } | null>(null);
  const [webhookInfo, setWebhookInfo] = useState<{ ok: boolean; hasWebhook: boolean; url?: string } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [pushTestMsg, setPushTestMsg] = useState("");
  const [showGoogleHelp, setShowGoogleHelp] = useState(false);
  const { sheetRef: googleHelpSheetRef } = useModalSwipe(useCallback(() => setShowGoogleHelp(false), []));
  const [draggingDeptId, setDraggingDeptId] = useState<number | null>(null);
  const dragIdRef = useRef<number | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<number | null>(null);
  const [deleteUserLoading, setDeleteUserLoading] = useState(false);
  const [auditFilter, setAuditFilter] = useState<string>("all");
  const [departments, setDepartments] = useState<DepartmentInfo[]>(initialDepts);
  const [deptError, setDeptError] = useState<string | null>(null);
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptLabel, setNewDeptLabel] = useState("");
  const [newDeptAccent, setNewDeptAccent] = useState("blue");
  const [showAddDept, setShowAddDept] = useState(false);
  const [reopenDone, setReopenDone] = useState(false);
  const [resendStatus, setResendStatus] = useState<"idle" | "pending" | "done" | "error">("idle");
  const [sendStatus, setSendStatus] = useState<"idle" | "pending" | "done" | "error">("idle");
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearDone, setClearDone] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const confirmedPinRef = useRef("");
  const imapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (imapTimeoutRef.current) clearTimeout(imapTimeoutRef.current); }, []);

  // Health check
  const [health, setHealth] = useState<SettingsHealth | null>(null);
  useEffect(() => {
    if (!unlocked) return;
    getSettingsHealth().then(setHealth).catch(() => {});
  }, [unlocked, saveStatus]);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
  }, []);
  useEffect(() => {
    if (!unlocked) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [unlocked]);

  useEffect(() => {
    if (activeTab !== "telegram") return;
    if (!telegramSubsLoaded) {
      actionGetTelegramSubscriptions().then((subs) => {
        setTelegramSubs(subs);
        setTelegramSubsLoaded(true);
      });
    }
    if (botInfo === null && settings.telegramBotToken) {
      Promise.all([
        actionGetTelegramBotInfo(),
        actionGetTelegramWebhookStatus(),
      ]).then(([info, webhook]) => {
        setBotInfo(info);
        setWebhookInfo(webhook);
      });
    }
  }, [activeTab, telegramSubsLoaded, botInfo, settings.telegramBotToken]);

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
      telegramMorningMenuTime: fd.get("telegramMorningMenuTime") as string,
      telegramAppUrl: fd.get("telegramAppUrl") as string,
      pizzaEnabled: fd.get("pizzaEnabled") === "on" ? "true" : "false",
      pizzaCutoffEnabled: fd.get("pizzaCutoffEnabled") === "on" ? "true" : "false",
      pizzaCutoffTime: fd.get("pizzaCutoffTime") as string,
      pizzaCutoffDays: DAY_OPTIONS
        .filter((d) => fd.get(`pizzaCutoffDay_${d.code}`) === "on")
        .map((d) => d.code)
        .join(","),
    };
    const newPin = (fd.get("newPin") as string).trim();
    if (newPin) updates.settingsPin = newPin;
    const webhookSecret = (fd.get("telegramWebhookSecret") as string).trim();
    if (webhookSecret) updates.telegramWebhookSecret = webhookSecret;
    updates.googleClientId = (fd.get("googleClientId") as string ?? "").trim();
    const googleSecret = (fd.get("googleClientSecret") as string).trim();
    if (googleSecret) updates.googleClientSecret = googleSecret;
    updates.adminEmails = (fd.get("adminEmails") as string ?? "").trim();

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

  // ⌘K search results
  const sq = searchQuery.trim().toLowerCase();
  const searchResults = sq
    ? SETTINGS_INDEX.filter((item) =>
        item.label.toLowerCase().includes(sq) || item.keywords.toLowerCase().includes(sq)
      ).slice(0, 6)
    : [];

  const jumpToField = (tab: Tab, fieldId: string) => {
    setActiveTab(tab);
    setSearchQuery("");
    setTimeout(() => {
      const el = document.getElementById(fieldId);
      if (!el) return;
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      el.classList.add("flash-highlight");
      setTimeout(() => el.classList.remove("flash-highlight"), 1700);
    }, 50);
  };

  return (
    <div className="k-shell">

      {/* Desktop topbar */}
      <div className="hidden md:flex px-5 py-2.5 border-b border-white/50 items-center gap-3 topbar shrink-0">
        <MIcon name="settings" size={16} fill style={{ color: "#D97706" }} />
        <span className="font-display font-bold text-[15px] text-stone-900">Nastavení</span>
        {unlocked && (
          <div className="ml-auto relative">
            <div className="search-pill">
              <MIcon name="search" size={14} style={{ color: "#a8a29e" }} />
              <input
                ref={searchInputRef}
                type="search"
                placeholder="Hledat nastavení…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <span className="search-pill__kbd">⌘ K</span>
            </div>
            {searchResults.length > 0 && (
              <div
                className="absolute right-0 top-full mt-1.5 w-[320px] z-50 glass-card rounded-2xl overflow-hidden"
                role="listbox"
              >
                {searchResults.map((r) => (
                  <button
                    key={`${r.tab}-${r.field}`}
                    type="button"
                    role="option"
                    aria-selected="false"
                    onClick={() => jumpToField(r.tab, r.field)}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[12.5px] hover:bg-amber-50/60 border-b border-white/30 last:border-0"
                  >
                    <MIcon name={TABS.find((t) => t.id === r.tab)?.icon ?? "settings"} size={13} style={{ color: "#D97706", flexShrink: 0 }} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-stone-900 truncate">{r.label}</div>
                      <div className="text-[10.5px] text-stone-500">{TABS.find((t) => t.id === r.tab)?.label}</div>
                    </div>
                    <MIcon name="arrow_forward" size={13} style={{ color: "#a8a29e" }} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile topbar */}
      <div className="md:hidden border-b border-white/50 topbar shrink-0 px-4 py-2.5 flex items-center gap-2">
        <span className="font-display font-bold text-[14px] text-stone-900">Nastavení</span>
        {unlocked && (
          <input
            className="modal-input !py-1.5 !text-[12px] ml-auto"
            placeholder="Hledat…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            type="search"
            style={{ width: 160 }}
          />
        )}
      </div>
      {/* Mobile search results */}
      {unlocked && searchResults.length > 0 && (
        <div className="md:hidden border-b border-white/40">
          {searchResults.map((r) => (
            <button
              key={`${r.tab}-${r.field}`}
              type="button"
              onClick={() => jumpToField(r.tab, r.field)}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-[12.5px] bg-white/40"
            >
              <MIcon name={TABS.find((t) => t.id === r.tab)?.icon ?? "settings"} size={13} style={{ color: "#D97706" }} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-stone-900">{r.label}</div>
                <div className="text-[10.5px] text-stone-500">{TABS.find((t) => t.id === r.tab)?.label}</div>
              </div>
              <MIcon name="arrow_forward" size={13} />
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto scroll-area p-4 md:p-5 pb-nav lg:pb-24">
        <div className="max-w-6xl mx-auto w-full">
        {!unlocked ? (
          /* PIN lock */
          <div className="glass-card rounded-3xl overflow-hidden max-w-sm mx-auto mt-8">
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
            {/* Health overview banner */}
            {health && (() => {
              const items: Array<{ key: keyof SettingsHealth; label: string; icon: string }> = [
                { key: "smtp",        label: "SMTP server",       icon: "send" },
                { key: "autoSend",    label: "Auto-odeslání",     icon: "schedule" },
                { key: "autoImport",  label: "Auto-import menu",  icon: "menu_book" },
                { key: "push",        label: "Push notifikace",   icon: "notifications" },
                { key: "pin",         label: "PIN",               icon: "lock" },
                { key: "departments", label: "Oddělení",          icon: "groups" },
              ];
              const okCount = items.filter((it) => health[it.key].status === "ok").length;
              const warnCount = items.filter((it) => health[it.key].status === "warning").length;
              const errCount = items.filter((it) => health[it.key].status === "error").length;
              const headline = errCount > 0
                ? `${errCount} ${errCount === 1 ? "kritický problém" : "kritické problémy"}`
                : warnCount > 0
                  ? `${warnCount} ${warnCount === 1 ? "upozornění" : "upozornění"}`
                  : "Vše hlavní funguje";
              return (
                <div className="glass-card rounded-3xl overflow-hidden mb-4">
                  <div
                    className="flex items-center gap-3 px-4 py-2.5 border-b border-white/40"
                    style={{
                      background: errCount > 0 ? "rgba(220,38,38,0.07)" :
                                  warnCount > 0 ? "rgba(245,158,11,0.07)" :
                                                  "rgba(34,197,94,0.07)",
                    }}
                  >
                    <MIcon
                      name={errCount > 0 ? "error" : warnCount > 0 ? "warning" : "check_circle"}
                      size={16}
                      fill
                      style={{ color: errCount > 0 ? "#dc2626" : warnCount > 0 ? "#D97706" : "#16a34a" }}
                    />
                    <span className="font-display font-bold text-[13.5px] text-stone-900 flex-1">
                      Stav konfigurace · <span className="font-normal text-stone-600">{headline}</span>
                    </span>
                    <span className="text-[11.5px] font-semibold text-stone-500">{okCount}/{items.length} OK</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 p-3">
                    {items.map((it) => {
                      const h = health[it.key];
                      return (
                        <div key={it.key} className={`status-badge status-badge--${h.status === "ok" ? "ok" : h.status === "warning" ? "warn" : "error"}`}>
                          <div className="status-badge__icon">
                            <MIcon name={h.status === "ok" ? "check_circle" : h.status === "warning" ? "warning" : "error"} size={13} fill />
                          </div>
                          <div className="min-w-0">
                            <div className="status-badge__title truncate">{it.label}</div>
                            <div className="status-badge__sub truncate">{h.sub}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-5">
            {/* Vertical tab bar (desktop) */}
            <nav className="hidden lg:flex flex-col gap-1 sticky top-0 self-start">
              {TABS.map((tab) => {
                const h = tab.healthKey ? health?.[tab.healthKey] : null;
                const dotClass = h?.status === "ok" ? "settings-tab__dot--ok"
                              : h?.status === "warning" ? "settings-tab__dot--warn"
                              : h?.status === "error" ? "settings-tab__dot--error"
                              : "";
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`settings-tab${activeTab === tab.id ? " active" : ""}`}
                  >
                    <MIcon name={tab.icon as "settings"} size={15} fill={activeTab === tab.id} style={{ color: activeTab === tab.id ? "#D97706" : "#78716c" }} />
                    <span className="settings-tab__label">{tab.label}</span>
                    {tab.id === "telegram" && telegramSubsLoaded && telegramSubs.length > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none bg-amber-500/15 text-amber-700">
                        {telegramSubs.length}
                      </span>
                    )}
                    {dotClass && <span className={`settings-tab__dot ${dotClass}`} aria-hidden />}
                  </button>
                );
              })}
            </nav>

            {/* Horizontal tab bar (mobile + tablet) */}
            <div className="lg:hidden overflow-x-auto no-scrollbar -mx-1 px-1">
              <div
                className="flex p-1 rounded-2xl gap-0.5"
                style={{ width: "max-content", background: "rgba(26,18,8,0.06)", border: "1px solid rgba(255,255,255,0.55)" }}
              >
                {TABS.map((tab) => {
                  const h = tab.healthKey ? health?.[tab.healthKey] : null;
                  const dotClass = h?.status === "ok" ? "settings-tab__dot--ok"
                                : h?.status === "warning" ? "settings-tab__dot--warn"
                                : h?.status === "error" ? "settings-tab__dot--error"
                                : "";
                  return (
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
                      {tab.id === "telegram" && telegramSubsLoaded && telegramSubs.length > 0 && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${activeTab === "telegram" ? "bg-white/25 text-white" : "bg-amber-500/15 text-amber-700"}`}>
                          {telegramSubs.length}
                        </span>
                      )}
                      {dotClass && <span className={`settings-tab__dot ${dotClass} ml-0.5`} aria-hidden />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4 mt-4 lg:mt-0">

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
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-2xl glass-btn text-stone-600"
                        disabled={isPending || sendStatus === "pending"}
                        onClick={() => {
                          setSendStatus("pending");
                          startTransition(async () => {
                            try {
                              await actionSendOrder(todayOrder.id);
                              setSendStatus("done");
                            } catch {
                              setSendStatus("error");
                            }
                          });
                        }}
                        type="button"
                      >
                        <MIcon name="send" size={14} />
                        {sendStatus === "pending" ? "Odesílám…" : "Odeslat ručně"}
                      </button>
                      <button
                        className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-2xl glass-btn-danger"
                        disabled={isPending}
                        onClick={() => setClearConfirm(true)}
                        type="button"
                      >
                        <MIcon name="delete" size={14} /> Smazat celou objednávku
                      </button>
                    </div>
                    {sendStatus === "done" && (
                      <p className="text-[12px] text-green-700 inline-flex items-center gap-1.5">
                        <MIcon name="check_circle" size={13} fill /> Objednávka byla odeslána.
                      </p>
                    )}
                    {sendStatus === "error" && (
                      <p className="text-[12px] text-red-500">Chyba při odesílání. Zkontrolujte SMTP nastavení.</p>
                    )}
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
                    <div
                      key={dept.id}
                      draggable
                      style={{ opacity: draggingDeptId === dept.id ? 0.35 : 1, transition: "opacity 0.15s" }}
                      onDragStart={(e) => {
                        dragIdRef.current = dept.id;
                        setDraggingDeptId(dept.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const fromId = dragIdRef.current;
                        if (fromId === null || fromId === dept.id) return;
                        const fromIdx = departments.findIndex((d) => d.id === fromId);
                        const next = [...departments];
                        const [item] = next.splice(fromIdx, 1);
                        next.splice(idx, 0, item);
                        setDepartments(next);
                        dragIdRef.current = null;
                        setDraggingDeptId(null);
                        startTransition(async () => { await actionReorderDepartments(next.map((d) => d.id)); });
                      }}
                      onDragEnd={() => { setDraggingDeptId(null); dragIdRef.current = null; }}
                    >
                      <DeptRow
                        dept={dept}
                        isFirst={idx === 0}
                        isLast={idx === departments.length - 1}
                        onDelete={handleDeptDelete}
                        onMoveDown={(id) => handleDeptMove(id, "down")}
                        onMoveUp={(id) => handleDeptMove(id, "up")}
                        onSave={handleDeptSave}
                      />
                    </div>
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
                    <input className="modal-input w-32" defaultValue={settings.cutoffTime} name="cutoffTime" type="time" aria-label="Čas uzávěrky" />
                  </Field>
                </Section>

                <Section icon="schedule" title="Automatické odeslání">
                  <p className="text-[12.5px] text-stone-500">
                    Objednávka se automaticky odešle v nastavenou dobu. Přeskočí se pokud je den označen jako zavřený nebo pokud není splněný minimální počet objednávek.
                  </p>
                  <Toggle defaultChecked={settings.autoSendEnabled === "true"} label="Zapnout automatické odeslání" name="autoSendEnabled" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field hint="čas kdy se objednávka automaticky odešle" label="Čas odeslání">
                      <input className="modal-input w-32" defaultValue={settings.autoSendTime} name="autoSendTime" type="time" aria-label="Čas odeslání" />
                    </Field>
                    <Field hint="minimálně N objednávek, jinak se přeskočí" label="Minimální počet objednávek">
                      <input className="modal-input w-24" defaultValue={settings.autoSendMinOrders} min="1" name="autoSendMinOrders" type="number" aria-label="Minimální počet objednávek" />
                    </Field>
                  </div>
                  <Field label="Dny odeslání" hint="Týdenní pruh — klikni na den pro zapnutí / vypnutí">
                    {/* Visual week strip (controlled via hidden checkboxes for form submit) */}
                    <ScheduleWeekStrip
                      activeDays={activeDays}
                      time={settings.autoSendTime || "08:00"}
                    />
                  </Field>
                  <Field hint="e-mail(y) kam přijde upozornění při selhání auto-send — prázdné = použije se adresa z upozornění na jídelníček" label="Upozornění při selhání">
                    <input className="modal-input" defaultValue={settings.autoSendFailureEmail} name="autoSendFailureEmail" placeholder="admin@firma.cz" type="email" />
                  </Field>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px]" style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.15)" }}>
                    <MIcon name="event_upcoming" size={14} style={{ color: "#D97706" }} />
                    <span className="text-stone-500">Příští odeslání:</span>
                    <span className="font-semibold text-stone-700">{getNextAutoSend(settings.autoSendEnabled, settings.autoSendTime, settings.autoSendDays)}</span>
                  </div>
                </Section>

                <Section icon="local_pizza" title="Pizza modul">
                  <p className="text-[12.5px] text-stone-500">
                    Pizza modul přidává do appky stránku Pizza, sekci v Historii a vlastní příkazy v Telegram botovi. Při vypnutí je vše skryto a scraper běží naprázdno (objednávky v DB zůstávají).
                  </p>
                  <Toggle defaultChecked={settings.pizzaEnabled !== "false"} label="Zapnout pizza modul" name="pizzaEnabled" />
                </Section>

                {settings.pizzaEnabled !== "false" && (
                <Section icon="local_pizza" title="Pizza – uzávěrka">
                  <p className="text-[12.5px] text-stone-500">
                    V nastavenou dobu se objednávka pizzy automaticky uzavře — nikdo již nebude moci přidávat ani měnit objednávky.
                  </p>
                  <Toggle defaultChecked={settings.pizzaCutoffEnabled === "true"} label="Zapnout automatickou uzávěrku pizzy" name="pizzaCutoffEnabled" />
                  <Field hint="čas kdy se objednávka uzavře" label="Čas uzávěrky">
                    <input className="modal-input w-32" defaultValue={settings.pizzaCutoffTime} name="pizzaCutoffTime" type="time" />
                  </Field>
                  <Field label="Dny uzávěrky">
                    <div className="flex gap-3 flex-wrap mt-0.5">
                      {DAY_OPTIONS.map((d) => {
                        const pizzaDays = settings.pizzaCutoffDays.split(",").map((x) => x.trim());
                        return (
                          <label className="flex items-center gap-1.5 cursor-pointer" key={d.code}>
                            <div className="relative shrink-0">
                              <input
                                className="peer sr-only"
                                defaultChecked={pizzaDays.includes(d.code)}
                                name={`pizzaCutoffDay_${d.code}`}
                                type="checkbox"
                              />
                              <div className="w-9 h-[20px] rounded-full bg-black/15 transition-colors peer-checked:[background:linear-gradient(135deg,#F59E0B,#EA580C)]" />
                              <div className="absolute top-[3px] left-[3px] w-3.5 h-3.5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-[16px]" />
                            </div>
                            <span className="text-[12px] font-semibold text-stone-700">{d.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </Field>
                </Section>
                )}

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

              </div>

              {/* Notifikace tab — Push + odkazy na ostatní notifikační kanály */}
              <div className="flex flex-col gap-4" style={{ display: activeTab === "notifikace" ? "flex" : "none" }}>
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
                <div className="glass-card rounded-3xl p-4 text-[12.5px] text-stone-600 space-y-2">
                  <p>📨 <strong>E-mail příjemci alertů</strong> (auto-send selhal, chybí jídelníček) → nastav v <em>Provoz</em> tabu u příslušných sekcí.</p>
                  <p>📱 <strong>Telegram notifikace</strong> → kompletní nastavení v <em>Telegram</em> tabu.</p>
                </div>
              </div>

              {/* E-mail tab — SMTP + odesílatel objednávky */}
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

              {/* Přihlášení tab */}
              <div className="flex flex-col gap-4" style={{ display: activeTab === "prihlaseni" ? "flex" : "none" }}>

                <Section icon="login" title="Google OAuth" action={
                  <button type="button" onClick={() => setShowGoogleHelp(true)} className="inline-flex items-center gap-1 text-[11.5px] font-semibold px-2.5 py-1.5 rounded-full glass-btn text-stone-500">
                    <MIcon name="help_outline" size={13} /> Jak nastavit?
                  </button>
                }>
                  <div
                    className="flex items-start gap-2.5 px-3.5 py-3 rounded-2xl text-[12px]"
                    style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)" }}
                  >
                    <MIcon name="info" size={15} style={{ color: "#D97706", flexShrink: 0, marginTop: 1 }} />
                    <div className="text-stone-600 leading-relaxed">
                      <strong className="text-stone-800">Změny Google credentials</strong> se projeví až po restartu kontejneru — Auth.js inicializuje OAuth providery při startu procesu. Admin e-maily se projeví okamžitě.
                    </div>
                  </div>
                  <Field label="Google Client ID" hint="z Google Cloud Console → APIs & Services → Credentials">
                    <input
                      className="modal-input font-mono text-[12px]"
                      defaultValue={settings.googleClientId}
                      name="googleClientId"
                      placeholder="123456789-abc...apps.googleusercontent.com"
                      type="text"
                      autoComplete="off"
                    />
                  </Field>
                  <Field label="Google Client Secret" hint="prázdné pole = beze změny">
                    <input
                      className="modal-input font-mono text-[12px]"
                      name="googleClientSecret"
                      placeholder={settings.googleClientSecret ? "••••••••••••" : "GOCSPX-..."}
                      type="password"
                      autoComplete="new-password"
                    />
                    {settings.googleClientSecret && (
                      <p className="text-[11px] text-emerald-700 mt-1.5">Secret je uložen. Prázdné pole při uložení = beze změny.</p>
                    )}
                  </Field>
                  <Field label="Callback URL (zkopíruj do Google Console)" hint="Authorized redirect URIs">
                    <div className="flex items-center gap-2">
                      <input
                        className="modal-input font-mono text-[12px] flex-1"
                        value={typeof window !== "undefined" ? `${window.location.origin}/api/auth/callback/google` : "/api/auth/callback/google"}
                        readOnly
                      />
                      <button
                        type="button"
                        className="modal-btn modal-btn--secondary shrink-0"
                        onClick={() => {
                          const url = `${window.location.origin}/api/auth/callback/google`;
                          navigator.clipboard.writeText(url);
                        }}
                      >
                        <MIcon name="content_copy" size={14} />
                      </button>
                    </div>
                  </Field>
                </Section>

                <Section icon="admin_panel_settings" title="Admin e-maily">
                  <Field label="Admin e-maily" hint="čárkou oddělené e-maily — uživatelé s těmito adresami se při přihlášení stávají adminy">
                    <textarea
                      className="modal-input font-mono text-[12px] resize-none"
                      defaultValue={settings.adminEmails}
                      name="adminEmails"
                      placeholder="admin@firma.cz, boss@firma.cz"
                      rows={3}
                    />
                  </Field>
                  <p className="text-[11.5px] text-stone-500">
                    Platí okamžitě při dalším přihlášení. Role existujících uživatelů lze měnit ručně v záložce Uživatelé.
                  </p>
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

              {/* Telegram tab — form part (token + toggle) */}
              <div className="flex flex-col gap-4" style={{ display: activeTab === "telegram" ? "flex" : "none" }}>
                <Section icon="send" title="Telegram bot" action={
                  <div className="flex items-center gap-2">
                    {/* Status dot */}
                    {(() => {
                      const hasToken = !!settings.telegramBotToken;
                      const connected = botInfo?.ok;
                      const hasWebhook = webhookInfo?.hasWebhook;
                      const color = !hasToken ? "#a8a29e" : connected && hasWebhook ? "#16a34a" : connected ? "#f59e0b" : "#ef4444";
                      const label = !hasToken ? "Nenastaveno" : connected && hasWebhook ? "Připojeno" : connected ? "Token OK, webhook chybí" : "Chyba tokenu";
                      return (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium" style={{ color }}>
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                          {label}
                        </span>
                      );
                    })()}
                    <button type="button" onClick={() => setShowTelegramHelp(true)} className="inline-flex items-center gap-1 text-[11.5px] font-semibold px-2.5 py-1.5 rounded-full glass-btn text-stone-500">
                      <MIcon name="help_outline" size={13} /> Jak nastavit?
                    </button>
                  </div>
                }>
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
                  <Field
                    hint="Telegram posílá tento token v hlavičce X-Telegram-Bot-Api-Secret-Token. Po změně znovu klikni „Nastavit webhook“."
                    label="Webhook secret"
                  >
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        className="modal-input font-mono text-[12px] flex-1"
                        name="telegramWebhookSecret"
                        placeholder={settings.telegramWebhookSecret ? "••••••••••••" : "vygenerujte nebo vložte secret"}
                        type="password"
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        className="modal-btn modal-btn--secondary shrink-0"
                        onClick={() => {
                          const input = formRef.current?.querySelector<HTMLInputElement>(
                            'input[name="telegramWebhookSecret"]',
                          );
                          if (!input) return;
                          const bytes = new Uint8Array(32);
                          crypto.getRandomValues(bytes);
                          input.value = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
                        }}
                      >
                        Vygenerovat
                      </button>
                    </div>
                    {settings.telegramWebhookSecret ? (
                      <p className="text-[11px] text-emerald-700 mt-1.5">Secret je uložen. Prázdné pole při uložení = beze změny.</p>
                    ) : (
                      <p className="text-[11px] text-amber-700 mt-1.5">Bez secretu webhook odmítne neověřené požadavky (403).</p>
                    )}
                  </Field>
                  <Field hint="každý pracovní den bot pošle ranní jídelníček odběratelům — prázdné = vypnuto" label="Ranní jídelníček (čas odeslání)">
                    <input className="modal-input w-32" defaultValue={settings.telegramMorningMenuTime} name="telegramMorningMenuTime" placeholder="07:30" type="time" />
                  </Field>
                  <Field hint="URL tvé appky — umožní otevřít ji jako Mini App přímo v Telegramu přes tlačítko 🌐 v klávesnici (volitelné)" label="URL Mini App">
                    <input className="modal-input" defaultValue={settings.telegramAppUrl} name="telegramAppUrl" placeholder="https://objednavky.firma.cz" type="url" />
                  </Field>

                  {/* Bot info card */}
                  {botInfo?.ok && botInfo.username && (
                    <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-2xl" style={{ background: "rgba(22,163,74,0.06)", border: "1px solid rgba(22,163,74,0.15)" }}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[13px] shrink-0" style={{ background: "linear-gradient(135deg,#F59E0B,#EA580C)" }}>
                          <MIcon name="smart_toy" size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-stone-800 truncate">{botInfo.firstName}</p>
                          <p className="text-[11px] text-stone-500 font-mono truncate">@{botInfo.username}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(`https://t.me/${botInfo.username}`);
                          setLinkCopied(true);
                          setTimeout(() => setLinkCopied(false), 2000);
                        }}
                        className="shrink-0 inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-2.5 py-1.5 rounded-full glass-btn text-stone-500 whitespace-nowrap"
                        title={`https://t.me/${botInfo.username}`}
                      >
                        <MIcon name={linkCopied ? "check" : "link"} size={13} />
                        {linkCopied ? "Zkopírováno!" : "Kopírovat odkaz"}
                      </button>
                    </div>
                  )}
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

                <Section icon="history" title="Historie změn" action={
                  initialAuditLog.length > 0 ? (
                    <select
                      className="text-[11.5px] px-2 py-1 rounded-lg glass-btn text-stone-600 font-medium bg-transparent cursor-pointer"
                      value={auditFilter}
                      onChange={(e) => setAuditFilter(e.target.value)}
                    >
                      <option value="all">Vše ({initialAuditLog.length})</option>
                      {Object.entries(ACTION_LABELS).filter(([key]) => initialAuditLog.some((e) => e.action === key)).map(([key, label]) => (
                        <option key={key} value={key}>{label} ({initialAuditLog.filter((e) => e.action === key).length})</option>
                      ))}
                    </select>
                  ) : undefined
                }>
                  {initialAuditLog.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-state__icon">
                        <MIcon name="manage_history" size={22} style={{ color: "#94a3b8" }} />
                      </div>
                      <p className="empty-state__title">Zatím žádné záznamy</p>
                    </div>
                  ) : (() => {
                    const filtered = auditFilter === "all" ? initialAuditLog : initialAuditLog.filter((e) => e.action === auditFilter);
                    return filtered.length === 0 ? (
                      <p className="text-[12.5px] text-stone-400 py-2">Žádné záznamy tohoto typu.</p>
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
                            {filtered.map((entry) => (
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
                    );
                  })()}
                </Section>
              </>
            )}

            {/* ── Telegram tab — non-form sections ── */}
            {activeTab === "uzivatele" && (
              <Section icon="groups" title={`Uživatelé aplikace${appUsers.length > 0 ? ` (${appUsers.length})` : ""}`}>
                <p className="text-[12.5px] text-stone-500 leading-relaxed">
                  Účty přihlašující se přes Credentials nebo Google. Role <b>admin</b> má přístup do Nastavení; ostatní mohou objednávat.
                </p>
                {appUserError && (
                  <p className="text-[12px] text-red-600">{appUserError}</p>
                )}
                {appUsers.length === 0 ? (
                  <p className="text-[12.5px] text-stone-400">Zatím žádní uživatelé.</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {appUsers.map((u) => {
                      const label = u.name || u.email || `#${u.id}`;
                      const isSelf = currentUserId === u.id;
                      const isResetting = resetUserId === u.id;
                      return (
                        <div key={u.id} className="flex flex-col rounded-xl hover:bg-black/3 group">
                          <div className="flex items-center gap-2 py-2 px-2">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-bold shrink-0"
                              style={{
                                background: u.role === "admin"
                                  ? "linear-gradient(135deg,#F59E0B,#EA580C)"
                                  : "#a8a29e",
                              }}
                            >
                              {label[0]?.toUpperCase() ?? "?"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-[13px] font-semibold text-stone-800 truncate block">{label}</span>
                              <span className="text-[11px] text-stone-400 truncate block">
                                {u.email ?? "bez e-mailu"} · {u.role === "admin" ? "Admin" : "Uživatel"}
                                {isSelf ? " · ty" : ""}
                                {u.emailVerified ? "" : " · ⚠ e-mail neověřen"}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                              {!u.emailVerified && !isSelf && (
                                <button
                                  type="button"
                                  title="Ověřit e-mail"
                                  onClick={async () => {
                                    setAppUserError(null);
                                    try {
                                      await actionAdminForceVerifyEmail(u.id);
                                      setAppUsers((prev) => prev.map((row) => row.id === u.id ? { ...row, emailVerified: true } : row));
                                    } catch (err) {
                                      setAppUserError(err instanceof Error ? err.message : "Chyba.");
                                    }
                                  }}
                                  className="text-[11px] px-2 py-1 rounded-lg glass-btn text-green-700 font-medium"
                                >
                                  Ověřit e-mail
                                </button>
                              )}
                              {u.hasPassword && !isSelf && (
                                <button
                                  type="button"
                                  title="Reset hesla"
                                  onClick={() => { setResetUserId(isResetting ? null : u.id); setResetPwd(""); setAppUserError(null); }}
                                  className="text-[11px] px-2 py-1 rounded-lg glass-btn text-amber-700 font-medium"
                                >
                                  Reset hesla
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={isSelf}
                                title={isSelf ? "Nemůžeš si odebrat admin roli sám sobě" : undefined}
                                onClick={async () => {
                                  setAppUserError(null);
                                  const nextRole: UserRole = u.role === "admin" ? "user" : "admin";
                                  try {
                                    await actionSetAppUserRole(u.id, nextRole);
                                    setAppUsers((prev) =>
                                      prev.map((row) => (row.id === u.id ? { ...row, role: nextRole } : row)),
                                    );
                                  } catch (err) {
                                    setAppUserError(err instanceof Error ? err.message : "Změna role selhala.");
                                  }
                                }}
                                className="text-[11px] px-2 py-1 rounded-lg glass-btn text-stone-500 font-medium disabled:opacity-40"
                              >
                                {u.role === "admin" ? "→ User" : "→ Admin"}
                              </button>
                              {!isSelf && (
                                <button
                                  type="button"
                                  title="Smazat účet"
                                  onClick={() => { setDeleteUserId(deleteUserId === u.id ? null : u.id); setAppUserError(null); }}
                                  className="text-[11px] px-2 py-1 rounded-lg glass-btn text-red-500 font-medium"
                                >
                                  <MIcon name="delete" size={13} />
                                </button>
                              )}
                            </div>
                          </div>
                          {deleteUserId === u.id && (
                            <div className="px-3 pb-3 flex items-center gap-2 flex-wrap">
                              <span className="text-[12px] text-stone-600 flex-1">
                                Opravdu smazat účet <strong>{label}</strong>? Akce je nevratná.
                              </span>
                              <button
                                type="button"
                                disabled={deleteUserLoading}
                                onClick={async () => {
                                  setDeleteUserLoading(true); setAppUserError(null);
                                  try {
                                    await actionAdminDeleteUser(u.id);
                                    setAppUsers((prev) => prev.filter((row) => row.id !== u.id));
                                    setDeleteUserId(null);
                                  } catch (err) {
                                    setAppUserError(err instanceof Error ? err.message : "Chyba.");
                                  } finally { setDeleteUserLoading(false); }
                                }}
                                className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white disabled:opacity-50 shrink-0"
                                style={{ background: "linear-gradient(135deg,#ef4444,#dc2626)" }}
                              >
                                {deleteUserLoading ? "…" : "Smazat"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteUserId(null)}
                                className="text-[12px] text-stone-400 hover:text-stone-600 px-1"
                              >
                                Zrušit
                              </button>
                            </div>
                          )}
                          {isResetting && (
                            <div className="px-3 pb-3 flex items-center gap-2">
                              <input
                                type="text"
                                value={resetPwd}
                                onChange={(e) => setResetPwd(e.target.value)}
                                placeholder="Nové heslo (min. 6 znaků)"
                                className="flex-1 rounded-lg px-3 py-1.5 text-[12px] bg-white/60 border border-white/70 text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                              />
                              <button
                                type="button"
                                disabled={resetLoading || resetPwd.length < 6}
                                onClick={async () => {
                                  setResetLoading(true); setAppUserError(null);
                                  try {
                                    await actionAdminResetPassword(u.id, resetPwd);
                                    setResetUserId(null); setResetPwd("");
                                  } catch (err) {
                                    setAppUserError(err instanceof Error ? err.message : "Chyba.");
                                  } finally { setResetLoading(false); }
                                }}
                                className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white disabled:opacity-50 shrink-0"
                                style={{ background: "linear-gradient(135deg,#F59E0B,#EA580C)" }}
                              >
                                {resetLoading ? "…" : "Nastavit"}
                              </button>
                              <button
                                type="button"
                                onClick={() => { setResetUserId(null); setResetPwd(""); }}
                                className="text-[12px] text-stone-400 hover:text-stone-600 px-1"
                              >
                                Zrušit
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Section>
            )}

            {activeTab === "telegram" && (
              <>
                <div className="flex flex-col gap-4">

                  {/* Subscriber list */}
                  <Section icon="group" title={`Registrovaní uživatelé (Telegram)${telegramSubs.length > 0 ? ` (${telegramSubs.length})` : ""}`}>
                    {!telegramSubsLoaded ? (
                      <p className="text-[12.5px] text-stone-400">Načítám…</p>
                    ) : telegramSubs.length === 0 ? (
                      <div className="text-[12.5px] text-stone-400 leading-relaxed">
                        Zatím nikdo. Každý si otevře chat s botem a pošle <code className="bg-black/5 px-1 rounded">/start</code>.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {telegramSubs.map((sub) => (
                          <div key={sub.chatId} className="flex items-center gap-2 py-1.5 px-2 rounded-xl hover:bg-black/3 group">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0" style={{ background: sub.isAdmin ? "linear-gradient(135deg,#F59E0B,#EA580C)" : "#a8a29e" }}>
                              {(sub.firstName || sub.username || "?")[0].toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-[13px] font-semibold text-stone-800 truncate block">
                                {sub.firstName || sub.username || `Chat ${sub.chatId}`}
                                {sub.username && sub.firstName && <span className="text-stone-400 font-normal text-[11px] ml-1">@{sub.username}</span>}
                              </span>
                              <span className="text-[11px] text-stone-400">
                                {sub.isAdmin ? "Admin" : "Uživatel"} · registrován {new Date(sub.registeredAt).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" })}
                              </span>
                              <span className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <span className={`text-[10.5px] px-1.5 py-0.5 rounded-full font-medium ${sub.notifyReminder ? "bg-amber-100 text-amber-700" : "bg-stone-100 text-stone-400"}`} title="Připomenutí uzávěrky">🔔</span>
                                <span className={`text-[10.5px] px-1.5 py-0.5 rounded-full font-medium ${sub.notifyMorningMenu ? "bg-sky-100 text-sky-700" : "bg-stone-100 text-stone-400"}`} title="Ranní jídelníček">🌅</span>
                                <span className={`text-[10.5px] px-1.5 py-0.5 rounded-full font-medium ${sub.notifyMenuImported ? "bg-green-100 text-green-700" : "bg-stone-100 text-stone-400"}`} title="Nový jídelníček">📋</span>
                                {sub.personalReminderTime && <span className="text-[10.5px] px-1.5 py-0.5 rounded-full font-medium bg-amber-50 text-amber-600">⏰ {sub.personalReminderTime}</span>}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={async () => {
                                  await actionSetTelegramAdmin(sub.chatId, !sub.isAdmin);
                                  setTelegramSubs((prev) => prev.map((s) => s.chatId === sub.chatId ? { ...s, isAdmin: !s.isAdmin } : s));
                                }}
                                className="text-[11px] px-2 py-1 rounded-lg glass-btn text-stone-500 font-medium"
                                title={sub.isAdmin ? "Odebrat admin" : "Nastavit jako admin"}
                              >
                                {sub.isAdmin ? "→ User" : "→ Admin"}
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  await actionRemoveTelegramSubscription(sub.chatId);
                                  setTelegramSubs((prev) => prev.filter((s) => s.chatId !== sub.chatId));
                                }}
                                className="w-7 h-7 rounded-lg glass-btn flex items-center justify-center text-red-400"
                                title="Odebrat"
                              >
                                <MIcon name="close" size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Section>

                  <Section icon="notifications" title="Co bot hlásí">
                    <div className="space-y-2 text-[12.5px]">
                      <div className="flex items-start gap-2"><MIcon name="check_circle" size={14} fill style={{ color: "#16a34a", marginTop: 2 }} /><span className="text-stone-600"><b>Objednávka odeslána</b> — upozornění adminu (auto-send i ruční)</span></div>
                      <div className="flex items-start gap-2"><MIcon name="error" size={14} fill style={{ color: "#dc2626", marginTop: 2 }} /><span className="text-stone-600"><b>Selhání auto-send</b> — upozornění adminům</span></div>
                      <div className="flex items-start gap-2"><MIcon name="wb_sunny" size={14} fill style={{ color: "#D97706", marginTop: 2 }} /><span className="text-stone-600"><b>Ranní jídelníček</b> — uživatelé se zapnutým 🌅</span></div>
                      <div className="flex items-start gap-2"><MIcon name="alarm" size={14} fill style={{ color: "#7c3aed", marginTop: 2 }} /><span className="text-stone-600"><b>Připomenutí uzávěrky</b> — uživatelé se zapnutým 🔔 (nebo osobní čas ⏰)</span></div>
                      <div className="flex items-start gap-2"><MIcon name="menu_book" size={14} fill style={{ color: "#0284c7", marginTop: 2 }} /><span className="text-stone-600"><b>Nový jídelníček</b> — uživatelé se zapnutým 📋</span></div>
                    </div>
                  </Section>

                  <Section icon="terminal" title="Dostupné příkazy">
                    <div className="grid gap-x-4 gap-y-1 text-[12px]" style={{ gridTemplateColumns: "auto 1fr" }}>
                      {([
                        ["/stav", "podrobný přehled objednávky (plné názvy)", false],
                        ["/souhrn", "kompaktní tabulka (jméno + kód jídla)", false],
                        ["/menu", "dnešní jídelníček (nebo /menu Po Út St)", false],
                        ["/tyden", "jídelníček na celý týden s výběrem dne", false],
                        ["/zitra", "jídelníček na zítřek", false],
                        ["/pizza", "aktuální nabídka pizzerie", false],
                        ["/statistiky", "statistiky posledních 7 dní", false],
                        ["/nastaveni", "nastavení notifikací (inline tlačítka)", false],
                        ["/nastavit reminder HH:MM", "nastavit osobní připomenutí", false],
                        ["/zrusit reminder", "zrušit osobní připomenutí", false],
                        ["/pozvat", "QR kód pro přidání kolegy", false],
                        ["/pomoc", "seznam příkazů", false],
                        ["/pdf", "stáhnout PDF objednávky nebo jídelníčku", true],
                        ["/odeslat", "ruční odeslání objednávky", true],
                        ["/zrusit", "znovu otevřít odeslanou objednávku", true],
                        ["/nastavit cas HH:MM", "změnit čas auto-odesílání", true],
                        ["/admin", "admin panel (odeslat, kdo chybí…)", true],
                        ["/zprava [text]", "rozeslat zprávu všem uživatelům", true],
                      ] as [string, string, boolean][]).map(([cmd, desc, adminOnly]) => (
                        <div key={cmd} className="contents">
                          <span className="font-mono font-semibold text-amber-700 py-0.5">{cmd}</span>
                          <span className="text-stone-500 py-0.5">{desc}{adminOnly && <span className="ml-1 text-[10.5px] text-stone-400">(jen admin)</span>}</span>
                        </div>
                      ))}
                    </div>
                  </Section>
                </div>

                <Section icon="integration_instructions" title="Nastavení webhooku">
                  <p className="text-[12.5px] text-stone-500">
                    Aby bot přijímal příkazy, musí Telegram vědět na jakou URL odesílat zprávy. Po změně tokenu nebo secretu ulož nastavení a znovu klikni „Nastavit webhook“.
                  </p>
                  {!settings.telegramWebhookSecret && (
                    <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                      Webhook secret zatím chybí — při „Nastavit webhook“ se vygeneruje automaticky (nebo ho zadej výše a ulož).
                    </p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      className="modal-btn modal-btn--secondary"
                      disabled={webhookStatus === "pending"}
                      onClick={async () => {
                        setWebhookStatus("pending");
                        setWebhookMsg("");
                        const res = await actionSetTelegramWebhook();
                        setWebhookStatus(res.ok ? "ok" : "error");
                        setWebhookMsg(
                          res.secretGenerated
                            ? `${res.description ?? ""} Secret byl vygenerován — ulož nastavení pro přehled.`.trim()
                            : (res.description ?? ""),
                        );
                        if (res.ok) {
                          const wh = await actionGetTelegramWebhookStatus();
                          setWebhookInfo(wh);
                          if (res.secretGenerated) router.refresh();
                        }
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
                    <button
                      className="modal-btn modal-btn--secondary"
                      disabled={commandsStatus === "pending"}
                      onClick={async () => {
                        setCommandsStatus("pending");
                        const res = await actionSetTelegramCommands();
                        setCommandsStatus(res.ok ? "ok" : "error");
                      }}
                      title="Zaregistruje příkazy bota u Telegramu — zobrazí se v autocomplete při psaní /"
                      type="button"
                    >
                      {commandsStatus === "pending" ? "Registruji…" : "Registrovat příkazy"}
                    </button>
                    {webhookStatus !== "idle" && (
                      <span className={`text-[12px] font-medium ${webhookStatus === "ok" ? "text-green-600" : "text-red-500"}`}>
                        {webhookStatus === "ok" ? "✓ Webhook nastaven" : `✗ ${webhookMsg}`}
                      </span>
                    )}
                    {commandsStatus !== "idle" && (
                      <span className={`text-[12px] font-medium ${commandsStatus === "ok" ? "text-green-600" : "text-red-500"}`}>
                        {commandsStatus === "ok" ? "✓ Příkazy registrovány" : "✗ Chyba registrace"}
                      </span>
                    )}
                    {telegramTestStatus !== "idle" && (
                      <span className={`text-[12px] font-medium ${telegramTestStatus === "ok" ? "text-green-600" : "text-red-500"}`}>
                        {telegramTestStatus === "ok" ? "✓ Zpráva odeslána" : `✗ ${telegramTestMsg || "Chyba"}`}
                      </span>
                    )}
                  </div>
                  {webhookInfo?.url && (
                    <div className="flex items-center gap-2 mt-1 text-[11.5px] text-stone-400">
                      <MIcon name="link" size={13} />
                      <span className="font-mono truncate">{webhookInfo.url}</span>
                    </div>
                  )}
                </Section>

                {/* Telegram help modal */}
                {showTelegramHelp && (
                  <div className="modal-overlay" onClick={() => setShowTelegramHelp(false)}>
                    <div className="modal-sheet" role="dialog" aria-modal="true" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()} ref={telegramHelpSheetRef}>
                      <div className="modal-sheet__drag-handle" aria-hidden />
                      <div className="modal-sheet__header">
                        <h3 className="modal-sheet__title">Jak nastavit Telegram bota</h3>
                        <button aria-label="Zavřít" className="w-11 h-11 rounded-full glass-btn inline-flex items-center justify-center text-stone-500 text-lg font-bold" onClick={() => setShowTelegramHelp(false)} type="button">×</button>
                      </div>
                      <div className="modal-sheet__body space-y-4">

                        {/* Intro */}
                        <div className="px-3 py-2.5 rounded-2xl text-[12.5px] text-stone-600 leading-relaxed" style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.15)" }}>
                          <strong>Jak to funguje:</strong> Každý kolega si otevře soukromý chat s botem a pošle <code className="bg-black/5 px-1 rounded">/start</code>. Automaticky se zaregistruje a bude dostávat notifikace do svého soukromého chatu. Nikdo nevidí zprávy ostatních.
                        </div>

                        {/* Steps */}
                        {[
                          {
                            num: "1",
                            title: "Vytvoř bota přes @BotFather (2 minuty)",
                            body: (
                              <div className="space-y-2">
                                <p>V Telegramu vyhledej <strong>@BotFather</strong> — vyber toho s modrým ověřovacím odznakem. Klikni <strong>Start</strong>.</p>
                                <div className="space-y-1 text-[12px]">
                                  {[
                                    ["Ty napíšeš:", "/newbot"],
                                    ["BotFather se zeptá:", "How are we going to call it? (zobrazovaný název, např. Obědy LIMA)"],
                                    ["Ty napíšeš:", "Obědy LIMA"],
                                    ["BotFather se zeptá:", "Choose a username — musí končit na bot (např. ObedyLIMAbot)"],
                                    ["Ty napíšeš:", "ObedyLIMAbot"],
                                    ["BotFather odpoví:", "Done! Token: 1234567890:AAFxxxxxxx... — zkopíruj ho!"],
                                  ].map(([who, what], i) => (
                                    <div key={i} className="flex gap-2">
                                      <span className="shrink-0 text-stone-400 w-28">{who}</span>
                                      <span className="font-mono text-[11px] text-stone-700 bg-black/5 px-1.5 py-0.5 rounded leading-relaxed">{what}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ),
                          },
                          {
                            num: "2",
                            title: "Vlož token do nastavení a ulož",
                            body: <>Zkopíruj <strong>Bot Token</strong> z BotFather, vlož ho do pole výše, zaškrtni přepínač a klikni <strong>Uložit nastavení</strong>.</>,
                          },
                          {
                            num: "3",
                            title: "Nastav webhook",
                            body: <>Klikni na <strong>Nastavit webhook</strong> — tím Telegramu řekneš, kam má posílat příkazy. Stačí jednou (opakuj jen při změně domény nebo tokenu).</>,
                          },
                          {
                            num: "4",
                            title: "Kolegové — stačí kliknout na odkaz",
                            body: (
                              <div className="space-y-1.5">
                                <p>Pošli kolegům odkaz <code className="bg-black/5 px-1 rounded">t.me/ObedyLIMAbot</code> (uprav na své uživatelské jméno). Kliknou, zmáčknou <strong>Start</strong> — a jsou zaregistrovaní. Žádné nastavování, žádný BotFather.</p>
                                <p className="text-stone-400">První kdo klikne Start dostane automaticky roli <strong>admin</strong> (může odesílat objednávky příkazem).</p>
                              </div>
                            ),
                          },
                          {
                            num: "5",
                            title: "Otestuj",
                            body: <>Klikni na <strong>Testovat zprávu</strong> — bot pošle testovací zprávu všem registrovaným. Zkus taky napsat <code className="bg-black/5 px-1 rounded">/pomoc</code> přímo botovi.</>,
                          },
                        ].map((step) => (
                          <div key={step.num} className="flex gap-3">
                            <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-white text-[12px] font-display font-bold mt-0.5" style={{ background: "linear-gradient(135deg,#F59E0B,#EA580C)" }}>
                              {step.num}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-display font-bold text-[13px] text-stone-900">{step.title}</p>
                              <div className="text-[12.5px] text-stone-600 leading-relaxed mt-0.5">{step.body}</div>
                            </div>
                          </div>
                        ))}

                        {/* Commands reference */}
                        <div className="glass-soft rounded-2xl p-3.5 flex flex-col gap-2">
                          <p className="font-display font-bold text-[12.5px] text-stone-800">Příkazy (piš botovi přímo v soukromém chatu)</p>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
                            {[
                              ["/stav", "přehled dnešní objednávky"],
                              ["/souhrn", "kompaktní tabulka s kódy"],
                              ["/menu", "dnešní jídelníček"],
                              ["/tyden", "jídelníček na celý týden"],
                              ["/zitra", "jídelníček na zítřek"],
                              ["/pizza", "nabídka pizzerie"],
                              ["/statistiky", "statistiky (7 dní)"],
                              ["/nastaveni", "nastavení notifikací"],
                              ["/nastavit reminder HH:MM", "osobní připomenutí"],
                              ["/pozvat", "QR kód pro kolegy"],
                              ["/pdf", "PDF objednávky/jídelníčku (admin)"],
                              ["/odeslat", "odeslání objednávky (admin)"],
                              ["/zrusit", "znovu otevřít objednávku (admin)"],
                              ["/nastavit cas HH:MM", "změnit čas auto-odesílání (admin)"],
                              ["/pomoc", "seznam příkazů"],
                            ].map(([cmd, desc]) => (
                              <div key={cmd} className="contents">
                                <span className="font-mono text-amber-700 font-semibold">{cmd}</span>
                                <span className="text-stone-500">{desc}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <p className="text-[11.5px] text-stone-400">Správu registrovaných uživatelů (odebrání, změna role) najdeš v nastavení v sekci „Registrovaní uživatelé".</p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

        {/* Google help modal */}
        {showGoogleHelp && (
          <div className="modal-overlay" onClick={() => setShowGoogleHelp(false)}>
            <div className="modal-sheet" role="dialog" aria-modal="true" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()} ref={googleHelpSheetRef}>
              <div className="modal-sheet__drag-handle" aria-hidden />
              <div className="modal-sheet__header">
                <h3 className="modal-sheet__title">Jak nastavit Google přihlášení</h3>
                <button aria-label="Zavřít" className="w-11 h-11 rounded-full glass-btn inline-flex items-center justify-center text-stone-500 text-lg font-bold" onClick={() => setShowGoogleHelp(false)} type="button">×</button>
              </div>
              <div className="modal-sheet__body space-y-4">

                <div className="px-3 py-2.5 rounded-2xl text-[12.5px] text-stone-600 leading-relaxed" style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.15)" }}>
                  <strong>Co to dá:</strong> Uživatelé se budou moci přihlásit jedním kliknutím přes Google účet — bez vytváření hesla. Pokud mají stejný e-mail jako existující účet, automaticky se propojí.
                </div>

                {[
                  {
                    num: "1",
                    title: "Otevři Google Cloud Console",
                    body: (
                      <div className="space-y-1.5">
                        <p>Jdi na <span className="font-mono text-[11px] bg-black/5 px-1.5 py-0.5 rounded">console.cloud.google.com</span> a přihlas se firemním Google účtem.</p>
                        <p>Vytvoř nový projekt (nebo vyber existující) — název může být cokoliv, např. <em>Obědy LIMA</em>.</p>
                      </div>
                    ),
                  },
                  {
                    num: "2",
                    title: "Nastavení OAuth consent screen",
                    body: (
                      <div className="space-y-1.5">
                        <p>V levém menu: <strong>APIs & Services → OAuth consent screen</strong>.</p>
                        <div className="space-y-1 text-[12px]">
                          {[
                            ["User Type:", "External (nebo Internal pokud máš Google Workspace)"],
                            ["App name:", "Obědy LIMA (nebo název tvé appky)"],
                            ["User support email:", "tvůj firemní e-mail"],
                            ["Scopes:", "nechte výchozí — stačí email, profile, openid"],
                            ["Test users:", "přidej svůj e-mail pro testování"],
                          ].map(([k, v]) => (
                            <div key={k} className="flex gap-2">
                              <span className="shrink-0 text-stone-400 w-32">{k}</span>
                              <span className="text-stone-700">{v}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ),
                  },
                  {
                    num: "3",
                    title: "Vytvořit OAuth klienta",
                    body: (
                      <div className="space-y-1.5">
                        <p><strong>APIs & Services → Credentials → Create Credentials → OAuth client ID</strong>.</p>
                        <div className="space-y-1 text-[12px]">
                          {[
                            ["Application type:", "Web application"],
                            ["Name:", "libovolný název, např. Obědy LIMA"],
                          ].map(([k, v]) => (
                            <div key={k} className="flex gap-2">
                              <span className="shrink-0 text-stone-400 w-32">{k}</span>
                              <span className="text-stone-700">{v}</span>
                            </div>
                          ))}
                        </div>
                        <p>Do pole <strong>Authorized redirect URIs</strong> vlož Callback URL z nastavení (pole Callback URL výše). Klikni <strong>Create</strong>.</p>
                      </div>
                    ),
                  },
                  {
                    num: "4",
                    title: "Zkopíruj Client ID a Client Secret",
                    body: <>Google Console zobrazí dialog s <strong>Client ID</strong> a <strong>Client Secret</strong>. Zkopíruj obě hodnoty a vlož je do polí v Nastavení → Přihlášení.</>,
                  },
                  {
                    num: "5",
                    title: "Uložit a restartovat kontejner",
                    body: (
                      <div className="space-y-1.5">
                        <p>Klikni <strong>Uložit nastavení</strong>. Poté restartuj Docker kontejner — Auth.js načte nové credentials při startu procesu.</p>
                        <div className="font-mono text-[11px] bg-black/5 px-3 py-2 rounded-lg text-stone-700">docker compose restart</div>
                        <p>Po restartu se na přihlašovací stránce objeví tlačítko <em>Přihlásit se přes Google</em>.</p>
                      </div>
                    ),
                  },
                ].map((step) => (
                  <div key={step.num} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-white text-[12px] font-display font-bold mt-0.5" style={{ background: "linear-gradient(135deg,#F59E0B,#EA580C)" }}>
                      {step.num}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-bold text-[13px] text-stone-900">{step.title}</p>
                      <div className="text-[12.5px] text-stone-600 leading-relaxed mt-0.5">{step.body}</div>
                    </div>
                  </div>
                ))}

                <div className="glass-soft rounded-2xl p-3.5 text-[12px] text-stone-500 space-y-1">
                  <p className="font-semibold text-stone-700">Přihlašování pro nové zaměstnance:</p>
                  <p>Po restartu jde každý přihlásit přes Google — pokud mají firemní e-mail (nebo jsou v Test users), vše funguje bez schvalování. Uveřejnění OAuth aplikace (pro všechny Google účty) není potřeba, pokud používáš pouze firemní domény.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Version info */}
        <div className="flex items-center justify-center gap-2 pt-2 pb-1 text-[11px] text-stone-500">
          <span>Objednávky LIMA</span>
          <span className="text-stone-300">·</span>
          <span>{getBuildInfo().displayString}</span>
          <button
            type="button"
            className="ml-1 rounded-md px-2 py-1 text-[10.5px] font-semibold bg-black/5 hover:bg-black/10 text-stone-600"
            onClick={() => {
              try { navigator.clipboard.writeText(getBuildInfo().displayString); } catch {}
            }}
            title="Zkopírovat verzi"
          >
            Kopírovat
          </button>
        </div>

            </div>{/* /space-y-4 */}
            </div>{/* /lg:grid */}
          </>
        )}
        </div>
      </div>

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
