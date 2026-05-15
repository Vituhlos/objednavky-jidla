import { redirect } from "next/navigation";
import { requireSuperAdmin, TenantAuthError, SA_COOKIE_NAME } from "@/lib/tenant-auth";
import MIcon from "@/app/components/MIcon";
import SALogoutButton from "./SALogoutButton";

export default async function SAProtectedLayout({ children }: { children: React.ReactNode }) {
  let admin;
  try {
    admin = await requireSuperAdmin();
  } catch (e) {
    if (e instanceof TenantAuthError) redirect("/super-admin/login");
    throw e;
  }

  return (
    <div style={{ minHeight: "100dvh", background: "var(--paper)" }}>
      {/* Top bar */}
      <header style={{
        background: "var(--navy)", color: "#fff",
        padding: "0 1.25rem",
        height: 56, display: "flex", alignItems: "center", gap: 12,
        boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
          <MIcon name="admin_panel_settings" size={22} fill style={{ color: "#F59E0B" }} />
          <span className="font-display" style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.01em" }}>
            Super Admin
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, opacity: 0.65 }}>{admin.email}</span>
          <SALogoutButton />
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 1.25rem" }}>
        {children}
      </main>
    </div>
  );
}
