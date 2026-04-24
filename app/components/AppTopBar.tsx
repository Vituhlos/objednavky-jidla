"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const IconOrders = () => (
  <svg aria-hidden fill="none" height="16" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="16">
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
    <rect height="4" rx="1" width="6" x="9" y="3"/>
    <path d="M9 12h6M9 16h4"/>
  </svg>
);

const IconMenu = () => (
  <svg aria-hidden fill="none" height="16" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="16">
    <path d="M3 6h18M3 12h18M3 18h11"/>
    <circle cx="18" cy="18" r="3"/>
    <path d="M18 15v3l2 1"/>
  </svg>
);

const IconPizza = () => (
  <svg aria-hidden fill="none" height="16" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="16">
    <path d="M12 2a10 10 0 0110 10"/>
    <path d="M2 12C2 6.48 6.48 2 12 2l-10 20 20-10z"/>
    <circle cx="12" cy="13" fill="currentColor" r="1"/>
  </svg>
);

const IconHistory = () => (
  <svg aria-hidden fill="none" height="16" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="16">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 6v6l4 2"/>
  </svg>
);

const IconSettings = () => (
  <svg aria-hidden fill="none" height="16" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="16">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
  </svg>
);

const NAV = [
  { href: "/",           label: "Objednávky", icon: <IconOrders />,  exact: true },
  { href: "/jidelnicek", label: "Jídelníček", icon: <IconMenu />,    exact: false },
  { href: "/pizza",      label: "Pizza",      icon: <IconPizza />,   exact: false },
  { href: "/historie",   label: "Historie",   icon: <IconHistory />, exact: false },
  { href: "/nastaveni",  label: "Nastavení",  icon: <IconSettings />,exact: false },
];

export default function AppTopBar() {
  const pathname = usePathname();
  return (
    <header className="v2-topbar">
      <div className="v2-topbar__brand">
        <div className="v2-topbar__logo">
          <svg fill="currentColor" height="20" viewBox="0 0 24 24" width="20">
            <path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"/>
          </svg>
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
              {icon}
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
