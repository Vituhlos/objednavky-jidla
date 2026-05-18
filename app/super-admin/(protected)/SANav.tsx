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
    <nav className="px-6 pt-4 pb-0" style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div className="glass-soft rounded-2xl p-1 flex gap-1 w-fit">
        {NAV_ITEMS.map((item) => {
          const active = path.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all ${
                active ? "tab-active text-amber-900" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <MIcon name={item.icon} size={15} fill={active} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
