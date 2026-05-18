"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import MIcon from "./MIcon";

function buildMainNav(base: string) {
  return [
    { href: base || "/",          icon: "receipt_long", label: "Dnešní objednávka", exact: true  },
    { href: `${base}/jidelnicek`, icon: "menu_book",    label: "Jídelníček",        exact: false },
    { href: `${base}/historie`,   icon: "history",      label: "Historie",          exact: false },
    { href: `${base}/profil`,     icon: "person",       label: "Profil",            exact: false },
  ];
}

function buildAdminNav(base: string) {
  return [
    { href: `${base}/admin/uzivatele`, icon: "group",    label: "Uživatelé",  exact: false },
    { href: `${base}/nastaveni`,       icon: "settings", label: "Nastavení",  exact: false },
  ];
}

type UserInfo = { firstName: string; lastName: string; role: string } | null;

function tInitials(user: NonNullable<UserInfo>) {
  return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
}

function UserCard({
  user,
  basePath,
  onLogout,
  loggingOut,
}: {
  user: NonNullable<UserInfo>;
  basePath: string;
  onLogout: () => void;
  loggingOut: boolean;
}) {
  const isAdmin = user.role === "admin";
  return (
    <div className="glass-soft rounded-2xl p-2.5 flex items-center gap-2.5">
      <Link href={`${basePath}/profil`} className="no-underline flex items-center gap-2.5 flex-1 min-w-0 group">
        <span
          className="inline-flex items-center justify-center rounded-full shrink-0 font-display font-bold text-white text-[11px]"
          style={{
            width: 32, height: 32,
            background: "linear-gradient(135deg,#F59E0B,#EA580C)",
            boxShadow: "0 0 0 2px rgba(255,255,255,0.85)",
          }}
        >
          {tInitials(user)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-semibold text-slate-900 truncate leading-tight group-hover:text-amber-700 transition">
            {user.firstName} {user.lastName}
          </div>
          <div className="text-[10.5px] text-slate-500 flex items-center gap-1">
            {isAdmin
              ? <><MIcon name="shield_person" size={10} /><span>Admin</span></>
              : <span>Uživatel</span>
            }
          </div>
        </div>
      </Link>
      <button
        type="button"
        onClick={onLogout}
        disabled={loggingOut}
        title="Odhlásit"
        className="w-7 h-7 rounded-lg inline-flex items-center justify-center text-slate-400 hover:text-rose-600 transition"
      >
        <MIcon name="logout" size={15} />
      </button>
    </div>
  );
}

export default function AppTopBar({
  initialUser,
  tenantSlug,
  tenantName,
}: {
  initialUser?: UserInfo;
  tenantSlug?: string;
  tenantName?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const base = tenantSlug ? `/t/${tenantSlug}` : "";
  const [loggingOut, setLoggingOut] = useState(false);

  // Don't render on auth pages
  const authPaths = tenantSlug
    ? [`${base}/login`, `${base}/register`, `${base}/zapomenute-heslo`]
    : ["/login", "/register", "/zapomenute-heslo"];
  if (authPaths.some((p) => pathname === p) || pathname.startsWith(`${base}/reset-hesla`)) return null;

  const isAdmin = initialUser?.role === "admin";

  // Tenant display info derived from tenantName or slug
  const displayName = tenantName
    || (tenantSlug ? tenantSlug.charAt(0).toUpperCase() + tenantSlug.slice(1).replace(/-/g, " ") : "Kantýna");
  const initials = displayName
    .split(/\s+/)
    .map((w: string) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const mainNav = buildMainNav(base);
  const adminNav = buildAdminNav(base);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch(`${base}/api/auth/logout`, { method: "POST" });
      router.push(`${base}/login`);
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <aside
      className="hidden md:flex fixed top-0 left-0 w-[244px] h-screen flex-col gap-1 p-3 border-r border-white/55 z-50 overflow-y-auto"
      style={{
        background: "rgba(255,255,255,0.5)",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
      }}
    >
      {/* ── Tenant header ── */}
      <div className="px-2 py-3 flex items-center gap-2.5">
        <span
          className="inline-flex items-center justify-center rounded-xl font-display font-extrabold text-white text-[12px] shrink-0"
          style={{
            width: 34, height: 34,
            background: "linear-gradient(135deg, #F59E0B, #EA580C)",
            boxShadow: "0 6px 16px -6px rgba(245,158,11,0.5)",
          }}
        >
          {initials}
        </span>
        <div className="min-w-0">
          <div className="text-[9.5px] uppercase tracking-[0.15em] font-semibold text-amber-700/80 -mb-0.5">Kantýna</div>
          <div className="font-display font-bold text-[12.5px] text-slate-900 truncate leading-tight">{displayName}</div>
        </div>
      </div>

      {/* ── Main nav ── */}
      <div className="mt-2 flex flex-col gap-0.5">
        {mainNav.map(({ href, icon, label, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href) && href !== "/";
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-3 pl-3 pr-3 py-2.5 rounded-2xl transition no-underline ${isActive ? "tab-active" : "hover:bg-white/60"}`}
            >
              <MIcon
                name={icon}
                size={18}
                fill={isActive}
                style={isActive
                  ? { background: "linear-gradient(135deg,#F59E0B,#EA580C)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }
                  : { color: "#94a3b8" }}
              />
              <span className={`flex-1 text-[13px] font-display font-semibold ${isActive ? "text-slate-900" : "text-slate-500"}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>

      {/* ── Admin section ── */}
      {isAdmin && (
        <>
          <div className="px-3 mt-4 mb-1 text-[9.5px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <MIcon name="shield_person" size={11} /> Admin
          </div>
          <div className="flex flex-col gap-0.5">
            {adminNav.map(({ href, icon, label, exact }) => {
              const isActive = exact ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center gap-3 pl-3 pr-3 py-2.5 rounded-2xl transition no-underline ${isActive ? "tab-active" : "hover:bg-white/60"}`}
                >
                  <MIcon
                    name={icon}
                    size={18}
                    fill={isActive}
                    style={isActive
                      ? { background: "linear-gradient(135deg,#F59E0B,#EA580C)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }
                      : { color: "#94a3b8" }}
                  />
                  <span className={`flex-1 text-[13px] font-display font-semibold ${isActive ? "text-slate-900" : "text-slate-500"}`}>
                    {label}
                  </span>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {/* ── User card at bottom ── */}
      <div className="mt-auto">
        {initialUser ? (
          <UserCard
            user={initialUser}
            basePath={base}
            onLogout={handleLogout}
            loggingOut={loggingOut}
          />
        ) : (
          <div className="glass-soft rounded-2xl p-3 flex flex-col gap-1.5">
            <Link
              href={`${base}/login`}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold text-slate-600 glass-btn transition no-underline"
            >
              <MIcon name="login" size={13} />
              Přihlásit se
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}
