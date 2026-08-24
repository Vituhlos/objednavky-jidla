"use client";

import { useState, useTransition } from "react";
import type { AppSettings } from "@/lib/settings";
import {
  EmailListInput,
  SettingsField,
  SettingsSection,
  SettingsToggle,
} from "./SettingsPrimitives";

/**
 * Odchozí pošta a adresy objednávky.
 *
 * Test připojení schválně nečte uložené nastavení, ale **rozepsaný formulář** —
 * jinak by se dalo otestovat jen to, co už je uložené, a překlep v hesle by se
 * projevil až po uložení. Formulář se hledá přes `closest("form")` od tlačítka,
 * takže sekce nepotřebuje znát ref na rodiče.
 */
export function SmtpSection({ settings }: { settings: AppSettings }) {
  const [smtpTestStatus, setSmtpTestStatus] = useState<"idle" | "ok" | "error">("idle");
  const [smtpTestMsg, setSmtpTestMsg] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSmtpTest = (event: React.MouseEvent<HTMLButtonElement>) => {
    const form = event.currentTarget.closest("form");
    if (!form) return;
    const fd = new FormData(form);
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

  return (
    <>
      <SettingsSection icon="send" title="SMTP – odchozí pošta">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SettingsField hint="např. smtp.gmail.com" label="SMTP host">
            <input className="modal-input" defaultValue={settings.smtpHost} name="smtpHost" placeholder="smtp.example.com" type="text" />
          </SettingsField>
          <SettingsField hint="obvykle 587 nebo 465" label="Port">
            <input className="modal-input" defaultValue={settings.smtpPort} name="smtpPort" placeholder="587" type="number" />
          </SettingsField>
          <SettingsField label="Uživatel (e-mail)">
            <input className="modal-input" defaultValue={settings.smtpUser} name="smtpUser" placeholder="user@example.com" type="email" />
          </SettingsField>
          <SettingsField label="Heslo">
            <input className="modal-input" defaultValue={settings.smtpPass} name="smtpPass" placeholder="••••••••" type="password" />
          </SettingsField>
          <SettingsField hint="pokud prázdné, použije se uživatel" label="Odesílatel (From)">
            <input className="modal-input" defaultValue={settings.smtpFrom} name="smtpFrom" placeholder="Objednávky <orders@example.com>" type="text" />
          </SettingsField>
          <SettingsField hint="zaškrtněte pro port 465" label="TLS (SMTP Secure)">
            <SettingsToggle defaultChecked={settings.smtpSecure === "true"} label="Použít TLS (SMTP Secure)" name="smtpSecure" />
          </SettingsField>
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
      </SettingsSection>

      <SettingsSection icon="send" title="E-mail objednávky">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SettingsField hint="můžete zadat více adres oddělených čárkou, středníkem nebo novým řádkem" label="Příjemci objednávky (To)">
            <EmailListInput defaultValue={settings.orderEmailTo} name="orderEmailTo" placeholder="vedouci@firma.cz, kuchyne@firma.cz" />
          </SettingsField>
          <SettingsField hint="uloží se k objednávce jako kopie a použije se při ručním i automatickém odeslání" label="Doplňkové kopie objednávky">
            <EmailListInput defaultValue={settings.orderExtraEmail} name="orderExtraEmail" placeholder="obchod@firma.cz; sklad@firma.cz" />
          </SettingsField>
          <SettingsField hint="pokud prázdné, Reply-To se nenastavuje; více adres je podporováno" label="Adresa pro odpovědi (Reply-To)">
            <EmailListInput defaultValue={settings.smtpReplyTo} name="smtpReplyTo" placeholder="jiri@example.com, objednavky@firma.cz" />
          </SettingsField>
          <SettingsField hint="kam chodí upozornění na chybějící jídelníček; pokud prázdné, použijí se příjemci objednávky" label="Příjemci upozornění (jídelníček)">
            <EmailListInput defaultValue={settings.reminderEmailTo} name="reminderEmailTo" placeholder="vedouci@firma.cz" />
          </SettingsField>
        </div>
      </SettingsSection>
    </>
  );
}
