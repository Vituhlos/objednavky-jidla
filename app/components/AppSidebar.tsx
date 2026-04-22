"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { label: "Dnešní objednávka", href: "/" },
  { label: "Jídelníček LIMA", href: "/jidelnicek" },
  { label: "Pizza", href: "/pizza" },
  { label: "Historie", href: "/historie" },
  { label: "Nastavení", href: "/nastaveni" },
];

export default function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="brand-block">
        <h1>Objednávky</h1>
        <p>Obědy a pizza pro dnešní den.</p>
      </div>

      <nav className="sidebar__nav">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              className={`sidebar__link${isActive ? " sidebar__link--active" : ""}`}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar__note">
        <p className="sidebar__note-label">Režim použití</p>
        <p>
          Bez přihlášení. Jméno se zapisuje přímo do sdíleného řádku objednávky
          stejně jako v Excelu.
        </p>
      </div>
    </aside>
  );
}
