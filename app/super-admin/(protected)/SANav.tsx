"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import MIcon from "@/app/components/MIcon";

const NAV_ITEMS = [
  { href: "/super-admin/najemnici", label: "Kantýny",      icon: "corporate_fare" },
  { href: "/super-admin/spravci",   label: "Super admini", icon: "manage_accounts" },
  { href: "/kuchyne",               label: "Kuchyně",      icon: "restaurant" },
];

const BRZY_ITEMS = [
  { label: "Fakturace",  icon: "credit_card" },
  { label: "Audit log",  icon: "manage_search" },
];

export default function SANav() {
  const path = usePathname();

  return (
    <nav
      className="border-b border-white/40"
      style={{
        position: "sticky", top: 56, zIndex: 40,
        background: "rgba(255,255,255,0.32)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 1.5rem" }}>
        <div className="flex gap-0.5 py-1">
          {NAV_ITEMS.map((item) => {
            const active = path.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all ${
                  active ? "tab-active text-amber-900" : "text-slate-500 hover:text-slate-800 hover:bg-white/50"
                }`}
              >
                <MIcon name={item.icon} size={15} fill={active} />
                {item.label}
              </Link>
            );
          })}
          {BRZY_ITEMS.map((item) => (
            <span
              key={item.label}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold text-slate-300 cursor-default select-none"
            >
              <MIcon name={item.icon} size={15} />
              {item.label}
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-0.5"
                style={{ background: "rgba(148,163,184,0.2)", color: "#94a3b8" }}
              >
                BRZY
              </span>
            </span>
          ))}
        </div>
      </div>
    </nav>
  );
}
