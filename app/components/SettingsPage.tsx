"use client";

import { useState, useTransition, useRef } from "react";
import type { AppSettings } from "@/lib/settings";
import { actionCheckPin, actionSaveSettings } from "@/app/actions";
import AppTopBar from "./AppTopBar";

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
        if (!res.ok) {
          setSmtpTestStatus("error");
          setSmtpTestMsg(`Server vrátil chybu ${res.status}.`);
          return;
        }
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

  return (
    <div className="v2-shell">
      <AppTopBar />

      {/* ── Infostrip ── */}
      <div className="v2-infostrip">
        <div className="v2-infostrip__facts">
          <span style={{ fontWeight: 700, color: "var(--v2-text)", fontSize: "0.95rem" }}>Nastavení</span>
          <span className="v2-fact">SMTP, e-mail příjemce, čas uzávěrky, PIN</span>
        </div>
      </div>

      {/* ── Content ── */}
      <main className="v2-content">
        {!unlocked ? (
          <section className="v2-dept">
            <div className="v2-dept__head">
              <div>
                <h2 className="v2-dept__title">Přístup chráněn PINem</h2>
                <span className="v2-dept__count">Zadejte PIN pro zobrazení nastavení</span>
              </div>
            </div>
            <div style={{ padding: "1.5rem 1.25rem" }}>
              <form onSubmit={handlePinSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: "280px" }}>
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
                  className="v2-btn v2-btn--primary"
                  disabled={isPending || pin.length === 0}
                  type="submit"
                >
                  {isPending ? "Ověřuji..." : "Odemknout"}
                </button>
              </form>
            </div>
          </section>
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
                  className="v2-btn v2-btn--secondary"
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
              <div className="settings-row">
                <Field hint="výchozí příjemce odesílané objednávky" label="Příjemce (To)">
                  <input
                    className="settings-input"
                    defaultValue={settings.orderEmailTo}
                    name="orderEmailTo"
                    type="email"
                  />
                </Field>
                <Field hint="pokud prázdné, Reply-To se nenastavuje" label="Adresa pro odpovědi (Reply-To)">
                  <input
                    className="settings-input"
                    defaultValue={settings.smtpReplyTo}
                    name="smtpReplyTo"
                    placeholder="jiri@example.com"
                    type="email"
                  />
                </Field>
              </div>
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

            <Section title="Ceník jídel">
              <p style={{ fontSize: "0.83rem", color: "var(--v2-text-muted, #6b7280)", margin: "0 0 0.75rem" }}>
                Výchozí ceny používané při importu jídelního lístku z webu. Existující položky v menu se nemění.
              </p>
              <div className="settings-row">
                <Field hint="Kč za porci" label="Výchozí cena polévky">
                  <input
                    className="settings-input settings-input--short"
                    defaultValue={settings.defaultSoupPrice}
                    min="0"
                    name="defaultSoupPrice"
                    type="number"
                  />
                </Field>
                <Field hint="Kč za porci" label="Výchozí cena jídla">
                  <input
                    className="settings-input settings-input--short"
                    defaultValue={settings.defaultMealPrice}
                    min="0"
                    name="defaultMealPrice"
                    type="number"
                  />
                </Field>
              </div>
            </Section>

            <Section title="Přílohy a doplňky">
              <p style={{ fontSize: "0.83rem", color: "var(--v2-text-muted, #6b7280)", margin: "0 0 0.75rem" }}>
                Ceny příloh zobrazované v modalu a používané pro výpočet ceny řádku.
              </p>
              <div className="settings-row">
                <Field hint="Kč/ks" label="Houska">
                  <input className="settings-input settings-input--short" defaultValue={settings.priceRoll} min="0" name="priceRoll" type="number" />
                </Field>
                <Field hint="Kč/ks" label="Houskový knedlík">
                  <input className="settings-input settings-input--short" defaultValue={settings.priceBreadDumpling} min="0" name="priceBreadDumpling" type="number" />
                </Field>
                <Field hint="Kč/ks" label="Bramborový knedlík">
                  <input className="settings-input settings-input--short" defaultValue={settings.pricePotatoDumpling} min="0" name="pricePotatoDumpling" type="number" />
                </Field>
              </div>
              <div className="settings-row">
                <Field hint="Kč/ks" label="Kečup">
                  <input className="settings-input settings-input--short" defaultValue={settings.priceKetchup} min="0" name="priceKetchup" type="number" />
                </Field>
                <Field hint="Kč/ks" label="Tatarka">
                  <input className="settings-input settings-input--short" defaultValue={settings.priceTatarka} min="0" name="priceTatarka" type="number" />
                </Field>
                <Field hint="Kč/ks" label="BBQ omáčka">
                  <input className="settings-input settings-input--short" defaultValue={settings.priceBbq} min="0" name="priceBbq" type="number" />
                </Field>
              </div>
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
                className="v2-btn v2-btn--primary"
                disabled={isPending}
                type="submit"
              >
                {isPending ? "Ukládám..." : "Uložit nastavení"}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
