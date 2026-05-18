"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import MIcon from "@/app/components/MIcon";

const NAV_ITEMS = [
  { href: "/super-admin/najemnici", label: "Nájemníci",  icon: "corporate_fare" },
  { href: "/super-admin/spravci",   label: "Správci",    icon: "manage_accounts" },
  { href: "/kuchyne",               label: "Kuchyně",    icon: "restaurant" },
];

export default function SANav() {
  const path = usePathname();

  return (
    <nav style={{ padding: "0.5rem 1.5rem 0", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 4 }}>
        {NAV_ITEMS.map((item) => {
          const active = path.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={active ? "" : "hover:bg-white/60"}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "0.5rem 0.875rem",
                borderRadius: 12,
                fontSize: 13, fontWeight: active ? 700 : 500,
                color: active ? "var(--navy)" : "#9b8474",
                background: active ? "rgba(22,50,74,0.08)" : "transparent",
                textDecoration: "none",
                transition: "background 0.15s, color 0.15s",
                whiteSpace: "nowrap",
              }}
            >
              <MIcon name={item.icon} size={15} fill={active} style={{ color: active ? "#D97706" : "#9b8474" }} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
