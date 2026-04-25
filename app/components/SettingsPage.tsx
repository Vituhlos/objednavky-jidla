"use client";

import { useState, useTransition, useRef } from "react";
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
} from "@/app/actions";
import AppTopBar from "./AppTopBar";

const ACCENT_OPTIONS = [
  { value: "blue", label: "Modrá" },
  { value: "rust", label: "Rezavá" },
  { value: "green", label: "Zelená" },
];

const DAY_OPTIONS: { code: string; label: string }[] = [
  { code: "Po", label: "Po" },
  { code: "Út", label: "Út" },
  { code: "St", label: "St" },
  { code: "Čt", label: "Čt" },
  { code: "Pá", label: "Pá" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="settings-section">
      <h3 className="settings-section__title">{title}</h3>
      <div className="settings-section__body">{children}</div>
    </div>
  );
}

function Field({
  label, hint, children,
}: {
  label: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <label className="settings-field">
      <span className="settings-field__label">{label}</span>
      {hint && <span className="settings-field__hint">{hint}</span>}
      {children}
    </label>
  );
}

// ── Department row ────────────────────────────────────────

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
  const [label, setLabel] = useState(dept.label);
  const [emailLabel, setEmailLabel] = useState(dept.emailLabel);
  const [accent, setAccent] = useState(dept.accent);

  if (!editing) {
    return (
      <div className="dept-row">
        <div className="dept-row__info">
          <span className={`dept-dot dept-dot--${dept.accent}`} />
          <span className="dept-row__label">{dept.label}</span>
          <span className="dept-row__name">({dept.name})</span>
        </div>
        <div className="dept-row__actions">
          <button className="dept-move-btn" disabled={isFirst} onClick={() => onMoveUp(dept.id)} title="Nahoru" type="button">↑</button>
          <button className="dept-move-btn" disabled={isLast} onClick={() => onMoveDown(dept.id)} title="Dolů" type="button">↓</button>
          <button className="v2-btn v2-btn--secondary" onClick={() => setEditing(true)} type="button">Upravit</button>
          <button className="v2-btn v2-btn--danger" onClick={() => onDelete(dept.id)} type="button">Smazat</button>
        </div>
      </div>
    );
  }

  return (
    <div className="dept-row dept-row--editing">
      <div className="dept-edit-grid">
        <label className="settings-field__label" style={{ gridColumn: "1/-1" }}>Zobrazovaný název</label>
        <input className="settings-input" onChange={(e) => setLabel(e.target.value)} style={{ gridColumn: "1/-1" }} value={label} />
        <label className="settings-field__label" style={{ gridColumn: "1/-1" }}>Název v e-mailu</label>
        <input className="settings-input" onChange={(e) => setEmailLabel(e.target.value)} style={{ gridColumn: "1/-1" }} value={emailLabel} />
        <label className="settings-field__label">Barva</label>
        <select className="settings-input" onChange={(e) => setAccent(e.target.value)} value={accent}>
          {ACCENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="dept-row__actions" style={{ marginTop: "0.5rem" }}>
        <button className="v2-btn v2-btn--primary" onClick={() => { onSave(dept.id, { label, emailLabel, accent }); setEditing(false); }} type="button">Uložit</button>
        <button className="v2-btn v2-btn--secondary" onClick={() => { setLabel(dept.label); setEmailLabel(dept.emailLabel); setAccent(dept.accent); setEditing(false); }} type="button">Zrušit</button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  row_add: "Přidání řádku",
  row_update: "Úprava řádku",
  row_delete: "Smazání řádku",
  order_send: "Odeslání objednávky",
  order_reopen: "Znovuotevření",
  order_clear: "Vymazání objednávky",
  auto_send: "Auto-odeslání",
};

function formatTs(ts: string): string {
  const d = new Date(ts + "Z");
  return d.toLocaleString("cs-CZ", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function SettingsPage({
  settings, departments: initialDepts, auditLog: initialAuditLog,
}: {
  settings: AppSettings;
  departments: DepartmentInfo[];
  auditLog: AuditEntry[];
}) {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [smtpTestStatus, setSmtpTestStatus] = useState<"idle" | "ok" | "error">("idle");
  const [smtpTestMsg, setSmtpTestMsg] = useState("");
  const [departments, setDepartments] = useState<DepartmentInfo[]>(initialDepts);
  const [deptError, setDeptError] = useState<string | null>(null);
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptLabel, setNewDeptLabel] = useState("");
  const [newDeptAccent, setNewDeptAccent] = useState("blue");
  const [showAddDept, setShowAddDept] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);

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
    setDepartments((prev) => {
      const idx = prev.findIndex((d) => d.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      const swap = direction === "up" ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      startTransition(async () => {
        await actionReorderDepartments(next.map((d) => d.id));
      });
      return next;
    });
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
    <div className="v2-shell">
      <AppTopBar />
      <div className="v2-infostrip">
        <div className="v2-infostrip__facts">
          <span style={{ fontWeight: 700, color: "var(--v2-text)", fontSize: "0.95rem" }}>Nastavení</span>
          <span className="v2-fact">SMTP, e-mail příjemce, čas uzávěrky, PIN</span>
        </div>
      </div>

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
                {pinError && <p className="settings-pin-error">Nesprávný PIN. Zkuste to znovu.</p>}
                <button className="v2-btn v2-btn--primary" disabled={isPending || pin.length === 0} type="submit">
                  {isPending ? "Ověřuji..." : "Odemknout"}
                </button>
              </form>
            </div>
          </section>
        ) : (
          <>
            <form className="settings-form" onSubmit={handleSave} ref={formRef}>
              <Section title="SMTP – odchozí pošta">
                <div className="settings-row">
                  <Field hint="např. smtp.gmail.com" label="SMTP host">
                    <input className="settings-input" defaultValue={settings.smtpHost} name="smtpHost" placeholder="smtp.example.com" type="text" />
                  </Field>
                  <Field hint="obvykle 587 nebo 465" label="Port">
                    <input className="settings-input" defaultValue={settings.smtpPort} name="smtpPort" placeholder="587" type="number" />
                  </Field>
                </div>
                <div className="settings-row">
                  <Field label="Uživatel (e-mail)">
                    <input className="settings-input" defaultValue={settings.smtpUser} name="smtpUser" placeholder="user@example.com" type="email" />
                  </Field>
                  <Field label="Heslo">
                    <input className="settings-input" defaultValue={settings.smtpPass} name="smtpPass" placeholder="••••••••" type="password" />
                  </Field>
                </div>
                <div className="settings-row">
                  <Field hint="pokud prázdné, použije se uživatel" label="Odesílatel (From)">
                    <input className="settings-input" defaultValue={settings.smtpFrom} name="smtpFrom" placeholder="Objednávky <orders@example.com>" type="text" />
                  </Field>
                  <Field hint="zaškrtněte pro port 465" label="TLS (SMTP Secure)">
                    <label className="settings-checkbox">
                      <input defaultChecked={settings.smtpSecure === "true"} name="smtpSecure" type="checkbox" />
                      <span>Použít TLS (SMTP Secure)</span>
                    </label>
                  </Field>
                </div>
                <div className="settings-test-row">
                  <button className="v2-btn v2-btn--secondary" disabled={isPending} onClick={handleSmtpTest} type="button">Testovat připojení</button>
                  {smtpTestMsg && (
                    <span className={`settings-test-status settings-test-status--${smtpTestStatus}`}>{smtpTestMsg}</span>
                  )}
                </div>
              </Section>

              <Section title="E-mail objednávky">
                <div className="settings-row">
                  <Field hint="výchozí příjemce odesílané objednávky" label="Příjemce (To)">
                    <input className="settings-input" defaultValue={settings.orderEmailTo} name="orderEmailTo" type="email" />
                  </Field>
                  <Field hint="pokud prázdné, Reply-To se nenastavuje" label="Adresa pro odpovědi (Reply-To)">
                    <input className="settings-input" defaultValue={settings.smtpReplyTo} name="smtpReplyTo" placeholder="jiri@example.com" type="email" />
                  </Field>
                </div>
              </Section>

              <Section title="Provoz">
                <Field hint="zobrazuje se v hlavičce objednávkové stránky" label="Čas uzávěrky">
                  <input className="settings-input settings-input--short" defaultValue={settings.cutoffTime} name="cutoffTime" type="time" />
                </Field>
              </Section>

              <Section title="Automatické odeslání">
                <p style={{ fontSize: "0.83rem", color: "var(--v2-text-muted, #6b7280)", margin: "0 0 0.75rem" }}>
                  Objednávka se automaticky odešle v nastavenou dobu. Přeskočí se pokud je den označen jako zavřený v jídelníčku nebo pokud není splněný minimální počet objednávek.
                </p>
                <Field label="Automatické odeslání">
                  <label className="settings-checkbox">
                    <input defaultChecked={settings.autoSendEnabled === "true"} name="autoSendEnabled" type="checkbox" />
                    <span>Zapnout automatické odeslání</span>
                  </label>
                </Field>
                <div className="settings-row">
                  <Field hint="čas kdy se objednávka automaticky odešle" label="Čas odeslání">
                    <input className="settings-input settings-input--short" defaultValue={settings.autoSendTime} name="autoSendTime" type="time" />
                  </Field>
                  <Field hint="minimálně N objednávek, jinak se přeskočí" label="Minimální počet objednávek">
                    <input className="settings-input settings-input--short" defaultValue={settings.autoSendMinOrders} min="1" name="autoSendMinOrders" type="number" />
                  </Field>
                </div>
                <div className="settings-field">
                  <span className="settings-field__label">Dny odeslání</span>
                  <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.35rem" }}>
                    {DAY_OPTIONS.map((d) => (
                      <label className="settings-checkbox" key={d.code} style={{ minWidth: "auto" }}>
                        <input
                          defaultChecked={activeDays.includes(d.code)}
                          name={`autoSendDay_${d.code}`}
                          type="checkbox"
                        />
                        <span>{d.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </Section>

              <Section title="Ceník jídel">
                <p style={{ fontSize: "0.83rem", color: "var(--v2-text-muted, #6b7280)", margin: "0 0 0.75rem" }}>
                  Výchozí ceny používané při importu jídelního lístku z webu. Existující položky v menu se nemění.
                </p>
                <div className="settings-row">
                  <Field hint="Kč za porci" label="Výchozí cena polévky">
                    <input className="settings-input settings-input--short" defaultValue={settings.defaultSoupPrice} min="0" name="defaultSoupPrice" type="number" />
                  </Field>
                  <Field hint="Kč za porci" label="Výchozí cena jídla">
                    <input className="settings-input settings-input--short" defaultValue={settings.defaultMealPrice} min="0" name="defaultMealPrice" type="number" />
                  </Field>
                </div>
              </Section>

              <Section title="Přílohy a doplňky">
                <p style={{ fontSize: "0.83rem", color: "var(--v2-text-muted, #6b7280)", margin: "0 0 0.75rem" }}>
                  Ceny příloh zobrazované v modalu a používané pro výpočet ceny řádku.
                </p>
                <div className="settings-row">
                  <Field hint="Kč/ks" label="Houska"><input className="settings-input settings-input--short" defaultValue={settings.priceRoll} min="0" name="priceRoll" type="number" /></Field>
                  <Field hint="Kč/ks" label="Houskový knedlík"><input className="settings-input settings-input--short" defaultValue={settings.priceBreadDumpling} min="0" name="priceBreadDumpling" type="number" /></Field>
                  <Field hint="Kč/ks" label="Bramborový knedlík"><input className="settings-input settings-input--short" defaultValue={settings.pricePotatoDumpling} min="0" name="pricePotatoDumpling" type="number" /></Field>
                </div>
                <div className="settings-row">
                  <Field hint="Kč/ks" label="Kečup"><input className="settings-input settings-input--short" defaultValue={settings.priceKetchup} min="0" name="priceKetchup" type="number" /></Field>
                  <Field hint="Kč/ks" label="Tatarka"><input className="settings-input settings-input--short" defaultValue={settings.priceTatarka} min="0" name="priceTatarka" type="number" /></Field>
                  <Field hint="Kč/ks" label="BBQ omáčka"><input className="settings-input settings-input--short" defaultValue={settings.priceBbq} min="0" name="priceBbq" type="number" /></Field>
                </div>
              </Section>

              <Section title="Zabezpečení">
                <Field hint="nechte prázdné pro zachování stávajícího PINu" label="Nový PIN (číslice)">
                  <input className="settings-input settings-input--short" inputMode="numeric" maxLength={8} name="newPin" pattern="[0-9]*" placeholder="ponechte prázdné" type="password" />
                </Field>
              </Section>

              <div className="settings-actions">
                {saveStatus === "saved" && <span className="settings-save-ok">Nastavení uloženo.</span>}
                {saveStatus === "error" && <span className="settings-save-error">Chyba při ukládání.</span>}
                <button className="v2-btn v2-btn--primary" disabled={isPending} type="submit">
                  {isPending ? "Ukládám..." : "Uložit nastavení"}
                </button>
              </div>
            </form>

            {/* Správa oddělení — mimo hlavní formulář aby nepomíchala submit */}
            <div className="settings-section">
              <h3 className="settings-section__title">Oddělení</h3>
              <div className="settings-section__body">
                <p style={{ fontSize: "0.83rem", color: "var(--v2-text-muted, #6b7280)", margin: "0 0 0.75rem" }}>
                  Správa oddělení zobrazovaných v objednávkovém formuláři. Změny se projeví okamžitě.
                </p>
                {deptError && <p className="settings-pin-error" style={{ marginBottom: "0.5rem" }}>{deptError}</p>}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
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
                  <div className="dept-add-form">
                    <div className="settings-row">
                      <Field hint="interní klíč (nelze měnit)" label="Kód oddělení">
                        <input className="settings-input" onChange={(e) => setNewDeptName(e.target.value)} placeholder="např. Sklad" value={newDeptName} />
                      </Field>
                      <Field hint="zobrazovaný název" label="Název">
                        <input className="settings-input" onChange={(e) => setNewDeptLabel(e.target.value)} placeholder="např. Sklad" value={newDeptLabel} />
                      </Field>
                      <Field label="Barva">
                        <select className="settings-input" onChange={(e) => setNewDeptAccent(e.target.value)} value={newDeptAccent}>
                          {ACCENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </Field>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                      <button className="v2-btn v2-btn--primary" disabled={isPending || !newDeptName.trim() || !newDeptLabel.trim()} onClick={handleAddDept} type="button">Přidat</button>
                      <button className="v2-btn v2-btn--secondary" onClick={() => { setShowAddDept(false); setNewDeptName(""); setNewDeptLabel(""); }} type="button">Zrušit</button>
                    </div>
                  </div>
                ) : (
                  <button className="v2-btn v2-btn--secondary" onClick={() => setShowAddDept(true)} style={{ marginTop: "0.75rem" }} type="button">+ Přidat oddělení</button>
                )}
              </div>
            </div>

            {/* Záloha dat */}
            <div className="settings-section">
              <h3 className="settings-section__title">Záloha dat</h3>
              <div className="settings-section__body">
                <p style={{ fontSize: "0.83rem", color: "var(--v2-text-muted, #6b7280)", margin: "0 0 0.75rem" }}>
                  Stáhněte zálohu všech objednávek, jídelníčků a nastavení oddělení ve formátu JSON.
                </p>
                <a className="v2-btn v2-btn--secondary" download href="/api/backup" style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", textDecoration: "none" }}>
                  ↓ Stáhnout zálohu
                </a>
              </div>
            </div>

            {/* Historie změn */}
            <div className="settings-section">
              <h3 className="settings-section__title">Historie změn</h3>
              <div className="settings-section__body" style={{ padding: 0, overflow: "hidden" }}>
                {initialAuditLog.length === 0 ? (
                  <p style={{ padding: "1rem", fontSize: "0.83rem", color: "var(--v2-text-muted, #6b7280)", margin: 0 }}>
                    Zatím žádné záznamy.
                  </p>
                ) : (
                  <div className="audit-table-wrap">
                    <table className="audit-table">
                      <thead>
                        <tr>
                          <th>Čas</th>
                          <th>Akce</th>
                          <th>Oddělení</th>
                          <th>Osoba</th>
                          <th>Detail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {initialAuditLog.map((entry) => (
                          <tr key={entry.id} className={`audit-row audit-row--${entry.action}`}>
                            <td className="audit-ts">{formatTs(entry.ts)}</td>
                            <td className="audit-action">{ACTION_LABELS[entry.action] ?? entry.action}</td>
                            <td>{entry.department ?? "—"}</td>
                            <td>{entry.personName ?? "—"}</td>
                            <td className="audit-detail">{entry.details ?? ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
