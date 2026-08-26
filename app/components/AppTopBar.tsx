"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, memo } from "react";
import MIcon from "./MIcon";
import type { AccountView } from "@/lib/auth/account-view";

const NAV = [
  { href: "/",           label: "Dnešní objednávka", shortLabel: "Oběd",       icon: "restaurant_menu", exact: true  },
  { href: "/jidelnicek", label: "Jídelníček LIMA",   shortLabel: "Jídelníček", icon: "menu_book",       exact: false },
  { href: "/pizza",      label: "Pizza",              shortLabel: "Pizza",      icon: "local_pizza",     exact: false },
  { href: "/historie",   label: "Historie",           shortLabel: "Historie",   icon: "history",         exact: false },
  { href: "/nastaveni",  label: "Nastavení",          shortLabel: "Nastavení",  icon: "settings",        exact: false },
];

const SidebarClock = memo(function SidebarClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const timeStr = now.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now
    .toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "long" })
    .replace(/^\w/, (c) => c.toUpperCase());

  return (
    <div className="glass-soft rounded-2xl p-3">
      <div className="text-[11px] uppercase tracking-wider text-stone-400 font-semibold mb-0.5">Dnes</div>
      <div className="font-display font-bold text-[15px] text-stone-900">{timeStr}</div>
      <div className="text-[11.5px] text-stone-500 leading-snug">{dateStr}</div>
    </div>
  );
});

/**
 * Vstup do účtu v postranním panelu.
 *
 * Sedí nad hodinami, tedy tam, kde uživatel čeká „kdo jsem" — a drží stejný
 * `glass-soft` blok jako ony, aby nepůsobil jako pozdější přílepek.
 */
function AccountBadge({ account }: { account: AccountView | null }) {
  if (!account) {
    return (
      <Link
        className="glass-soft rounded-2xl p-3 flex items-center gap-2.5 hover:bg-white/60 transition"
        href="/ucet/prihlaseni"
      >
        <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg,rgba(245,158,11,0.18),rgba(234,88,12,0.18))" }}>
          <MIcon name="login" size={17} fill style={{ color: "#D97706" }} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display font-bold text-[12.5px] text-stone-900">Přihlásit se</span>
          <span className="block text-[11px] text-stone-500 leading-snug">Objednávat lze po přihlášení</span>
        </span>
      </Link>
    );
  }

  return (
    <Link
      className="glass-soft rounded-2xl p-3 flex items-center gap-2.5 hover:bg-white/60 transition"
      href="/ucet"
    >
      <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: "linear-gradient(135deg,rgba(245,158,11,0.18),rgba(234,88,12,0.18))" }}>
        <MIcon name="person" size={17} fill style={{ color: "#D97706" }} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display font-bold text-[12.5px] text-stone-900 truncate">{account.name}</span>
        <span className="block text-[11px] text-stone-500">
          {account.role === "admin" ? "Správce" : "Strávník"}
        </span>
      </span>
    </Link>
  );
}

export default function AppTopBar({
  account = null,
  accountsEnabled = false,
  pizzaEnabled = true,
}: {
  account?: AccountView | null;
  accountsEnabled?: boolean;
  pizzaEnabled?: boolean;
}) {
  const pathname = usePathname();

  // Nastavení umí jen správce. Skrytí je pohodlí, ne ochrana — tou jsou guardy
  // u server actions. Dokud účty nikdo nezaložil, zůstává vidět jako dřív.
  const showSettings = !accountsEnabled || account?.role === "admin";

  const nav = NAV.filter(
    (n) => (pizzaEnabled || n.href !== "/pizza") && (showSettings || n.href !== "/nastaveni")
  );

  const accountItem = account
    ? { href: "/ucet", label: "Účet", shortLabel: "Účet", icon: "person", exact: false }
    : { href: "/ucet/prihlaseni", label: "Přihlásit se", shortLabel: "Účet", icon: "login", exact: false };
  const mobileNav = [...nav, accountItem];

  return (
    <>
      {/* ── Desktop sidebar (fixed, hidden on mobile) ── */}
      <aside className="hidden md:flex fixed top-0 left-0 w-[232px] h-screen flex-col gap-1 p-3 border-r border-white/60 desktop-sidebar z-50 overflow-y-auto">
        <div className="px-2 py-3">
          <span className="inline-flex items-center gap-2 font-display font-extrabold">
            <span
              className="inline-flex items-center justify-center rounded-xl"
              style={{
                width: 34, height: 34,
                background: "linear-gradient(135deg,#F59E0B,#EA580C)",
                boxShadow: "0 6px 16px -6px rgba(245,158,11,0.5)",
              }}
            >
              <MIcon name="restaurant" size={20} fill className="text-white" />
            </span>
            <span style={{
              fontSize: 19,
              background: "linear-gradient(135deg,#D97706,#EA580C)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
              Kantýna
            </span>
          </span>
        </div>

        <div className="mt-2 flex flex-col gap-0.5">
          {nav.map(({ href, label, icon, exact }) => {
            const isActive = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-3 pl-3 pr-3 py-2.5 rounded-2xl transition ${isActive ? "sidebar-item-active" : "hover:bg-white/60"}`}
              >
                <MIcon
                  name={icon}
                  size={19}
                  fill={isActive}
                  style={isActive ? { color: "#D97706" } : { color: "#94a3b8" }}
                />
                <span className={`flex-1 text-[13px] font-display font-semibold ${isActive ? "text-stone-900" : "text-stone-500"}`}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="mt-auto flex flex-col gap-2">
          <AccountBadge account={account} />
          <SidebarClock />
        </div>
      </aside>

      {/* ── Mobile bottom fade (masks background bleed under nav) ── */}
      <div
        aria-hidden="true"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 pointer-events-none"
        style={{ height: 80, background: "linear-gradient(to top, #f3efe6 30%, rgba(243,239,230,0) 100%)" }}
      />

      {/* ── Mobile bottom nav (fixed pill, hidden on desktop) ── */}
      <nav aria-label="Navigace" className="md:hidden fixed left-2 right-2 z-40" style={{ bottom: "calc(0.5rem + env(safe-area-inset-bottom, 0px))" }}>
        <div className="glass rounded-2xl px-1 py-1.5 flex items-center justify-around gap-0.5 overflow-x-auto no-scrollbar">
          {mobileNav.map(({ href, shortLabel, icon, exact }) => {
            const isActive = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition shrink-0"
                style={isActive ? { background: "rgba(245,158,11,0.1)" } : {}}
              >
                <MIcon
                  name={icon}
                  size={20}
                  fill={isActive}
                  style={isActive ? { color: "#D97706" } : { color: "#94a3b8" }}
                />
                <span className={`text-[11px] font-semibold font-display leading-none ${isActive ? "text-stone-800" : "text-stone-400"}`}>
                  {shortLabel}
                </span>
                {isActive && (
                  <span className="w-1 h-1 rounded-full mt-0.5" style={{ background: "#F59E0B" }} />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
