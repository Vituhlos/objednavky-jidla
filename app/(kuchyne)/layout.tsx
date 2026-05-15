import { redirect } from "next/navigation";
import { requireSuperAdmin, TenantAuthError } from "@/lib/tenant-auth";
import Link from "next/link";
import MIcon from "@/app/components/MIcon";
import SALogoutButton from "@/app/super-admin/(protected)/SALogoutButton";

export default async function KuchyneLayout({ children }: { children: React.ReactNode }) {
  let admin;
  try {
    admin = await requireSuperAdmin();
  } catch (e) {
    if (e instanceof TenantAuthError) redirect("/super-admin/login");
    throw e;
  }

  const navItems = [
    { href: "/kuchyne", icon: "dashboard", label: "Dashboard" },
    { href: "/super-admin", icon: "corporate_fare", label: "Firmy" },
  ];

  return (
    <div className="flex min-h-dvh" style={{ background: "var(--paper)" }}>
      {/* Sidebar desktop */}
      <aside
        className="w-[232px] shrink-0 hidden md:flex flex-col"
        style={{ background: "var(--navy)", position: "sticky", top: 0, height: "100dvh", zIndex: 20 }}
      >
        <div className="flex items-center gap-2.5 px-5 h-[56px] shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <MIcon name="restaurant" size={20} fill style={{ color: "#F59E0B" }} />
          <span className="font-display text-white font-bold text-[15px] tracking-[0.01em]">Kuchyně</span>
        </div>

        <nav className="flex flex-col gap-0.5 p-3 flex-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-white/65 hover:text-white hover:bg-white/10 text-[13px] font-semibold transition-colors"
            >
              <MIcon name={item.icon} size={18} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="text-white/45 text-[11px] mb-2 truncate">{admin.email}</div>
          <SALogoutButton />
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 flex items-center gap-3 px-4 h-[52px]" style={{ background: "var(--navy)" }}>
        <MIcon name="restaurant" size={18} fill style={{ color: "#F59E0B" }} />
        <span className="font-display text-white font-bold text-[14px] flex-1">Kuchyně</span>
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} className="text-white/65 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <MIcon name={item.icon} size={18} />
          </Link>
        ))}
        <SALogoutButton />
      </div>

      {/* Main content */}
      <main className="flex-1 min-w-0 md:pt-0 pt-[52px]">
        {children}
      </main>
    </div>
  );
}
