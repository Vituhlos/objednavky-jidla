"use client";

import { useEffect, useState } from "react";
import {
  actionGetTelegramBotInfo,
  actionGetTelegramWebhookStatus,
  actionSendTelegramTest,
  actionSetTelegramCommands,
  actionSetTelegramWebhook,
} from "@/app/actions";
import type { AppSettings } from "@/lib/settings";
import MIcon from "../MIcon";
import { SettingsField, SettingsSection } from "./SettingsPrimitives";

export interface TelegramStatus {
  botInfo: { ok: boolean; firstName?: string; username?: string; error?: string } | null;
  webhookInfo: { ok: boolean; hasWebhook: boolean; url?: string } | null;
  setWebhookInfo: (info: { ok: boolean; hasWebhook: boolean; url?: string }) => void;
  showTelegramHelp: boolean;
  setShowTelegramHelp: (show: boolean) => void;
  linkCopied: boolean;
  setLinkCopied: (copied: boolean) => void;
}

/**
 * Stav bota sdílený mezi kartou v formuláři a informačními sekcemi pod ním.
 *
 * Karta s tokenem musí zůstat uvnitř `<form>` (ukládá se přes `FormData`
 * a sleduje ji hlídač neuložených změn), kdežto webhook a nápověda stojí
 * mimo něj. Jsou to tedy dvě komponenty, ale jeden stav — proto hook.
 *
 * Ve větvi feat/heroui-migration je `TelegramSection` jediná komponenta;
 * tamní formulář je poskládaný jinak a tohle rozdvojení nepotřebuje.
 */
export function useTelegramStatus(settings: AppSettings, isActive: boolean): TelegramStatus {
  const [botInfo, setBotInfo] = useState<TelegramStatus["botInfo"]>(null);
  const [webhookInfo, setWebhookInfo] = useState<TelegramStatus["webhookInfo"]>(null);
  const [showTelegramHelp, setShowTelegramHelp] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    if (!isActive || botInfo !== null || !settings.telegramBotToken) return;
    Promise.all([
      actionGetTelegramBotInfo(),
      actionGetTelegramWebhookStatus(),
    ]).then(([info, webhook]) => {
      setBotInfo(info);
      setWebhookInfo(webhook);
    });
  }, [isActive, botInfo, settings.telegramBotToken]);

  return {
    botInfo, webhookInfo, setWebhookInfo,
    showTelegramHelp, setShowTelegramHelp,
    linkCopied, setLinkCopied,
  };
}

/** Karta s tokenem a časy — patří dovnitř formuláře nastavení. */
export function TelegramBotCard({
  settings,
  status,
}: {
  settings: AppSettings;
  status: TelegramStatus;
}) {
  const { botInfo, webhookInfo, setShowTelegramHelp, linkCopied, setLinkCopied } = status;

  return (
      <SettingsSection icon="send" title="Telegram bot" action={
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
        <SettingsField hint="Token z @BotFather, např. 123456:ABC-DEF..." label="Bot Token">
          <input className="modal-input font-mono text-[12px]" defaultValue={settings.telegramBotToken} name="telegramBotToken" placeholder="123456789:ABCdefGHI..." type="text" />
        </SettingsField>
        <SettingsField hint="každý pracovní den bot pošle ranní jídelníček odběratelům — prázdné = vypnuto" label="Ranní jídelníček (čas odeslání)">
          <input className="modal-input w-32" defaultValue={settings.telegramMorningMenuTime} name="telegramMorningMenuTime" placeholder="07:30" type="time" />
        </SettingsField>
        <SettingsField hint="URL tvé appky — umožní otevřít ji jako Mini App přímo v Telegramu přes tlačítko 🌐 v klávesnici (volitelné)" label="URL Mini App">
          <input className="modal-input" defaultValue={settings.telegramAppUrl} name="telegramAppUrl" placeholder="https://objednavky.firma.cz" type="url" />
        </SettingsField>

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
      </SettingsSection>
  );
}

/** Přehled hlášení, příkazy, webhook a nápověda — stojí mimo formulář. */
export function TelegramSection({
  isActive,
  status,
}: {
  isActive: boolean;
  status: TelegramStatus;
}) {
  const { webhookInfo, setWebhookInfo, showTelegramHelp, setShowTelegramHelp } = status;
  const [telegramTestStatus, setTelegramTestStatus] = useState<"idle" | "pending" | "ok" | "error">("idle");
  const [telegramTestMsg, setTelegramTestMsg] = useState("");
  const [webhookStatus, setWebhookStatus] = useState<"idle" | "pending" | "ok" | "error">("idle");
  const [webhookMsg, setWebhookMsg] = useState("");
  const [commandsStatus, setCommandsStatus] = useState<"idle" | "pending" | "ok" | "error">("idle");

  if (!isActive) return null;

  return (
    <>
        <div className="flex flex-col gap-4">
          <SettingsSection icon="notifications" title="Co bot hlásí">
            <div className="space-y-2 text-[12.5px]">
              <div className="flex items-start gap-2"><MIcon name="check_circle" size={14} fill style={{ color: "#16a34a", marginTop: 2 }} /><span className="text-stone-600"><b>Objednávka odeslána</b> — upozornění adminu (auto-send i ruční)</span></div>
              <div className="flex items-start gap-2"><MIcon name="error" size={14} fill style={{ color: "#dc2626", marginTop: 2 }} /><span className="text-stone-600"><b>Selhání auto-send</b> — upozornění adminům</span></div>
              <div className="flex items-start gap-2"><MIcon name="wb_sunny" size={14} fill style={{ color: "#D97706", marginTop: 2 }} /><span className="text-stone-600"><b>Ranní jídelníček</b> — uživatelé se zapnutým 🌅</span></div>
              <div className="flex items-start gap-2"><MIcon name="alarm" size={14} fill style={{ color: "#7c3aed", marginTop: 2 }} /><span className="text-stone-600"><b>Připomenutí uzávěrky</b> — uživatelé se zapnutým 🔔 (nebo osobní čas ⏰)</span></div>
              <div className="flex items-start gap-2"><MIcon name="menu_book" size={14} fill style={{ color: "#0284c7", marginTop: 2 }} /><span className="text-stone-600"><b>Nový jídelníček</b> — uživatelé se zapnutým 📋</span></div>
            </div>
          </SettingsSection>

          <SettingsSection icon="terminal" title="Dostupné příkazy">
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
          </SettingsSection>
        </div>

        <SettingsSection icon="integration_instructions" title="Nastavení webhooku">
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
                if (res.ok) {
                  const wh = await actionGetTelegramWebhookStatus();
                  setWebhookInfo(wh);
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
        </SettingsSection>

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

                <p className="text-[11.5px] text-stone-400">Správu registrovaných uživatelů (odebrání, změna role) najdeš v nastavení v sekci „Registrovaní uživatelé“.</p>
              </div>
            </div>
          </div>
        )}
    </>
  );
}
