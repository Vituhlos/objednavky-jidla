import { redirect } from "next/navigation";
import { requireSuperAdmin, TenantAuthError } from "@/lib/tenant-auth";
import MIcon from "@/app/components/MIcon";
import SALogoutButton from "./SALogoutButton";
import SANav from "./SANav";

export default async function SAProtectedLayout({ children }: { children: React.ReactNode }) {
  let admin;
  try {
    admin = await requireSuperAdmin();
  } catch (e) {
    if (e instanceof TenantAuthError) redirect("/super-admin/login");
    throw e;
  }

  return (
    <div style={{ minHeight: "100dvh", position: "relative" }}>
      <div className="stage-bg" aria-hidden>
        <div className="orb orb-sky" />
        <div className="orb orb-amber" />
        <div className="orb orb-mint" />
        <div className="orb orb-rose" />
      </div>

      {/* Top bar */}
      <header
        className="border-b border-white/50"
        style={{
          position: "sticky", top: 0, zIndex: 50,
          background: "rgba(255,255,255,0.28)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          padding: "0 1.5rem",
          height: 56,
          display: "flex", alignItems: "center", gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
          <div
            className="inline-flex items-center justify-center rounded-xl shrink-0"
            style={{
              width: 32, height: 32,
              background: "linear-gradient(135deg,#F59E0B,#EA580C)",
              boxShadow: "0 6px 14px -6px rgba(234,88,12,0.5)",
            }}
          >
            <MIcon name="admin_panel_settings" size={17} fill style={{ color: "white" }} />
          </div>
          <span className="font-display font-extrabold text-[15px] text-slate-900">Super Admin</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="text-[12px] text-slate-500 hidden sm:inline">{admin.email}</span>
          <SALogoutButton />
        </div>
      </header>

      <SANav />

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 1.5rem" }}>
        {children}
      </main>
    </div>
  );
}
