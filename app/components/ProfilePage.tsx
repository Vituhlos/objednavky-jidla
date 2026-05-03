"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@/lib/auth";
import type { DepartmentInfo } from "@/lib/departments";
import { actionUpdateProfile, actionChangePassword, actionGetMyHistory } from "@/app/actions";
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
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Password form
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
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
              <div className="modal-input text-stone-400 select-none">{user.email}</div>
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

        {/* Password change */}
        <div className="glass rounded-3xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/40" style={{ background: "rgba(245,158,11,0.07)" }}>
            <MIcon name="lock" size={17} fill style={{ color: "#D97706" }} />
            <span className="font-display font-bold text-[13.5px] text-stone-900">Změna hesla</span>
          </div>
          <form onSubmit={handleChangePassword} className="p-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-[11.5px] font-semibold text-stone-600">Stávající heslo</span>
              <input
                className="modal-input"
                required
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Vaše současné heslo"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11.5px] font-semibold text-stone-600">Nové heslo</span>
              <input
                className="modal-input"
                required
                minLength={6}
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="Alespoň 6 znaků"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11.5px] font-semibold text-stone-600">Nové heslo znovu</span>
              <input
                className={`modal-input${passwordMismatch ? " border-red-400" : ""}`}
                required
                type="password"
                value={newPasswordConfirm}
                onChange={(e) => setNewPasswordConfirm(e.target.value)}
                autoComplete="new-password"
                placeholder="Zopakujte nové heslo"
              />
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
                          <div className="shrink-0 mt-0.5">
                            <div className="w-2 h-2 rounded-full mt-1" style={{ background: "#F59E0B" }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[11.5px] font-semibold text-stone-700 leading-none">
                              {formatDate(row.date)}
                              <span className="ml-2 font-normal text-stone-400">· {row.department}</span>
                            </div>
                            <div className="text-[11.5px] text-stone-500 mt-1 leading-snug">
                              {row.soupName && <span>🍲 {row.soupName}</span>}
                              {row.soupName && row.mainName && <span className="mx-1.5 text-stone-300">·</span>}
                              {row.mainName && <span>{row.mealCount > 1 ? `${row.mealCount}× ` : ""}{row.mainName}</span>}
                              {row.rollCount > 0 && <span className="ml-1.5 text-stone-400">{row.rollCount}× rohlík</span>}
                              {row.breadDumplingCount > 0 && <span className="ml-1.5 text-stone-400">{row.breadDumplingCount}× houska kned.</span>}
                              {row.potatoDumplingCount > 0 && <span className="ml-1.5 text-stone-400">{row.potatoDumplingCount}× bram. kned.</span>}
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
