"use client";

import { useState, useEffect } from "react";
import { signOut, signIn } from "next-auth/react";
import MIcon from "./MIcon";
import {
  actionUpdateProfile,
  actionChangePassword,
  actionChangeEmail,
  actionResendVerifyEmail,
  actionGetMyOrders,
  actionRevokeAllSessions,
  actionDeleteAccount,
} from "@/app/actions";

type Dept = { name: string; label: string };
type OrderItem = { date: string; mainDish: string | null };
type MonthEntry = { month: string; spending: number };

function InitialsAvatar({ firstName, lastName }: { firstName: string; lastName: string }) {
  const initials = (`${firstName.charAt(0)}${lastName.charAt(0)}`).toUpperCase() || "?";
  return (
    <div
      className="w-[72px] h-[72px] rounded-2xl flex items-center justify-center shrink-0 font-display font-bold text-white text-[26px]"
      style={{ background: "linear-gradient(135deg,#F59E0B,#EA580C)", boxShadow: "0 6px 20px -6px rgba(245,158,11,0.5)" }}
    >
      {initials}
    </div>
  );
}

function StatTile({ icon, value, label }: { icon: string; value: string | number; label: string }) {
  return (
    <div className="glass-soft rounded-2xl p-3 flex-1 flex flex-col gap-1">
      <MIcon name={icon} size={17} style={{ color: "#D97706" }} />
      <div className="font-display font-bold text-[20px] text-stone-900 leading-none">{value}</div>
      <div className="text-[11px] text-stone-500 leading-tight">{label}</div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-[11.5px] font-semibold text-stone-600">{children}</label>;
}

function TextInput({ id, value, onChange, placeholder, disabled, type = "text" }: {
  id?: string; value: string; onChange?: (v: string) => void;
  placeholder?: string; disabled?: boolean; type?: string;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      placeholder={placeholder}
      disabled={disabled}
      className={`w-full rounded-xl px-3 py-2.5 text-[13px] bg-white/60 border border-white/70 text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400/40 ${disabled ? "opacity-60 cursor-default" : ""}`}
    />
  );
}

function PasswordInput({ id, label, value, onChange, placeholder }: {
  id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl px-3 py-2.5 pr-10 text-[13px] bg-white/60 border border-white/70 text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400/40"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition"
        >
          <MIcon name={show ? "visibility_off" : "visibility"} size={17} />
        </button>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, label, description }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; description?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-[13px] font-semibold text-stone-800">{label}</div>
        {description && <div className="text-[11.5px] text-stone-500 mt-0.5">{description}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${checked ? "" : "bg-stone-300"}`}
        style={checked ? { background: "linear-gradient(135deg,#F59E0B,#EA580C)" } : {}}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`}
        />
      </button>
    </div>
  );
}

function SectionCard({ title, icon, children, accent }: {
  title: string; icon: string; children: React.ReactNode; accent?: boolean;
}) {
  return (
    <div className="glass-card rounded-3xl overflow-hidden">
      <div
        className="flex items-center gap-2 px-5 py-3.5 border-b border-white/40"
        style={accent ? { background: "rgba(245,158,11,0.05)" } : {}}
      >
        <MIcon name={icon} size={16} style={{ color: "#D97706" }} />
        <span className="font-display font-bold text-[13.5px] text-stone-800">{title}</span>
      </div>
      <div className="p-4 md:p-5 flex flex-col gap-3">{children}</div>
    </div>
  );
}

function StatusMsg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return (
    <p className={`text-[12px] font-semibold ${msg.ok ? "text-green-700" : "text-red-600"}`}>
      {msg.text}
    </p>
  );
}

function OrangeButton({ children, disabled, type = "submit", onClick }: {
  children: React.ReactNode; disabled?: boolean; type?: "submit" | "button"; onClick?: () => void;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="self-start px-4 py-2 rounded-xl text-[12.5px] font-semibold text-white transition disabled:opacity-50"
      style={{ background: "linear-gradient(135deg,#F59E0B,#EA580C)" }}
    >
      {children}
    </button>
  );
}

function GoogleIcon({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("cs-CZ", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export default function ProfilePage({
  firstName, lastName, email, role, emailVerified, hasPassword,
  defaultDepartment, emailOrderConfirmation, departments,
  totalOrders, thisMonthOrders, favoriteDish, monthlySpending, showSettingsLink,
  linkedProviders, monthlyHistory, telegramConfigured, telegramBotUrl,
  createdAt, lastLoginAt,
}: {
  firstName: string; lastName: string; email: string | null;
  role: string; emailVerified: boolean; hasPassword: boolean;
  defaultDepartment: string | null; emailOrderConfirmation: boolean;
  departments: Dept[];
  totalOrders: number; thisMonthOrders: number;
  favoriteDish: string | null; monthlySpending: number;
  showSettingsLink: boolean;
  linkedProviders: string[];
  monthlyHistory: MonthEntry[];
  telegramConfigured: boolean;
  telegramBotUrl: string;
  createdAt: string;
  lastLoginAt: string;
}) {
  const isAdmin = role === "admin";
  const [loggingOut, setLoggingOut] = useState(false);

  // Profil form
  const [editFirst, setEditFirst] = useState(firstName);
  const [editLast, setEditLast] = useState(lastName);
  const [editDept, setEditDept] = useState(defaultDepartment ?? "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Změna e-mailu
  const [newEmail, setNewEmail] = useState("");
  const [emailPwd, setEmailPwd] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Změna hesla
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Moje objednávky
  const [orders, setOrders] = useState<OrderItem[] | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Verify email banner
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);

  // Notifikace
  const [emailConfLocal, setEmailConfLocal] = useState(emailOrderConfirmation);
  const [notifMsg, setNotifMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pushGranted, setPushGranted] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);

  // QR kód
  const [showQr, setShowQr] = useState(false);

  // Odhlásit ze všech zařízení
  const [revokeLoading, setRevokeLoading] = useState(false);
  const [revokeMsg, setRevokeMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Smazat účet
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePwd, setDeletePwd] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPushSupported(true);
      setPushGranted(Notification.permission === "granted");
    }
  }, []);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileSaving(true); setProfileMsg(null);
    try {
      await actionUpdateProfile({
        firstName: editFirst, lastName: editLast,
        defaultDepartment: editDept || null,
      });
      setProfileMsg({ ok: true, text: "Profil uložen." });
    } catch (err) {
      setProfileMsg({ ok: false, text: err instanceof Error ? err.message : "Chyba." });
    } finally { setProfileSaving(false); }
  }

  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailSaving(true); setEmailMsg(null);
    try {
      await actionChangeEmail(newEmail, emailPwd);
      setEmailMsg({ ok: true, text: "E-mail změněn. Ověř novou adresu." });
      setNewEmail(""); setEmailPwd("");
    } catch (err) {
      setEmailMsg({ ok: false, text: err instanceof Error ? err.message : "Chyba." });
    } finally { setEmailSaving(false); }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwdMsg(null);
    if (newPwd !== confirmPwd) { setPwdMsg({ ok: false, text: "Hesla se neshodují." }); return; }
    if (newPwd.length < 6) { setPwdMsg({ ok: false, text: "Min. 6 znaků." }); return; }
    setPwdSaving(true);
    try {
      await actionChangePassword(oldPwd, newPwd);
      setPwdMsg({ ok: true, text: "Heslo změněno." });
      setOldPwd(""); setNewPwd(""); setConfirmPwd("");
    } catch (err) {
      setPwdMsg({ ok: false, text: err instanceof Error ? err.message : "Chyba." });
    } finally { setPwdSaving(false); }
  }

  async function handleLoadOrders() {
    setOrdersLoading(true);
    const data = await actionGetMyOrders();
    setOrders(data);
    setOrdersLoading(false);
  }

  async function handleResendVerify() {
    setVerifyLoading(true);
    const res = await actionResendVerifyEmail();
    setVerifyMsg(res.ok ? "Ověřovací e-mail odeslán." : (res.error ?? "Chyba."));
    setVerifyLoading(false);
  }

  async function handleEmailConfToggle(v: boolean) {
    setEmailConfLocal(v);
    try {
      await actionUpdateProfile({ emailOrderConfirmation: v });
      setNotifMsg({ ok: true, text: "Uloženo." });
      setTimeout(() => setNotifMsg(null), 2000);
    } catch {
      setEmailConfLocal(!v);
      setNotifMsg({ ok: false, text: "Chyba při ukládání." });
    }
  }

  async function handlePushToggle() {
    if (pushGranted) {
      setNotifMsg({ ok: false, text: "Push notifikace zakažte v nastavení prohlížeče." });
      setTimeout(() => setNotifMsg(null), 3000);
      return;
    }
    const permission = await Notification.requestPermission();
    setPushGranted(permission === "granted");
    setNotifMsg(
      permission === "granted"
        ? { ok: true, text: "Push notifikace povoleny." }
        : { ok: false, text: "Push notifikace nebyly povoleny." }
    );
    setTimeout(() => setNotifMsg(null), 3000);
  }

  async function handleRevokeAllSessions() {
    setRevokeLoading(true); setRevokeMsg(null);
    try {
      await actionRevokeAllSessions();
      setRevokeMsg({ ok: true, text: "Všechna ostatní zařízení byla odhlášena." });
      setTimeout(() => setRevokeMsg(null), 4000);
    } catch (err) {
      setRevokeMsg({ ok: false, text: err instanceof Error ? err.message : "Chyba." });
    } finally { setRevokeLoading(false); }
  }

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    setDeleteLoading(true); setDeleteMsg(null);
    try {
      await actionDeleteAccount(hasPassword ? deletePwd : undefined);
      signOut({ callbackUrl: "/" });
    } catch (err) {
      setDeleteMsg({ ok: false, text: err instanceof Error ? err.message : "Chyba." });
      setDeleteLoading(false);
    }
  }

  const displayName = `${editFirst} ${editLast}`.trim() || firstName;
  const hasGoogle = linkedProviders.includes("google");
  const hasCredentials = linkedProviders.includes("credentials");
  const maxSpending = Math.max(...monthlyHistory.map((m) => m.spending), 1);

  return (
    <div className="k-shell">
      <div className="flex-1 overflow-y-auto scroll-area p-4 md:p-5 pb-nav">
        <div className="max-w-2xl mx-auto w-full flex flex-col gap-4">

          {/* ── Hero karta ── */}
          <div className="glass-card rounded-3xl overflow-hidden">
            <div className="p-5 md:p-6" style={{ background: "rgba(245,158,11,0.04)" }}>
              <div className="flex items-start gap-4 mb-4">
                <InitialsAvatar firstName={editFirst || firstName} lastName={editLast || lastName} />
                <div className="flex-1 min-w-0 pt-1">
                  <p className="font-display font-bold text-[19px] text-stone-900 leading-tight truncate">{displayName}</p>
                  {email && <p className="text-[12.5px] text-stone-500 mt-0.5 truncate">{email}</p>}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span
                      className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                      style={isAdmin
                        ? { background: "rgba(245,158,11,0.12)", color: "#D97706", border: "1px solid rgba(245,158,11,0.2)" }
                        : { background: "rgba(0,0,0,0.05)", color: "#78716c", border: "1px solid rgba(0,0,0,0.08)" }
                      }
                    >
                      {isAdmin ? "Admin" : "Uživatel"}
                    </span>
                    {editDept && departments.find((d) => d.name === editDept) && (
                      <span
                        className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                        style={{ background: "rgba(245,158,11,0.08)", color: "#92400e", border: "1px solid rgba(245,158,11,0.15)" }}
                      >
                        {departments.find((d) => d.name === editDept)?.label}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2">
                    <span className="text-[11px] text-stone-400">
                      Člen od <span className="text-stone-500 font-medium">{formatDate(createdAt)}</span>
                    </span>
                    <span className="text-[11px] text-stone-400">
                      Naposledy <span className="text-stone-500 font-medium">{formatDate(lastLoginAt)}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats 2×2 */}
              <div className="grid grid-cols-2 gap-2">
                <StatTile icon="restaurant_menu" value={totalOrders} label="objednávek celkem" />
                <StatTile icon="calendar_today" value={thisMonthOrders} label="tento měsíc" />
                <StatTile icon="payments" value={monthlySpending > 0 ? `${monthlySpending} Kč` : "—"} label="výdaje / měsíc" />
                <StatTile icon="star" value={favoriteDish ?? "—"} label="oblíbené" />
              </div>
            </div>

            {/* Akce */}
            <div className="px-4 pb-4 flex flex-col gap-1.5 border-t border-white/40 pt-3">
              {showSettingsLink && (
                <a
                  href="/nastaveni"
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12.5px] font-semibold text-stone-600 glass-btn hover:text-stone-800 transition"
                >
                  <MIcon name="settings" size={15} />
                  Nastavení aplikace
                </a>
              )}
              <button
                onClick={() => { setLoggingOut(true); signOut({ callbackUrl: "/login" }); }}
                disabled={loggingOut}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12.5px] font-semibold text-stone-500 glass-btn hover:text-stone-700 transition disabled:opacity-50"
              >
                <MIcon name="logout" size={15} />
                {loggingOut ? "Odhlašuji…" : "Odhlásit se"}
              </button>
            </div>
          </div>

          {/* ── Banner: neověřený e-mail ── */}
          {!emailVerified && email && (
            <div
              className="flex items-start gap-3 px-4 py-3 rounded-2xl text-[12.5px] text-stone-700"
              style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.18)" }}
            >
              <MIcon name="mail" size={18} style={{ color: "#D97706", marginTop: 1, flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-stone-800 mb-0.5">E-mail není ověřen</p>
                <p className="text-stone-500 text-[12px]">Ověřením si zajistíš možnost resetovat heslo.</p>
                {verifyMsg && <p className="mt-1 text-[11.5px] text-amber-700 font-medium">{verifyMsg}</p>}
              </div>
              <button
                onClick={handleResendVerify}
                disabled={verifyLoading}
                className="shrink-0 px-3 py-1.5 rounded-xl text-[11.5px] font-semibold text-white transition disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#F59E0B,#EA580C)" }}
              >
                {verifyLoading ? "…" : "Odeslat znovu"}
              </button>
            </div>
          )}

          {/* ── Nastavení účtu ── */}
          <SectionCard title="Nastavení účtu" icon="edit" accent>
            <form onSubmit={handleSaveProfile} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <FieldLabel>Jméno</FieldLabel>
                  <TextInput value={editFirst} onChange={setEditFirst} />
                </div>
                <div className="flex flex-col gap-1">
                  <FieldLabel>Příjmení</FieldLabel>
                  <TextInput value={editLast} onChange={setEditLast} />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <FieldLabel>E-mail</FieldLabel>
                <div className="relative">
                  <TextInput value={email ?? ""} disabled />
                  {hasPassword && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-stone-400">
                      změnit níže
                    </span>
                  )}
                </div>
              </div>

              {departments.length > 0 && (
                <div className="flex flex-col gap-1">
                  <FieldLabel>Výchozí oddělení</FieldLabel>
                  <p className="text-[11px] text-stone-400 -mt-0.5">Vaše oddělení bude označeno hvězdičkou v objednávce</p>
                  <select
                    value={editDept}
                    onChange={(e) => setEditDept(e.target.value)}
                    className="w-full rounded-xl px-3 py-2.5 text-[13px] bg-white/60 border border-white/70 text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                  >
                    <option value="">— žádné —</option>
                    {departments.map((d) => (
                      <option key={d.name} value={d.name}>{d.label}</option>
                    ))}
                  </select>
                </div>
              )}

              <StatusMsg msg={profileMsg} />
              <OrangeButton disabled={profileSaving}>{profileSaving ? "Ukládám…" : "Uložit změny"}</OrangeButton>
            </form>
          </SectionCard>

          {/* ── Přihlašovací metody ── */}
          <SectionCard title="Přihlašovací metody" icon="lock">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {hasCredentials && (
                  <div
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-[12.5px] font-semibold text-stone-700"
                    style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)" }}
                  >
                    <MIcon name="lock" size={13} style={{ color: "#78716c" }} />
                    Email a heslo
                  </div>
                )}
                {hasGoogle && (
                  <div
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-[12.5px] font-semibold text-stone-700"
                    style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)" }}
                  >
                    <GoogleIcon size={14} />
                    Google
                  </div>
                )}
              </div>
              {hasCredentials && !hasGoogle && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-[11.5px] text-stone-500">Propojením s Google se budete moci přihlásit oběma způsoby.</p>
                  <button
                    type="button"
                    onClick={() => signIn("google", { callbackUrl: "/profil" })}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12.5px] font-semibold text-stone-600 glass-btn hover:text-stone-800 transition self-start"
                  >
                    <GoogleIcon size={15} />
                    Propojit Google účet
                  </button>
                </div>
              )}
              {!hasCredentials && !hasGoogle && (
                <p className="text-[12px] text-stone-400">Žádná přihlašovací metoda není propojena.</p>
              )}
              <div className="pt-2 border-t border-white/40 flex flex-col gap-1.5">
                <p className="text-[11.5px] text-stone-500">Odhlásí všechna ostatní zařízení a prohlížeče kde jste přihlášeni.</p>
                <button
                  type="button"
                  onClick={handleRevokeAllSessions}
                  disabled={revokeLoading}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12.5px] font-semibold text-stone-600 glass-btn hover:text-stone-800 transition disabled:opacity-50 self-start"
                >
                  <MIcon name="logout" size={15} />
                  {revokeLoading ? "Odhlašuji…" : "Odhlásit ze všech zařízení"}
                </button>
                <StatusMsg msg={revokeMsg} />
              </div>
            </div>
          </SectionCard>

          {/* ── Změna e-mailu (jen Credentials uživatelé) ── */}
          {hasPassword && (
            <SectionCard title="Změna e-mailu" icon="mail">
              <form onSubmit={handleChangeEmail} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <FieldLabel>Nový e-mail</FieldLabel>
                  <TextInput type="email" value={newEmail} onChange={setNewEmail} placeholder={email ?? ""} />
                </div>
                <PasswordInput id="emailPwd" label="Potvrdit heslem" value={emailPwd} onChange={setEmailPwd} placeholder="Vaše současné heslo" />
                <StatusMsg msg={emailMsg} />
                <OrangeButton disabled={emailSaving || !newEmail || !emailPwd}>
                  {emailSaving ? "Měním…" : "Změnit e-mail"}
                </OrangeButton>
              </form>
            </SectionCard>
          )}

          {/* ── Změna hesla ── */}
          {hasPassword && (
            <SectionCard title="Změna hesla" icon="lock">
              <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
                <PasswordInput id="oldPwd" label="Stávající heslo" value={oldPwd} onChange={setOldPwd} placeholder="Vaše současné heslo" />
                <PasswordInput id="newPwd" label="Nové heslo" value={newPwd} onChange={setNewPwd} placeholder="Alespoň 6 znaků" />
                <PasswordInput id="confirmPwd" label="Nové heslo znovu" value={confirmPwd} onChange={setConfirmPwd} placeholder="Zopakujte nové heslo" />
                <StatusMsg msg={pwdMsg} />
                <OrangeButton disabled={pwdSaving || !oldPwd || !newPwd || !confirmPwd}>
                  {pwdSaving ? "Měním…" : "Změnit heslo"}
                </OrangeButton>
              </form>
            </SectionCard>
          )}

          {/* Google uživatel bez hesla */}
          {!hasPassword && (
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-2xl text-[12px] text-stone-500"
              style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.07)" }}
            >
              <MIcon name="info" size={16} style={{ color: "#94a3b8", flexShrink: 0 }} />
              Přihlašuješ se přes Google — e-mail a heslo spravuješ v účtu Google.
            </div>
          )}

          {/* ── Notifikace ── */}
          <SectionCard title="Notifikace" icon="notifications">
            <div className="flex flex-col gap-3">
              <Toggle
                checked={emailConfLocal}
                onChange={handleEmailConfToggle}
                label="E-mail při odeslání objednávky"
                description="Potvrzení e-mailem co jste si objednali"
              />
              {pushSupported && (
                <Toggle
                  checked={pushGranted}
                  onChange={handlePushToggle}
                  label="Push notifikace"
                  description={pushGranted ? "Notifikace povoleny v tomto prohlížeči" : "Povolte pro připomenutí objednávky"}
                />
              )}
              {telegramConfigured && (
                <div className="flex items-start gap-2 pt-2 border-t border-white/40">
                  <MIcon name="send" size={16} style={{ color: "#D97706", marginTop: 1, flexShrink: 0 }} />
                  <div>
                    <div className="text-[13px] font-semibold text-stone-800">Telegram bot</div>
                    <div className="text-[11.5px] text-stone-500 mt-0.5">
                      {telegramBotUrl
                        ? (
                          <><a href={telegramBotUrl} target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:underline">Přidat bota</a> a odeslat /start</>
                        )
                        : "Bot je aktivní — zeptejte se správce na odkaz"}
                    </div>
                  </div>
                </div>
              )}
              <StatusMsg msg={notifMsg} />
            </div>
          </SectionCard>

          {/* ── Moje objednávky ── */}
          <SectionCard title="Moje objednávky" icon="history">
            {orders === null ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <MIcon name="restaurant_menu" size={32} style={{ color: "#d6d3d1" }} />
                <p className="text-[12.5px] text-stone-400 text-center">
                  {totalOrders > 0
                    ? `Celkem ${totalOrders} objednávek. Kliknutím načtěte historii.`
                    : "Zatím žádné objednávky."}
                </p>
                {totalOrders > 0 && (
                  <button
                    type="button"
                    onClick={handleLoadOrders}
                    disabled={ordersLoading}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12.5px] font-semibold text-stone-600 glass-btn disabled:opacity-50"
                  >
                    <MIcon name="history" size={15} />
                    {ordersLoading ? "Načítám…" : "Načíst historii"}
                  </button>
                )}
              </div>
            ) : orders.length === 0 ? (
              <p className="text-[12.5px] text-stone-400 text-center py-3">Žádné objednávky nenalezeny.</p>
            ) : (
              <div className="flex flex-col gap-1">
                <p className="text-[11.5px] text-stone-400 mb-1">{orders.length} posledních objednávek</p>
                {orders.map((o) => (
                  <div key={o.date} className="flex items-center justify-between gap-3 py-2 border-b border-white/40 last:border-0">
                    <span className="text-[12.5px] font-semibold text-stone-700">{formatDate(o.date)}</span>
                    <span className="text-[12px] text-stone-500 truncate max-w-[55%] text-right">{o.mainDish ?? "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* ── Historie útrat ── */}
          {monthlyHistory.some((m) => m.spending > 0) && (
            <SectionCard title="Historie útrat" icon="payments">
              <div className="flex flex-col gap-2.5">
                {monthlyHistory.map((m) => (
                  <div key={m.month} className="flex items-center gap-3">
                    <div className="text-[11.5px] text-stone-500 w-24 shrink-0 text-right leading-tight">{m.month}</div>
                    <div className="flex-1 h-5 rounded-lg overflow-hidden" style={{ background: "rgba(0,0,0,0.05)" }}>
                      <div
                        className="h-full rounded-lg"
                        style={{
                          width: m.spending > 0 ? `${Math.max((m.spending / maxSpending) * 100, 4)}%` : "0%",
                          background: "linear-gradient(90deg,#F59E0B,#EA580C)",
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>
                    <div className="text-[12px] font-semibold text-stone-700 w-14 shrink-0 text-right">
                      {m.spending > 0 ? `${m.spending} Kč` : "—"}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* ── QR kód profilu ── */}
          <SectionCard title="QR kód profilu" icon="qr_code">
            <div className="flex flex-col items-center gap-3 py-1">
              <p className="text-[12px] text-stone-500 text-center">
                Použijte QR kód pro rychlou identifikaci při výdeji jídla.
              </p>
              {!showQr ? (
                <OrangeButton type="button" onClick={() => setShowQr(true)}>
                  Zobrazit QR kód
                </OrangeButton>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <img
                    src="/api/profil/qr"
                    alt="QR kód profilu"
                    width={180}
                    height={180}
                    className="rounded-2xl"
                    style={{ imageRendering: "pixelated" }}
                  />
                  <p className="text-[12px] text-stone-500 font-semibold">
                    {`${firstName} ${lastName}`.trim()}
                  </p>
                </div>
              )}
            </div>
          </SectionCard>

          {/* ── Smazat účet ── */}
          <div className="glass-card rounded-3xl overflow-hidden">
            <div
              className="flex items-center gap-2 px-5 py-3.5 border-b border-white/40 cursor-pointer select-none"
              style={{ background: deleteOpen ? "rgba(239,68,68,0.04)" : undefined }}
              onClick={() => { setDeleteOpen((v) => !v); setDeleteMsg(null); setDeletePwd(""); }}
            >
              <MIcon name="delete_forever" size={16} style={{ color: "#ef4444" }} />
              <span className="font-display font-bold text-[13.5px] text-red-600 flex-1">Smazat účet</span>
              <MIcon name={deleteOpen ? "expand_less" : "expand_more"} size={16} style={{ color: "#ef4444" }} />
            </div>
            {deleteOpen && (
              <div className="p-4 md:p-5 flex flex-col gap-3">
                <p className="text-[12.5px] text-stone-600 leading-relaxed">
                  Tato akce je <strong>nevratná</strong>. Váš účet bude deaktivován a osobní údaje smazány. Objednávky v historii zůstanou anonymizované.
                </p>
                <form onSubmit={handleDeleteAccount} className="flex flex-col gap-3">
                  {hasPassword && (
                    <PasswordInput
                      id="deletePwd"
                      label="Potvrdit heslem"
                      value={deletePwd}
                      onChange={setDeletePwd}
                      placeholder="Vaše současné heslo"
                    />
                  )}
                  <StatusMsg msg={deleteMsg} />
                  <button
                    type="submit"
                    disabled={deleteLoading || (hasPassword && !deletePwd)}
                    className="self-start px-4 py-2 rounded-xl text-[12.5px] font-semibold text-white transition disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg,#ef4444,#dc2626)" }}
                  >
                    {deleteLoading ? "Mažu účet…" : "Trvale smazat účet"}
                  </button>
                </form>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
