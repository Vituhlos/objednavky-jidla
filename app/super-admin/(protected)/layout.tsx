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
      {/* Background orbs — same as main app */}
      <div className="stage-bg" aria-hidden>
        <div className="orb orb-sky" />
        <div className="orb orb-amber" />
        <div className="orb orb-mint" />
      </div>

      {/* Top bar */}
      <header className="glass" style={{
        position: "sticky", top: 0, zIndex: 50,
        borderRadius: 0,
        borderTop: "none", borderLeft: "none", borderRight: "none",
        borderBottom: "1px solid rgba(22,50,74,0.12)",
        padding: "0 1.5rem",
        height: 56,
        display: "flex", alignItems: "center", gap: 12,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        background: "rgba(243,239,230,0.82)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: "linear-gradient(135deg,#1e3a5f,#2f4858)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px -4px rgba(22,50,74,0.4)",
          }}>
            <MIcon name="admin_panel_settings" size={17} fill style={{ color: "#F59E0B" }} />
          </div>
          <span className="font-display" style={{ fontSize: 15, fontWeight: 700, color: "var(--navy)", letterSpacing: "0.01em" }}>
            Super Admin
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: "#9b8474" }}>{admin.email}</span>
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
