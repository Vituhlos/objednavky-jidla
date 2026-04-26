"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import MIcon from "./MIcon";

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
            <MIcon name="restaurant" size={20} fill />
          </div>
          <span className="v2-topbar__title">Kantýna</span>
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
                <MIcon name={icon} size={18} fill={isActive} />
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
              <MIcon name={icon} size={24} fill={isActive} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
