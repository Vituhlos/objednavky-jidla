"use client";

import { countWord } from "@/lib/format";
import { useEffect, useRef, useState, useTransition } from "react";
import type { AppSettings } from "@/lib/settings";
import { actionCheckImap } from "@/app/actions";
import MIcon from "../MIcon";
import { SettingsDayPicker, SettingsField, SettingsSection, SettingsToggle } from "./SettingsPrimitives";

const IMAP_HELP = (
  <div className="space-y-2.5 text-[12px] text-stone-600 pb-2">
    <p className="font-semibold text-stone-800 text-[12.5px]">Jak nastavit automatický import z Gmailu</p>
    <div className="space-y-1.5">
      <p><span className="font-semibold text-stone-700">1. Zapněte IMAP v Gmailu</span><br />Gmail → Nastavení (ozubené kolo) → Zobrazit všechna nastavení → záložka <em>Přesměrování a POP/IMAP</em> → sekce IMAP → vyberte <strong>Zapnout IMAP</strong> → Uložit.</p>
      <p><span className="font-semibold text-stone-700">2. Vytvořte heslo aplikace (App Password)</span><br />Běžné heslo ke Gmailu tady nefunguje, je potřeba zvláštní heslo aplikace. Otevřete <strong>myaccount.google.com/apppasswords</strong>, přihlaste se a vytvořte nové heslo (název např. „Kantýna“). Google vygeneruje 16 znaků – zkopírujte je <strong>bez mezer</strong> a vložte sem jako heslo.</p>
      <p><span className="font-semibold text-stone-700">3. Filtr odesílatele</span><br />Zadejte e-mailovou adresu, ze které LIMA posílá jídelníčky (najdete ji v hlavičce příchozího e-mailu). Díky tomu se nezpracuje žádný jiný e-mail.</p>
      <p><span className="font-semibold text-stone-700">4. Jak to funguje</span><br />Každý pracovní den v nastavený čas aplikace zkontroluje schránku, najde nepřečtený e-mail s PDF od LIMY, importuje jídelníček a e-mail označí jako přečtený.</p>
    </div>
  </div>
);

/**
 * Automatický import jídelníčku z e-mailu.
 *
 * Ruční kontrola schránky má vlastní časový limit: IMAP se umí zaseknout na
 * TCP spojení a bez limitu by tlačítko zůstalo „připojuji se“ navždy. Když
 * limit vyprší dřív než odpověď, ta pozdější se zahodí — proto se `ref` po
 * vypršení nuluje a výsledek se zapíše, jen když v něm ještě timeout je.
 */
export function MenuImportSection({ settings }: { settings: AppSettings }) {
  const [imapCheckStatus, setImapCheckStatus] = useState<"idle" | "pending" | "found" | "notfound" | "error">("idle");
  const [imapCheckMsg, setImapCheckMsg] = useState("");
  const [isPending, startTransition] = useTransition();
  const imapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (imapTimeoutRef.current) clearTimeout(imapTimeoutRef.current); }, []);

  const activeImapDays = settings.imapCheckDays.split(",").map((d) => d.trim());

  const handleImapCheck = () => {
    if (imapTimeoutRef.current) clearTimeout(imapTimeoutRef.current);
    setImapCheckStatus("pending");
    setImapCheckMsg("Připojuji se k poštovní schránce…");
    imapTimeoutRef.current = setTimeout(() => {
      imapTimeoutRef.current = null;
      setImapCheckStatus("error");
      setImapCheckMsg("Časový limit vypršel. Zkontrolujte nastavení IMAP (server, port, heslo).");
    }, 25000);
    startTransition(async () => {
      try {
        const result = await actionCheckImap();
        if (!imapTimeoutRef.current) return; // timeout already fired
        clearTimeout(imapTimeoutRef.current);
        imapTimeoutRef.current = null;
        if (result.found) {
          setImapCheckStatus("found");
          setImapCheckMsg(`Importován jídelníček ${result.weekLabel} (${countWord(result.itemCount ?? 0, "položka", "položky", "položek")}).`);
        } else if (result.error) {
          setImapCheckStatus("error");
          setImapCheckMsg(result.error);
        } else {
          setImapCheckStatus("notfound");
          setImapCheckMsg("Žádný nový e-mail s jídelníčkem nebyl nalezen.");
        }
      } catch {
        if (imapTimeoutRef.current) { clearTimeout(imapTimeoutRef.current); imapTimeoutRef.current = null; }
        setImapCheckStatus("error");
        setImapCheckMsg("Nepodařilo se připojit k poštovní schránce.");
      }
    });
  };

  return (
    <SettingsSection helpContent={IMAP_HELP} icon="menu_book" title="Automatický import jídelníčku">
      <p className="text-[12.5px] text-stone-500">
        Appka se každé ráno připojí k e-mailové schránce a automaticky importuje jídelníček z PDF přílohy od LIMY.
      </p>
      <SettingsToggle defaultChecked={settings.imapEnabled === "true"} label="Zapnout automatický import" name="imapEnabled" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <SettingsField hint="např. imap.gmail.com" label="IMAP server">
          <input className="modal-input" defaultValue={settings.imapHost} name="imapHost" type="text" />
        </SettingsField>
        <SettingsField hint="obvykle 993 pro SSL" label="Port">
          <input className="modal-input w-24" defaultValue={settings.imapPort} min="1" name="imapPort" type="number" />
        </SettingsField>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <SettingsField hint="Gmail adresa schránky" label="Uživatel (e-mail)">
          <input className="modal-input" defaultValue={settings.imapUser} name="imapUser" type="email" />
        </SettingsField>
        <SettingsField hint="Google App Password (16 znaků)" label="Heslo">
          <input className="modal-input" defaultValue={settings.imapPass} name="imapPass" type="password" autoComplete="new-password" />
        </SettingsField>
      </div>
      <SettingsField hint="e-mail, od kterého chodí jídelníčky, např. info@lima.cz – prázdné = všechny nepřečtené e-maily" label="Filtr odesílatele">
        <input className="modal-input" defaultValue={settings.imapSender} name="imapSender" placeholder="info@lima.cz" type="email" />
      </SettingsField>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <SettingsField hint="čas, kdy se provede kontrola schránky" label="Čas kontroly">
          <input className="modal-input w-32" defaultValue={settings.imapCheckTime} name="imapCheckTime" type="time" />
        </SettingsField>
        <SettingsDayPicker activeDays={activeImapDays} label="Kontrolovat ve dny" namePrefix="imapCheckDay" />
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
    </SettingsSection>
  );
}
