"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/",           label: "Objednávky", icon: "restaurant_menu", exact: true },
  { href: "/jidelnicek", label: "Jídelníček", icon: "menu_book",       exact: false },
  { href: "/pizza",      label: "Pizza",      icon: "local_pizza",     exact: false },
  { href: "/historie",   label: "Historie",   icon: "history",         exact: false },
  { href: "/nastaveni",  label: "Nastavení",  icon: "settings",        exact: false },
];

export default function AppTopBar() {
  const pathname = usePathname();
  return (
    <>
      <header className="v2-topbar">
        <div className="v2-topbar__brand">
          <div className="v2-topbar__logo">
            <span aria-hidden className="material-symbols-outlined msym-fill" style={{ fontSize: 20 }}>
              restaurant
            </span>
          </div>
          <span className="v2-topbar__title">Dnešní objednávka</span>
        </div>
        <nav className="v2-topbar__nav">
          {NAV.map(({ href, label, icon, exact }) => {
            const isActive = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                className={`v2-navlink${isActive ? " v2-navlink--active" : ""}`}
                href={href}
                key={href}
              >
                <span aria-hidden className={`material-symbols-outlined${isActive ? " msym-fill" : ""}`} style={{ fontSize: 18 }}>
                  {icon}
                </span>
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </header>
      <nav aria-label="Navigace" className="v2-bottomnav">
        {NAV.map(({ href, label, icon, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              className={`v2-bottomnav__link${isActive ? " v2-bottomnav__link--active" : ""}`}
              href={href}
              key={href}
            >
              <span aria-hidden className={`material-symbols-outlined${isActive ? " msym-fill" : ""}`} style={{ fontSize: 24 }}>
                {icon}
              </span>
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
