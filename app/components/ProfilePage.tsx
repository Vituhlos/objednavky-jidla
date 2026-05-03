"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@/lib/auth";
import type { DepartmentInfo } from "@/lib/departments";
import { actionUpdateProfile, actionChangePassword, actionChangeEmail, actionGetMyHistory } from "@/app/actions";
import MIcon from "./MIcon";

type HistoryRow = {
  date: string;
  department: string;
  soupName: string | null;
  mainName: string | null;
  rollCount: number;
  breadDumplingCount: number;
  potatoDumplingCount: number;
  mealCount: number;
  type: "lunch" | "pizza";
  pizzaName: string | null;
  pizzaCount: number;
};

type Stats = {
  totalOrders: number;
  thisMonthOrders: number;
  favoriteDish: string | null;
};

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" });
}

function formatMonthYear(iso: string) {
  const [y, m] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, 1);
  return date.toLocaleDateString("cs-CZ", { month: "long", year: "numeric" });
}

function Avatar({ firstName, lastName, size = 64 }: { firstName: string; lastName: string; size?: number }) {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  const fontSize = Math.round(size * 0.35);
  return (
    <div
      className="rounded-2xl flex items-center justify-center font-display font-bold text-white shrink-0"
      style={{
        width: size, height: size,
        background: "linear-gradient(135deg,#F59E0B,#EA580C)",
        boxShadow: "0 8px 24px -8px rgba(245,158,11,0.5)",
        fontSize,
      }}
    >
      {initials}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="glass-soft rounded-2xl p-3.5 flex flex-col gap-1">
      <MIcon name={icon as "history"} size={16} fill style={{ color: "#D97706" }} />
      <div className="font-display font-bold text-[20px] text-stone-900 leading-none">{value}</div>
      <div className="text-[11px] text-stone-500">{label}</div>
    </div>
  );
}

export default function ProfilePage({
  user,
  departments,
  stats,
}: {
  user: User;
  departments: DepartmentInfo[];
  stats: Stats;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  };

  // Profile form
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [defaultDepartment, setDefaultDepartment] = useState(user.defaultDepartment ?? "");
  const [emailOrderConfirmation, setEmailOrderConfirmation] = useState(user.emailOrderConfirmation);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Email change form
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const handleChangeEmail = (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setEmailSaved(false);
    startTransition(async () => {
      try {
        await actionChangeEmail(newEmail, emailPassword);
        setEmailSaved(true);
        setNewEmail("");
        setEmailPassword("");
        setTimeout(() => setEmailSaved(false), 3000);
        router.refresh();
      } catch (err) {
        setEmailError(err instanceof Error ? err.message : "Chyba při změně e-mailu.");
      }
    });
  };

  // Password form
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showNewPasswordConfirm, setShowNewPasswordConfirm] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const passwordMismatch = newPasswordConfirm.length > 0 && newPassword !== newPasswordConfirm;

  // History
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSaved(false);
    startTransition(async () => {
      try {
        await actionUpdateProfile({
          firstName,
          lastName,
          defaultDepartment: defaultDepartment || null,
          emailOrderConfirmation,
        });
        setProfileSaved(true);
        setTimeout(() => setProfileSaved(false), 3000);
      } catch (err) {
        setProfileError(err instanceof Error ? err.message : "Chyba při ukládání.");
      }
    });
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== newPasswordConfirm) { setPasswordError("Hesla se neshodují."); return; }
    setPasswordError(null);
    setPasswordSaved(false);
    startTransition(async () => {
      try {
        await actionChangePassword(oldPassword, newPassword);
        setPasswordSaved(true);
        setOldPassword("");
        setNewPassword("");
        setNewPasswordConfirm("");
        setTimeout(() => setPasswordSaved(false), 3000);
      } catch (err) {
        setPasswordError(err instanceof Error ? err.message : "Chyba při změně hesla.");
      }
    });
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const rows = await actionGetMyHistory();
      setHistory(rows);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Group history by month
  const groupedHistory = history
    ? history.reduce<Record<string, HistoryRow[]>>((acc, row) => {
        const month = row.date.slice(0, 7);
        (acc[month] = acc[month] ?? []).push(row);
        return acc;
      }, {})
    : null;

  const memberSince = (() => {
    // We don't have createdAt in User interface — show a dash
    return null;
  })();

  return (
    <div className="k-shell">
      {/* Desktop topbar */}
      <div className="hidden md:flex px-5 py-2.5 border-b border-white/50 items-center gap-3 topbar shrink-0">
        <MIcon name="account_circle" size={16} fill style={{ color: "#D97706" }} />
        <span className="font-display font-bold text-[15px] text-stone-900">Můj profil</span>
        <span className="text-[12px] text-stone-500">{user.email}</span>
      </div>

      {/* Mobile topbar */}
      <div className="md:hidden border-b border-white/50 topbar shrink-0 px-4 py-2.5">
        <span className="font-display font-bold text-[14px] text-stone-900">Můj profil</span>
      </div>

      <main className="flex-1 overflow-y-auto scroll-area p-4 md:p-5 space-y-4 pb-28 md:pb-8">

        {/* Hero card */}
        <div className="glass rounded-3xl overflow-hidden">
          <div className="p-5 flex items-center gap-4">
            <Avatar firstName={user.firstName} lastName={user.lastName} size={64} />
            <div className="flex-1 min-w-0">
              <div className="font-display font-bold text-[20px] text-stone-900 leading-tight">
                {user.firstName} {user.lastName}
              </div>
              <div className="text-[13px] text-stone-500 mt-0.5">{user.email}</div>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {user.role === "admin" && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(245,158,11,0.15)", color: "#D97706" }}>
                    Admin
                  </span>
                )}
                {user.defaultDepartment && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(79,138,83,0.12)", color: "#4F8A53" }}>
                    {user.defaultDepartment}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl text-[12px] font-semibold text-stone-500 glass-btn transition hover:text-stone-700 disabled:opacity-50"
              title="Odhlásit se"
            >
              <MIcon name="logout" size={15} />
              <span className="hidden sm:inline">{loggingOut ? "Odhlašuji…" : "Odhlásit"}</span>
            </button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 p-4 pt-0">
            <StatCard icon="restaurant" label="Celkem obědů" value={String(stats.totalOrders)} />
            <StatCard icon="calendar_today" label="Tento měsíc" value={String(stats.thisMonthOrders)} />
            <StatCard icon="star" label="Oblíbené" value={stats.favoriteDish ? stats.favoriteDish.split(" ").slice(0, 2).join(" ") : "—"} />
          </div>
        </div>

        {/* Account settings */}
        <div className="glass rounded-3xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/40" style={{ background: "rgba(245,158,11,0.07)" }}>
            <MIcon name="manage_accounts" size={17} fill style={{ color: "#D97706" }} />
            <span className="font-display font-bold text-[13.5px] text-stone-900">Nastavení účtu</span>
          </div>
          <form onSubmit={handleSaveProfile} className="p-4 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[11.5px] font-semibold text-stone-600">Jméno</span>
                <input
                  className="modal-input"
                  required
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[11.5px] font-semibold text-stone-600">Příjmení</span>
                <input
                  className="modal-input"
                  required
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[11.5px] font-semibold text-stone-600">E-mail</span>
              <div className="modal-input text-stone-400 select-none flex items-center justify-between gap-2">
                <span>{user.email}</span>
                <span className="text-[10.5px] text-stone-300 shrink-0">změnit níže</span>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[11.5px] font-semibold text-stone-600">Výchozí oddělení</span>
              <span className="text-[10.5px] text-stone-400 -mt-0.5">Vaše oddělení bude označeno hvězdičkou v objednávce</span>
              <select
                className="k-select"
                value={defaultDepartment}
                onChange={(e) => setDefaultDepartment(e.target.value)}
              >
                <option value="">— Nevybráno —</option>
                {departments.filter((d) => d.active).map((d) => (
                  <option key={d.id} value={d.name}>{d.label}</option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-3 cursor-pointer group">
              <div
                onClick={() => setEmailOrderConfirmation((v) => !v)}
                className={`relative w-10 h-5.5 rounded-full transition-colors flex-shrink-0 ${emailOrderConfirmation ? "bg-amber-500" : "bg-stone-300"}`}
                style={{ width: 40, height: 22 }}
                role="switch"
                aria-checked={emailOrderConfirmation}
              >
                <span
                  className="absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-transform"
                  style={{ width: 18, height: 18, transform: emailOrderConfirmation ? "translateX(18px)" : "translateX(0)" }}
                />
              </div>
              <div>
                <div className="text-[12.5px] font-semibold text-stone-700">E-mail při odeslání objednávky</div>
                <div className="text-[10.5px] text-stone-400">Dostanete potvrzení e-mailem, co jste si objednali</div>
              </div>
            </label>

            {profileError && (
              <p className="text-[12px] text-red-500">{profileError}</p>
            )}

            <div className="flex items-center gap-2">
              <button
                className="modal-btn modal-btn--primary"
                disabled={isPending}
                type="submit"
              >
                {isPending ? "Ukládám…" : "Uložit změny"}
              </button>
              {profileSaved && (
                <span className="text-[12px] text-green-700 inline-flex items-center gap-1">
                  <MIcon name="check_circle" size={13} fill /> Uloženo
                </span>
              )}
            </div>
          </form>
        </div>

        {/* Email change */}
        <div className="glass rounded-3xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/40" style={{ background: "rgba(245,158,11,0.07)" }}>
            <MIcon name="mail" size={17} fill style={{ color: "#D97706" }} />
            <span className="font-display font-bold text-[13.5px] text-stone-900">Změna e-mailu</span>
          </div>
          <form onSubmit={handleChangeEmail} className="p-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-[11.5px] font-semibold text-stone-600">Nový e-mail</span>
              <input
                className="modal-input"
                required
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                autoComplete="email"
                placeholder={user.email}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11.5px] font-semibold text-stone-600">Potvrdit heslem</span>
              <div className="relative">
                <input
                  className="modal-input w-full pr-9"
                  required
                  type={showEmailPassword ? "text" : "password"}
                  value={emailPassword}
                  onChange={(e) => setEmailPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Vaše současné heslo"
                />
                <button type="button" tabIndex={-1} onClick={() => setShowEmailPassword((s) => !s)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600" aria-label={showEmailPassword ? "Skrýt heslo" : "Zobrazit heslo"}>
                  <MIcon name={showEmailPassword ? "visibility_off" : "visibility"} size={16} />
                </button>
              </div>
            </div>

            {emailError && (
              <p className="text-[12px] text-red-500">{emailError}</p>
            )}

            <div className="flex items-center gap-2">
              <button
                className="modal-btn modal-btn--primary"
                disabled={isPending}
                type="submit"
              >
                {isPending ? "Ukládám…" : "Změnit e-mail"}
              </button>
              {emailSaved && (
                <span className="text-[12px] text-green-700 inline-flex items-center gap-1">
                  <MIcon name="check_circle" size={13} fill /> E-mail změněn
                </span>
              )}
            </div>
          </form>
        </div>

        {/* Password change */}
        <div className="glass rounded-3xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/40" style={{ background: "rgba(245,158,11,0.07)" }}>
            <MIcon name="lock" size={17} fill style={{ color: "#D97706" }} />
            <span className="font-display font-bold text-[13.5px] text-stone-900">Změna hesla</span>
          </div>
          <form onSubmit={handleChangePassword} className="p-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-[11.5px] font-semibold text-stone-600">Stávající heslo</span>
              <div className="relative">
                <input
                  className="modal-input w-full pr-9"
                  required
                  type={showOldPassword ? "text" : "password"}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Vaše současné heslo"
                />
                <button type="button" tabIndex={-1} onClick={() => setShowOldPassword((s) => !s)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600" aria-label={showOldPassword ? "Skrýt heslo" : "Zobrazit heslo"}>
                  <MIcon name={showOldPassword ? "visibility_off" : "visibility"} size={16} />
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11.5px] font-semibold text-stone-600">Nové heslo</span>
              <div className="relative">
                <input
                  className="modal-input w-full pr-9"
                  required
                  minLength={6}
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Alespoň 6 znaků"
                />
                <button type="button" tabIndex={-1} onClick={() => setShowNewPassword((s) => !s)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600" aria-label={showNewPassword ? "Skrýt heslo" : "Zobrazit heslo"}>
                  <MIcon name={showNewPassword ? "visibility_off" : "visibility"} size={16} />
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11.5px] font-semibold text-stone-600">Nové heslo znovu</span>
              <div className="relative">
                <input
                  className={`modal-input w-full pr-9${passwordMismatch ? " border-red-400" : ""}`}
                  required
                  type={showNewPasswordConfirm ? "text" : "password"}
                  value={newPasswordConfirm}
                  onChange={(e) => setNewPasswordConfirm(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Zopakujte nové heslo"
                />
                <button type="button" tabIndex={-1} onClick={() => setShowNewPasswordConfirm((s) => !s)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600" aria-label={showNewPasswordConfirm ? "Skrýt heslo" : "Zobrazit heslo"}>
                  <MIcon name={showNewPasswordConfirm ? "visibility_off" : "visibility"} size={16} />
                </button>
              </div>
              {passwordMismatch && <p className="text-[11px] text-red-500">Hesla se neshodují.</p>}
            </div>

            {passwordError && (
              <p className="text-[12px] text-red-500">{passwordError}</p>
            )}

            <div className="flex items-center gap-2">
              <button
                className="modal-btn modal-btn--primary"
                disabled={isPending || passwordMismatch}
                type="submit"
              >
                {isPending ? "Ukládám…" : "Změnit heslo"}
              </button>
              {passwordSaved && (
                <span className="text-[12px] text-green-700 inline-flex items-center gap-1">
                  <MIcon name="check_circle" size={13} fill /> Heslo změněno
                </span>
              )}
            </div>
          </form>
        </div>

        {/* Order history */}
        <div className="glass rounded-3xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/40" style={{ background: "rgba(245,158,11,0.07)" }}>
            <MIcon name="history" size={17} fill style={{ color: "#D97706" }} />
            <span className="font-display font-bold text-[13.5px] text-stone-900">Moje objednávky</span>
            {stats.totalOrders > 0 && (
              <span className="ml-auto text-[11px] text-stone-400">{stats.totalOrders} celkem</span>
            )}
          </div>
          <div className="p-4 flex flex-col gap-3">
            {history === null ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <MIcon name="restaurant_menu" size={32} style={{ color: "#e7d9c8" }} />
                <p className="text-[12.5px] text-stone-400 text-center">
                  {stats.totalOrders === 0
                    ? "Zatím nemáte žádné objednávky."
                    : `Celkem ${stats.totalOrders} objednávek. Kliknutím načtěte historii.`}
                </p>
                {stats.totalOrders > 0 && (
                  <button
                    className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-2xl glass-btn text-stone-600"
                    disabled={historyLoading}
                    onClick={loadHistory}
                    type="button"
                  >
                    <MIcon name="history" size={14} />
                    {historyLoading ? "Načítám…" : "Načíst historii"}
                  </button>
                )}
              </div>
            ) : history.length === 0 ? (
              <p className="text-[12.5px] text-stone-400 text-center py-2">Žádné záznamy.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {Object.entries(groupedHistory!).map(([month, rows]) => (
                  <div key={month}>
                    <div className="text-[10.5px] font-semibold text-stone-400 uppercase tracking-wider mb-2 px-1">
                      {formatMonthYear(month + "-01")}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {rows.map((row, i) => (
                        <div key={i} className="glass-soft rounded-2xl px-3 py-2.5 flex items-start gap-3">
                          <div className="shrink-0 mt-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ background: row.type === "pizza" ? "#EA580C" : "#F59E0B" }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[11.5px] font-semibold text-stone-700 leading-none">
                              {formatDate(row.date)}
                              <span className="ml-2 font-normal text-stone-400">· {row.department}</span>
                            </div>
                            <div className="text-[11.5px] text-stone-500 mt-1 leading-snug">
                              {row.type === "pizza" ? (
                                <span>{row.pizzaCount > 1 ? `${row.pizzaCount}× ` : ""}{row.pizzaName ?? "Pizza"}</span>
                              ) : (
                                <>
                                  {row.soupName && <span>🍲 {row.soupName}</span>}
                                  {row.soupName && row.mainName && <span className="mx-1.5 text-stone-300">·</span>}
                                  {row.mainName && <span>{row.mealCount > 1 ? `${row.mealCount}× ` : ""}{row.mainName}</span>}
                                  {row.rollCount > 0 && <span className="ml-1.5 text-stone-400">{row.rollCount}× rohlík</span>}
                                  {row.breadDumplingCount > 0 && <span className="ml-1.5 text-stone-400">{row.breadDumplingCount}× houska kned.</span>}
                                  {row.potatoDumplingCount > 0 && <span className="ml-1.5 text-stone-400">{row.potatoDumplingCount}× bram. kned.</span>}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <button
                  className="self-center inline-flex items-center gap-1.5 text-[11px] font-semibold text-stone-400 hover:text-stone-600 transition"
                  onClick={loadHistory}
                  type="button"
                >
                  <MIcon name="refresh" size={12} /> Obnovit
                </button>
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
