"use client";

import { useState, useTransition, useRef } from "react";
import type { AppSettings } from "@/lib/settings";
import { actionCheckPin, actionSaveSettings } from "@/app/actions";
import AppSidebar from "./AppSidebar";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="settings-section">
      <h3 className="settings-section__title">{title}</h3>
      <div className="settings-section__body">{children}</div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="settings-field">
      <span className="settings-field__label">{label}</span>
      {hint && <span className="settings-field__hint">{hint}</span>}
      {children}
    </label>
  );
}

export default function SettingsPage({ settings }: { settings: AppSettings }) {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [smtpTestStatus, setSmtpTestStatus] = useState<"idle" | "ok" | "error">("idle");
  const [smtpTestMsg, setSmtpTestMsg] = useState("");

  const formRef = useRef<HTMLFormElement>(null);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(false);
    startTransition(async () => {
      const ok = await actionCheckPin(pin);
      if (ok) {
        setUnlocked(true);
      } else {
        setPinError(true);
        setPin("");
      }
    });
  };

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const updates: Partial<AppSettings> = {
      smtpHost: fd.get("smtpHost") as string,
      smtpPort: fd.get("smtpPort") as string,
      smtpUser: fd.get("smtpUser") as string,
      smtpPass: fd.get("smtpPass") as string,
      smtpFrom: fd.get("smtpFrom") as string,
      smtpSecure: fd.get("smtpSecure") === "on" ? "true" : "false",
      orderEmailTo: fd.get("orderEmailTo") as string,
      cutoffTime: fd.get("cutoffTime") as string,
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
    setSmtpTestStatus("idle");
    setSmtpTestMsg("Testuji připojení...");
    startTransition(async () => {
      try {
        const res = await fetch("/api/smtp-test");
        const json = await res.json() as { ok: boolean; error?: string };
        if (json.ok) {
          setSmtpTestStatus("ok");
          setSmtpTestMsg("Připojení proběhlo úspěšně.");
        } else {
          setSmtpTestStatus("error");
          setSmtpTestMsg(json.error ?? "Nepodařilo se připojit.");
        }
      } catch {
        setSmtpTestStatus("error");
        setSmtpTestMsg("Síťová chyba při testu.");
      }
    });
  };

  const today = new Date().toLocaleDateString("cs-CZ", {
    weekday: "short", day: "numeric", month: "numeric", year: "numeric",
  });

  return (
    <main className="app-shell">
      <AppSidebar />

      <section className="main-stage">
        <header className="hero">
          <div className="hero__topline">
            <span>{today}</span>
          </div>
          <div className="hero__content">
            <div>
              <p className="hero__eyebrow">Konfigurace systému</p>
              <h2>Nastavení</h2>
              <p className="hero__description">
                SMTP, výchozí e-mail příjemce, čas uzávěrky a PIN pro tuto
                stránku.
              </p>
            </div>
          </div>
        </header>

        {!unlocked ? (
          <div className="settings-pin-gate">
            <form className="settings-pin-form" onSubmit={handlePinSubmit}>
              <p className="settings-pin-form__label">Zadejte PIN pro přístup k nastavení</p>
              <input
                autoFocus
                className="settings-pin-input"
                inputMode="numeric"
                maxLength={8}
                onChange={(e) => setPin(e.target.value)}
                pattern="[0-9]*"
                placeholder="••••"
                type="password"
                value={pin}
              />
              {pinError && (
                <p className="settings-pin-error">Nesprávný PIN. Zkuste to znovu.</p>
              )}
              <button
                className="header-action header-action--primary"
                disabled={isPending || pin.length === 0}
                type="submit"
              >
                {isPending ? "Ověřuji..." : "Odemknout"}
              </button>
            </form>
          </div>
        ) : (
          <form className="settings-form" onSubmit={handleSave} ref={formRef}>
            <Section title="SMTP – odchozí pošta">
              <div className="settings-row">
                <Field hint="např. smtp.gmail.com" label="SMTP host">
                  <input
                    className="settings-input"
                    defaultValue={settings.smtpHost}
                    name="smtpHost"
                    placeholder="smtp.example.com"
                    type="text"
                  />
                </Field>
                <Field hint="obvykle 587 nebo 465" label="Port">
                  <input
                    className="settings-input"
                    defaultValue={settings.smtpPort}
                    name="smtpPort"
                    placeholder="587"
                    type="number"
                  />
                </Field>
              </div>
              <div className="settings-row">
                <Field label="Uživatel (e-mail)">
                  <input
                    className="settings-input"
                    defaultValue={settings.smtpUser}
                    name="smtpUser"
                    placeholder="user@example.com"
                    type="email"
                  />
                </Field>
                <Field label="Heslo">
                  <input
                    className="settings-input"
                    defaultValue={settings.smtpPass}
                    name="smtpPass"
                    placeholder="••••••••"
                    type="password"
                  />
                </Field>
              </div>
              <div className="settings-row">
                <Field hint="pokud prázdné, použije se uživatel" label="Odesílatel (From)">
                  <input
                    className="settings-input"
                    defaultValue={settings.smtpFrom}
                    name="smtpFrom"
                    placeholder="Objednávky <orders@example.com>"
                    type="text"
                  />
                </Field>
                <Field hint="zaškrtněte pro port 465" label="TLS (SMTP Secure)">
                  <label className="settings-checkbox">
                    <input
                      defaultChecked={settings.smtpSecure === "true"}
                      name="smtpSecure"
                      type="checkbox"
                    />
                    <span>Použít TLS (SMTP Secure)</span>
                  </label>
                </Field>
              </div>
              <div className="settings-test-row">
                <button
                  className="header-action header-action--secondary"
                  disabled={isPending}
                  onClick={handleSmtpTest}
                  type="button"
                >
                  Testovat připojení
                </button>
                {smtpTestMsg && (
                  <span className={`settings-test-status settings-test-status--${smtpTestStatus}`}>
                    {smtpTestMsg}
                  </span>
                )}
              </div>
            </Section>

            <Section title="E-mail objednávky">
              <Field hint="výchozí příjemce odesílané objednávky" label="Příjemce (ORDER_EMAIL_TO)">
                <input
                  className="settings-input"
                  defaultValue={settings.orderEmailTo}
                  name="orderEmailTo"
                  type="email"
                />
              </Field>
            </Section>

            <Section title="Provoz">
              <Field hint="zobrazuje se v hlavičce objednávkové stránky" label="Čas uzávěrky">
                <input
                  className="settings-input settings-input--short"
                  defaultValue={settings.cutoffTime}
                  name="cutoffTime"
                  type="time"
                />
              </Field>
            </Section>

            <Section title="Zabezpečení">
              <Field
                hint="nechte prázdné pro zachování stávajícího PINu"
                label="Nový PIN (číslice)"
              >
                <input
                  className="settings-input settings-input--short"
                  inputMode="numeric"
                  maxLength={8}
                  name="newPin"
                  pattern="[0-9]*"
                  placeholder="ponechte prázdné"
                  type="password"
                />
              </Field>
            </Section>

            <div className="settings-actions">
              {saveStatus === "saved" && (
                <span className="settings-save-ok">Nastavení uloženo.</span>
              )}
              {saveStatus === "error" && (
                <span className="settings-save-error">Chyba při ukládání.</span>
              )}
              <button
                className="header-action header-action--primary"
                disabled={isPending}
                type="submit"
              >
                {isPending ? "Ukládám..." : "Uložit nastavení"}
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
