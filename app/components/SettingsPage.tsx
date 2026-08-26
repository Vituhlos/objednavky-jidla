"use client";

import { useState, useTransition, useRef, useEffect, useCallback, memo } from "react";
import type { AppSettings } from "@/lib/settings";
import type { DepartmentInfo } from "@/lib/departments";
import type { AuditEntry } from "@/lib/audit";
import {
  actionSaveSettings,
  actionGetTelegramSubscriptions,
} from "@/app/actions";
import type { TelegramSubscription } from "@/lib/telegram";
import { getAppVersionInfo } from "@/lib/version";
import {
  CHANNEL_LABELS,
  SETTINGS_TABS,
  type SettingsTab,
} from "./settings/constants";
import { AboutSection } from "./settings/AboutSection";
import { AuditLogSection } from "./settings/AuditLogSection";
import { BackupSection } from "./settings/BackupSection";
import { ClosuresSection } from "./settings/ClosuresSection";
import { DepartmentsSection } from "./settings/DepartmentsSection";
import { PeopleSection } from "./settings/PeopleSection";
import { PinGate } from "./settings/PinGate";
import { TelegramBotCard, TelegramSection, useTelegramStatus } from "./settings/TelegramSection";
import { TelegramSubscribersSection } from "./settings/TelegramSubscribersSection";
import { TodayOrderSection } from "./settings/TodayOrderSection";
import { UsersSection } from "./settings/UsersSection";
import { MenuImportSection } from "./settings/MenuImportSection";
import { OperationsSection } from "./settings/OperationsSection";
import { PizzaSection } from "./settings/PizzaSection";
import { PricesSection } from "./settings/PricesSection";
import { PushSection } from "./settings/PushSection";
import { SecuritySection } from "./settings/SecuritySection";
import { SmtpSection } from "./settings/SmtpSection";
import {
  EmailListInput,
  SettingsField,
  SettingsSection,
  SettingsToggle,
  VersionMeta,
} from "./settings/SettingsPrimitives";
import {
  getSettingsUpdates,
} from "./settings/settings-utils";
import MIcon from "./MIcon";

const VERSION_INFO = getAppVersionInfo();

// ── Main component ────────────────────────────────────────────────────────────

export default function SettingsPage({
  settings, departments: initialDepts, auditLog: initialAuditLog, todayOrder, pinOnly = false,
}: {
  settings: AppSettings;
  departments: DepartmentInfo[];
  auditLog: AuditEntry[];
  todayOrder?: { id: number; status: string };
  /** Otevřeno PINem bez správcovského účtu — zadní vrátka mají být vidět. */
  pinOnly?: boolean;
}) {
  const [unlocked, setUnlocked] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>("provoz");
  // Which categories hold edits that the big form hasn't saved yet. Sections that
  // save on the spot (oddělení, zavřeno, dnešní objednávka) sit outside the form and
  // never land here — that's the point: the dot only marks what is genuinely pending.
  const [dirtyTabs, setDirtyTabs] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const sessionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

  const handleUnlock = (candidate: string) => {
    setUnlocked(true);
    confirmedPinRef.current = candidate;
  };

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


  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  // Odběratelé bota zůstávají tady, ne v TelegramSubscribersSection: jejich
  // počet čte i odznak u záložky „Lidé“ v navigaci.
  const [telegramSubs, setTelegramSubs] = useState<TelegramSubscription[]>([]);
  const [telegramSubsLoaded, setTelegramSubsLoaded] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const confirmedPinRef = useRef("");
  // Chráněné API routy chtějí PIN v hlavičce. Předává se jako funkce, ne
  // hodnota — ref se plní až při odemčení a getter tak nemůže zestárnout.
  const getPin = useCallback(() => confirmedPinRef.current, []);

  const telegram = useTelegramStatus(
    settings,
    activeTab === "lide" || activeTab === "napojeni"
  );

  useEffect(() => {
    if (activeTab !== "lide" && activeTab !== "napojeni") return;
    if (telegramSubsLoaded) return;
    actionGetTelegramSubscriptions().then((subs) => {
      setTelegramSubs(subs);
      setTelegramSubsLoaded(true);
    });
  }, [activeTab, telegramSubsLoaded]);



  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const updates = getSettingsUpdates(fd);

    setSaveStatus("idle");
    startTransition(async () => {
      try {
        await actionSaveSettings(updates, confirmedPinRef.current);
        resetSessionTimer();
        // Nothing is pending any more — clears the bar and the sidebar dots
        setDirtyTabs([]);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 3000);
      } catch {
        setSaveStatus("error");
      }
    });
  };


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

      <main className="flex-1 overflow-y-auto scroll-area p-4 md:p-5 space-y-4 pb-nav md:pb-24">
        {unlocked && pinOnly && (
          <div
            className="rounded-2xl p-3 flex items-start gap-2"
            role="status"
            style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.22)" }}
          >
            <MIcon name="key" size={15} style={{ color: "#D97706", flexShrink: 0, marginTop: 1 }} />
            <span className="text-[12px] text-stone-700">
              Jste tu <b>jen na PIN</b>, bez správcovského účtu. Funguje to jako záložní
              cesta, kdyby se přihlašování rozbilo — ale kdokoli s tímhle PINem si
              odsud stáhne zálohu celé databáze. Zapsáno do auditu. Až účty
              vyzkoušíte, dejte vědět a vrátka zavřeme.
            </span>
          </div>
        )}
        {!unlocked ? (
          /* PIN lock */
          <PinGate onUnlock={handleUnlock} />
        ) : (
          <>
            <div className="flex flex-col md:flex-row md:items-start gap-4 md:gap-6">

            {/* Category nav — sidebar on desktop, the original strip on mobile */}
            {/* top-0, not top-4: a sticky element is held at least `top` from the edge of the
                scroll area, so top-4 pushed the sidebar 16px below the first card in every
                category tall enough to scroll (Pizza is short, so it looked fine there). */}
            <nav className="md:w-[212px] md:shrink-0 md:sticky md:top-0" aria-label="Kategorie nastavení">
              <div className="md:hidden overflow-x-auto no-scrollbar -mx-1 px-1">
                <div
                  className="flex p-1 rounded-2xl gap-0.5"
                  style={{ width: "max-content", background: "rgba(26,18,8,0.06)", border: "1px solid rgba(255,255,255,0.55)" }}
                >
                  {SETTINGS_TABS.map((tab) => (
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
                      {tab.label}
                      {dirtyTabs.includes(tab.id) && (
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: activeTab === tab.id ? "rgba(255,255,255,0.9)" : "#EA580C" }} />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="hidden md:flex md:flex-col gap-0.5 p-1.5 rounded-2xl"
                style={{ background: "rgba(26,18,8,0.05)", border: "1px solid rgba(255,255,255,0.55)" }}>
                {SETTINGS_TABS.map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      aria-current={active ? "page" : undefined}
                      className={`w-full text-left flex items-start gap-2.5 px-3 py-2.5 rounded-xl transition-all duration-200 active:scale-[0.98] ${
                        active ? "text-white" : "text-stone-600 hover:bg-white/60"
                      }`}
                      style={active ? {
                        background: "linear-gradient(135deg,#F59E0B,#EA580C)",
                        boxShadow: "0 2px 8px -2px rgba(234,88,12,0.35)",
                      } : {}}
                    >
                      <MIcon name={tab.icon as "settings"} size={16} style={{ marginTop: 1, flexShrink: 0 }} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="text-[13px] font-semibold leading-none">{tab.label}</span>
                          {dirtyTabs.includes(tab.id) && (
                            <span title="Neuložené změny" className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ background: active ? "rgba(255,255,255,0.9)" : "#EA580C" }} />
                          )}
                          {tab.id === "lide" && telegramSubsLoaded && telegramSubs.length > 0 && (
                            <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${active ? "bg-white/25 text-white" : "bg-amber-500/15 text-amber-700"}`}>
                              {telegramSubs.length}
                            </span>
                          )}
                        </span>
                        <span className={`block text-[11px] leading-snug mt-0.5 ${active ? "text-white/75" : "text-stone-400"}`}>
                          {tab.hint}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </nav>

            {/* Content column — capped so a single input stops spanning the whole screen */}
            <div className="flex-1 min-w-0 flex flex-col gap-4" style={{ maxWidth: 760 }}>

            <TodayOrderSection isActive={activeTab === "provoz"} order={todayOrder} />

            <ClosuresSection isActive={activeTab === "provoz"} />

            <DepartmentsSection initialDepartments={initialDepts} isActive={activeTab === "lide"} />

            <PeopleSection isActive={activeTab === "lide"} />

            <UsersSection isActive={activeTab === "lide"} />

            {/* ── Form (all form-field sections, hidden per tab via CSS) ── */}
            <form
              id="settings-form"
              onSubmit={handleSave}
              ref={formRef}
              onChange={(e) => {
                const cat = (e.target as HTMLElement).closest("[data-cat]")?.getAttribute("data-cat");
                if (cat) setDirtyTabs((prev) => (prev.includes(cat) ? prev : [...prev, cat]));
              }}
            >

              {/* Objednávka tab: Provoz + AutoSend */}
              <div className="flex flex-col gap-4" data-cat="provoz" style={{ display: activeTab === "provoz" ? "flex" : "none" }}>

                <OperationsSection settings={settings} />
              </div>

              {/* Pizza — vlastní kategorie, je to samostatný modul */}
              <div className="flex flex-col gap-4" data-cat="pizza" style={{ display: activeTab === "pizza" ? "flex" : "none" }}>
                <PizzaSection settings={settings} />

              </div>

              {/* E-mail & IMAP tab */}
              <div className="flex flex-col gap-4" data-cat="napojeni" style={{ display: activeTab === "napojeni" ? "flex" : "none" }}>

                <SmtpSection getPin={getPin} settings={settings} />

                <MenuImportSection settings={settings} />

                <PushSection settings={settings} />

              </div>

              {/* Ceny tab */}
              <div className="flex flex-col gap-4" data-cat="ceny" style={{ display: activeTab === "ceny" ? "flex" : "none" }}>

                <PricesSection settings={settings} />

              </div>

              {/* Systém tab — form part (PIN only) */}
              <div className="flex flex-col gap-4" data-cat="system" style={{ display: activeTab === "system" ? "flex" : "none" }}>

                <SecuritySection />

              </div>

              {/* Telegram tab — form part (token + toggle) */}
              <div className="flex flex-col gap-4" data-cat="napojeni" style={{ display: activeTab === "napojeni" ? "flex" : "none" }}>
                <TelegramBotCard settings={settings} status={telegram} />
              </div>

            </form>

            {/* ── Systém — non-form sections ── */}
            <AboutSection isActive={activeTab === "system"} />
            <BackupSection getPin={getPin} isActive={activeTab === "system"} />
            <AuditLogSection entries={initialAuditLog} isActive={activeTab === "system"} />

            <TelegramSubscribersSection
              isActive={activeTab === "lide"}
              isLoaded={telegramSubsLoaded}
              onChange={setTelegramSubs}
              subscriptions={telegramSubs}
            />

            <TelegramSection isActive={activeTab === "napojeni"} status={telegram} />

        {/* Version info */}
        <div className="flex items-center justify-center gap-2 pt-2 pb-1 text-[11px] text-stone-400 flex-wrap">
          <span>{VERSION_INFO.name}</span>
          <span className="text-stone-300">·</span>
          <span>v{VERSION_INFO.version}</span>
          <span className="text-stone-300">·</span>
          <span>{CHANNEL_LABELS[VERSION_INFO.releaseChannel] ?? VERSION_INFO.releaseChannel}</span>
          {VERSION_INFO.shortCommitSha && (
            <>
              <span className="text-stone-300">·</span>
              <span className="font-mono">{VERSION_INFO.shortCommitSha}</span>
            </>
          )}
        </div>

            </div>
            </div>
          </>
        )}
      </main>

      {/* ── Lišta neuložených změn — objeví se, až když je co uložit ── */}
      {unlocked && (dirtyTabs.length > 0 || saveStatus === "error") && (
        <div className="settings-save-fab">
          {saveStatus === "error"
            ? <span className="settings-save-fab__status text-red-600">Chyba při ukládání.</span>
            : <span className="settings-save-fab__status text-stone-600">Máte neuložené změny.</span>}
          <button
            className="modal-btn modal-btn--secondary"
            disabled={isPending}
            onClick={() => { formRef.current?.reset(); setDirtyTabs([]); setSaveStatus("idle"); }}
            type="button"
          >Zahodit</button>
          <button className="modal-btn modal-btn--primary" disabled={isPending} form="settings-form" type="submit">
            {isPending ? "Ukládám..." : "Uložit"}
          </button>
        </div>
      )}
      {unlocked && dirtyTabs.length === 0 && saveStatus === "saved" && (
        <div className="settings-save-fab">
          <span className="settings-save-fab__status text-emerald-700">Nastavení uloženo.</span>
        </div>
      )}
    </div>
  );
}
