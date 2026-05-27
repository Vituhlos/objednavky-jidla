"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { BuildInfo } from "@/lib/build-info";
import type { UserOrderStats } from "@/lib/orders";
import MIcon from "./MIcon";
import CopyBuildButton from "./CopyBuildButton";
import ThemeToggle from "./ThemeToggle";

function Avatar({ name, size = 64 }: { name: string; size?: number }) {
  const parts = name.trim().split(/\s+/);
  const initials = parts.length >= 2
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    : (name[0] ?? "?").toUpperCase();
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

function SectionHeader({ icon, title, right }: { icon: string; title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/40" style={{ background: "rgba(245,158,11,0.07)" }}>
      <MIcon name={icon as "person"} size={17} fill style={{ color: "#D97706" }} />
      <span className="font-display font-bold text-[13.5px] text-stone-900">{title}</span>
      {right && <span className="ml-auto">{right}</span>}
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-white/20 last:border-0">
      <span className="text-[11.5px] font-semibold text-stone-600">{label}</span>
      <span className={`text-[12.5px] font-semibold text-stone-800 text-right break-all ${mono ? "font-mono text-[11.5px]" : ""}`}>
        {value}
      </span>
    </div>
  );
}

export default function ProfilePage({
  email,
  name,
  role,
  build,
  showDeniedAdmin,
  showSettingsLink,
  stats,
}: {
  email: string | null | undefined;
  name: string | null | undefined;
  role: string;
  build: BuildInfo;
  showDeniedAdmin: boolean;
  showSettingsLink: boolean;
  stats?: UserOrderStats;
}) {
  const displayName = name || email || "Uživatel";
  const isAdmin = role === "admin";
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const { signOut } = await import("next-auth/react");
      await signOut({ callbackUrl: "/login" });
    } catch {
      setLoggingOut(false);
    }
  };

  return (
    <div className="k-shell">
      <h1 className="sr-only">Můj profil</h1>

      {/* Desktop topbar */}
      <div className="hidden md:flex px-5 py-2.5 border-b border-white/50 items-center gap-3 topbar shrink-0">
        <MIcon name="account_circle" size={16} fill style={{ color: "#D97706" }} />
        <span className="font-display font-bold text-[15px] text-stone-900">Můj profil</span>
        {email && <span className="text-[12px] text-stone-500">{email}</span>}
      </div>

      {/* Mobile topbar */}
      <div className="md:hidden border-b border-white/50 topbar shrink-0 px-4 py-2.5 flex items-center justify-between">
        <span className="font-display font-bold text-[14px] text-stone-900">Můj profil</span>
        {isAdmin && (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(245,158,11,0.15)", color: "#D97706" }}>
            Admin
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scroll-area p-4 md:p-6 pb-nav">
        <div className="max-w-2xl mx-auto space-y-4">

          {showDeniedAdmin && (
            <div
              className="px-3 py-2.5 rounded-2xl text-[12.5px] text-stone-600 leading-relaxed"
              style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.15)" }}
            >
              <strong>Nastavení je jen pro administrátory.</strong> Požádej admina o přidání tvého e-mailu do{" "}
              <code className="bg-black/5 px-1 rounded font-mono text-[11.5px]">ADMIN_EMAILS</code> nebo o změnu role v Nastavení → Uživatelé.
            </div>
          )}

          {/* Hero card */}
          <div className="glass rounded-3xl overflow-hidden">
            <div className="p-5 flex items-center gap-4">
              <Avatar name={displayName} size={64} />
              <div className="flex-1 min-w-0">
                <div className="font-display font-bold text-[20px] text-stone-900 leading-tight truncate">
                  {displayName}
                </div>
                {email && name && (
                  <div className="text-[13px] text-stone-500 mt-0.5 truncate">{email}</div>
                )}
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {isAdmin && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(245,158,11,0.15)", color: "#D97706" }}>
                      Admin
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
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 pt-0">
                <StatCard icon="calendar_today" label="Tento měsíc" value={String(stats.monthlyOrders)} />
                <StatCard icon="payments" label="Výdaje / měsíc" value={stats.monthlySpent > 0 ? `${stats.monthlySpent} Kč` : "—"} />
                <StatCard icon="restaurant" label="Celkem obědů" value={String(stats.totalOrders)} />
                <StatCard icon="star" label="Oblíbené" value={stats.favoriteMeals[0]?.name?.split(" ").slice(0, 2).join(" ") ?? "—"} />
              </div>
            )}
          </div>

          {/* Account info */}
          <div className="glass rounded-3xl overflow-hidden">
            <SectionHeader icon="person" title="Účet" />
            <div className="p-4 flex flex-col gap-0">
              <InfoRow label="E-mail" value={email ?? "—"} />
              <InfoRow label="Jméno" value={name ?? "—"} />
              <InfoRow label="Role" value={isAdmin ? "Administrátor" : "Uživatel"} />
            </div>
            {showSettingsLink && (
              <div className="px-4 pb-4">
                <Link
                  href="/nastaveni"
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-2xl glass-btn text-stone-600"
                >
                  <MIcon name="settings" size={14} />
                  Nastavení
                </Link>
              </div>
            )}
          </div>

          {/* Appearance */}
          <div className="glass rounded-3xl overflow-hidden">
            <SectionHeader icon="palette" title="Vzhled" />
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[12.5px] font-semibold text-stone-700">Tmavý režim</div>
                  <div className="text-[10.5px] text-stone-400">Přizpůsobí barvy pro pohodlné čtení ve tmě</div>
                </div>
                <ThemeToggle />
              </div>
            </div>
          </div>

          {/* App info */}
          <div className="glass rounded-3xl overflow-hidden">
            <SectionHeader icon="build" title="Aplikace" />
            <div className="p-4 flex flex-col gap-2">
              <InfoRow label="Verze" value={build.displayString} mono />
              <div className="flex items-center justify-between">
                <p className="text-[10.5px] text-stone-400 leading-relaxed">
                  Při hlášení problému pošli adminovi tuto verzi.
                </p>
                <CopyBuildButton text={build.displayString} />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
