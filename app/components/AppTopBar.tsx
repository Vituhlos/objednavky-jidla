"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import MIcon from "./MIcon";

const NAV = [
  { href: "/",           label: "Dnešní objednávka", icon: "restaurant_menu", exact: true  },
  { href: "/jidelnicek", label: "Jídelníček LIMA",   icon: "menu_book",       exact: false },
  { href: "/pizza",      label: "Pizza",              icon: "local_pizza",     exact: false },
  { href: "/historie",   label: "Historie",           icon: "history",         exact: false },
  { href: "/nastaveni",  label: "Nastavení",          icon: "settings",        exact: false },
];

function SidebarClock() {
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
    <div className="v2-sidebar__clock glass-soft">
      <div className="v2-sidebar__clock-label">Dnes</div>
      <div className="v2-sidebar__clock-time">{timeStr}</div>
      <div className="v2-sidebar__clock-date">{dateStr}</div>
    </div>
  );
}

export default function AppTopBar() {
  const pathname = usePathname();
  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="v2-sidebar">
        <div className="v2-sidebar__logo">
          <div className="v2-sidebar__logo-icon">
            <MIcon name="lunch_dining" size={20} fill />
          </div>
          <span className="v2-sidebar__logo-text">Kantýna</span>
        </div>
        <nav className="v2-sidebar__nav">
          {NAV.map(({ href, label, icon, exact }) => {
            const isActive = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                className={`v2-sidebar__link${isActive ? " v2-sidebar__link--active" : ""}`}
                href={href}
                key={href}
              >
                <MIcon name={icon} size={19} fill={isActive} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <SidebarClock />
      </aside>

      {/* ── Mobile bottom nav ── */}
      <nav aria-label="Navigace" className="v2-bottomnav">
        {NAV.map(({ href, label, icon, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              className={`v2-bottomnav__link${isActive ? " v2-bottomnav__link--active" : ""}`}
              href={href}
              key={href}
            >
              <MIcon name={icon} size={24} fill={isActive} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
