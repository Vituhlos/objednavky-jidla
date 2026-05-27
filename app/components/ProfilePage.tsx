"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import MIcon from "./MIcon";
import { actionUpdateProfile, actionChangePassword, actionResendVerifyEmail } from "@/app/actions";

type Dept = { name: string; label: string };

function InitialsAvatar({ firstName, lastName, size = "lg" }: { firstName: string; lastName: string; size?: "sm" | "lg" }) {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "?";
  const dim = size === "lg" ? "w-20 h-20 text-[28px]" : "w-10 h-10 text-[14px]";
  return (
    <div
      className={`${dim} rounded-2xl flex items-center justify-center shrink-0 font-display font-bold text-white`}
      style={{ background: "linear-gradient(135deg,#F59E0B,#EA580C)", boxShadow: "0 6px 20px -6px rgba(245,158,11,0.45)" }}
    >
      {initials}
    </div>
  );
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="glass-soft rounded-2xl p-3 flex-1 text-center">
      <div className="font-display font-bold text-[22px] text-stone-900">{value}</div>
      <div className="text-[11px] text-stone-500 leading-tight mt-0.5">{label}</div>
    </div>
  );
}

function ShowHideInput({
  id, label, value, onChange, placeholder,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[11.5px] font-semibold text-stone-600">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl px-3 py-2.5 text-[13px] bg-white/60 border border-white/70 text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400/40 pr-10"
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

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="glass-card rounded-3xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/40">
        <MIcon name={icon} size={16} style={{ color: "#D97706" }} />
        <span className="font-display font-bold text-[13.5px] text-stone-800">{title}</span>
      </div>
      <div className="p-4 flex flex-col gap-3">{children}</div>
    </div>
  );
}

export default function ProfilePage({
  firstName,
  lastName,
  email,
  role,
  emailVerified,
  hasPassword,
  defaultDepartment,
  departments,
  totalOrders,
  thisMonthOrders,
  showSettingsLink,
}: {
  firstName: string;
  lastName: string;
  email: string | null;
  role: string;
  emailVerified: boolean;
  hasPassword: boolean;
  defaultDepartment: string | null;
  departments: Dept[];
  totalOrders: number;
  thisMonthOrders: number;
  showSettingsLink: boolean;
}) {
  const isAdmin = role === "admin";
  const [loggingOut, setLoggingOut] = useState(false);

  // Edit profile state
  const [editFirst, setEditFirst] = useState(firstName);
  const [editLast, setEditLast] = useState(lastName);
  const [editDept, setEditDept] = useState(defaultDepartment ?? "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Change password state
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Resend verify state
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      await actionUpdateProfile({ firstName: editFirst, lastName: editLast, defaultDepartment: editDept || null });
      setProfileMsg({ ok: true, text: "Profil uložen." });
    } catch (err) {
      setProfileMsg({ ok: false, text: err instanceof Error ? err.message : "Chyba při ukládání." });
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwdMsg(null);
    if (newPwd !== confirmPwd) { setPwdMsg({ ok: false, text: "Hesla se neshodují." }); return; }
    if (newPwd.length < 6) { setPwdMsg({ ok: false, text: "Nové heslo musí mít alespoň 6 znaků." }); return; }
    setPwdSaving(true);
    try {
      await actionChangePassword(oldPwd, newPwd);
      setPwdMsg({ ok: true, text: "Heslo změněno." });
      setOldPwd(""); setNewPwd(""); setConfirmPwd("");
    } catch (err) {
      setPwdMsg({ ok: false, text: err instanceof Error ? err.message : "Chyba při změně hesla." });
    } finally {
      setPwdSaving(false);
    }
  }

  async function handleResendVerify() {
    setVerifyLoading(true);
    setVerifyMsg(null);
    const res = await actionResendVerifyEmail();
    setVerifyMsg(res.ok ? "Ověřovací e-mail odeslán. Zkontroluj schránku." : (res.error ?? "Chyba."));
    setVerifyLoading(false);
  }

  return (
    <div className="k-shell">
      <div className="flex-1 overflow-y-auto scroll-area p-4 md:p-5 pb-nav">
        <div className="max-w-2xl mx-auto w-full flex flex-col gap-4">

          {/* ── Hero karta ── */}
          <div className="glass-card rounded-3xl overflow-hidden">
            <div className="flex flex-col items-center gap-4 p-6 pb-5" style={{ background: "rgba(245,158,11,0.04)" }}>
              <InitialsAvatar firstName={editFirst || firstName} lastName={editLast || lastName} size="lg" />
              <div className="text-center">
                <p className="font-display font-bold text-[20px] text-stone-900 leading-tight">{firstName} {lastName}</p>
                {email && <p className="text-[12.5px] text-stone-500 mt-0.5">{email}</p>}
                <span
                  className="inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold"
                  style={isAdmin
                    ? { background: "rgba(245,158,11,0.12)", color: "#D97706", border: "1px solid rgba(245,158,11,0.2)" }
                    : { background: "rgba(0,0,0,0.05)", color: "#78716c", border: "1px solid rgba(0,0,0,0.08)" }
                  }
                >
                  {isAdmin ? "Admin" : "Uživatel"}
                </span>
              </div>
              <div className="flex gap-2 w-full max-w-xs">
                <StatCard value={totalOrders} label="objednávek celkem" />
                <StatCard value={thisMonthOrders} label="tento měsíc" />
              </div>
            </div>

            <div className="px-4 pb-4 flex flex-col gap-2 border-t border-white/40 pt-3">
              {showSettingsLink && (
                <a
                  href="/nastaveni"
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12.5px] font-semibold text-stone-600 glass-btn transition hover:text-stone-800"
                >
                  <MIcon name="settings" size={15} />
                  Nastavení aplikace
                </a>
              )}
              <button
                onClick={() => { setLoggingOut(true); signOut({ callbackUrl: "/login" }); }}
                disabled={loggingOut}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12.5px] font-semibold text-stone-500 glass-btn transition hover:text-stone-700 disabled:opacity-50"
              >
                <MIcon name="logout" size={15} />
                {loggingOut ? "Odhlašuji…" : "Odhlásit se"}
              </button>
            </div>
          </div>

          {/* ── Banner: neověřený e-mail ── */}
          {!emailVerified && email && (
            <div
              className="flex items-start gap-3 px-4 py-3 rounded-2xl text-[12.5px] text-stone-700 leading-relaxed"
              style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.18)" }}
            >
              <MIcon name="mark_email_unread" size={18} style={{ color: "#D97706", marginTop: 1, flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-stone-800 mb-0.5">E-mail není ověřen</p>
                <p className="text-stone-500 text-[12px]">Ověřením e-mailové adresy si zajistíš možnost resetovat heslo.</p>
                {verifyMsg && <p className="mt-1.5 text-[11.5px] text-amber-700 font-medium">{verifyMsg}</p>}
              </div>
              <button
                onClick={handleResendVerify}
                disabled={verifyLoading}
                className="shrink-0 px-3 py-1.5 rounded-xl text-[11.5px] font-semibold text-white transition disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#F59E0B,#EA580C)" }}
              >
                {verifyLoading ? "Odesílám…" : "Odeslat znovu"}
              </button>
            </div>
          )}

          {/* ── Upravit profil ── */}
          <SectionCard title="Upravit profil" icon="edit">
            <form onSubmit={handleSaveProfile} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label htmlFor="firstName" className="text-[11.5px] font-semibold text-stone-600">Jméno</label>
                  <input
                    id="firstName"
                    type="text"
                    value={editFirst}
                    onChange={(e) => setEditFirst(e.target.value)}
                    required
                    className="rounded-xl px-3 py-2.5 text-[13px] bg-white/60 border border-white/70 text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="lastName" className="text-[11.5px] font-semibold text-stone-600">Příjmení</label>
                  <input
                    id="lastName"
                    type="text"
                    value={editLast}
                    onChange={(e) => setEditLast(e.target.value)}
                    required
                    className="rounded-xl px-3 py-2.5 text-[13px] bg-white/60 border border-white/70 text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                  />
                </div>
              </div>

              {departments.length > 0 && (
                <div className="flex flex-col gap-1">
                  <label htmlFor="dept" className="text-[11.5px] font-semibold text-stone-600">Výchozí oddělení</label>
                  <select
                    id="dept"
                    value={editDept}
                    onChange={(e) => setEditDept(e.target.value)}
                    className="rounded-xl px-3 py-2.5 text-[13px] bg-white/60 border border-white/70 text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                  >
                    <option value="">— žádné —</option>
                    {departments.map((d) => (
                      <option key={d.name} value={d.name}>{d.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {profileMsg && (
                <p className={`text-[12px] font-semibold ${profileMsg.ok ? "text-green-700" : "text-red-600"}`}>
                  {profileMsg.text}
                </p>
              )}

              <button
                type="submit"
                disabled={profileSaving}
                className="self-start px-4 py-2 rounded-xl text-[12.5px] font-semibold text-white transition disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#F59E0B,#EA580C)" }}
              >
                {profileSaving ? "Ukládám…" : "Uložit profil"}
              </button>
            </form>
          </SectionCard>

          {/* ── Změna hesla (jen pro Credentials uživatele) ── */}
          {hasPassword && (
            <SectionCard title="Změna hesla" icon="lock">
              <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
                <ShowHideInput id="oldPwd" label="Současné heslo" value={oldPwd} onChange={setOldPwd} />
                <ShowHideInput id="newPwd" label="Nové heslo" value={newPwd} onChange={setNewPwd} placeholder="min. 6 znaků" />
                <ShowHideInput id="confirmPwd" label="Potvrdit nové heslo" value={confirmPwd} onChange={setConfirmPwd} />

                {pwdMsg && (
                  <p className={`text-[12px] font-semibold ${pwdMsg.ok ? "text-green-700" : "text-red-600"}`}>
                    {pwdMsg.text}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={pwdSaving || !oldPwd || !newPwd || !confirmPwd}
                  className="self-start px-4 py-2 rounded-xl text-[12.5px] font-semibold text-white transition disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,#F59E0B,#EA580C)" }}
                >
                  {pwdSaving ? "Měním…" : "Změnit heslo"}
                </button>
              </form>
            </SectionCard>
          )}

          {/* Google-only uživatel — žádné heslo */}
          {!hasPassword && (
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-2xl text-[12px] text-stone-500"
              style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.07)" }}
            >
              <MIcon name="info" size={16} style={{ color: "#94a3b8", flexShrink: 0 }} />
              Přihlašuješ se přes Google — změna hesla není dostupná.
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
