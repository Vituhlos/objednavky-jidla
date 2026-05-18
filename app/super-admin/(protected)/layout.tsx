import { redirect } from "next/navigation";
import { requireSuperAdmin, TenantAuthError } from "@/lib/tenant-auth";
import MIcon from "@/app/components/MIcon";
import SALogoutButton from "./SALogoutButton";
import SANav from "./SANav";

function emailInitials(email: string): string {
  const name = email.split("@")[0] ?? "";
  const parts = name.split(/[._\-+]/);
  return parts.slice(0, 2).map((p) => (p[0] ?? "").toUpperCase()).join("") || (email[0] ?? "A").toUpperCase();
}

export default async function SAProtectedLayout({ children }: { children: React.ReactNode }) {
  let admin;
  try {
    admin = await requireSuperAdmin();
  } catch (e) {
    if (e instanceof TenantAuthError) redirect("/super-admin/login");
    throw e;
  }

  const isProd = process.env.NODE_ENV === "production";

  return (
    <div style={{ minHeight: "100dvh", position: "relative" }}>
      <div className="stage-bg" aria-hidden>
        <div className="orb orb-sky" />
        <div className="orb orb-amber" />
        <div className="orb orb-mint" />
        <div className="orb orb-rose" />
      </div>

      {/* ── Main top bar ── */}
      <header
        className="border-b border-white/50"
        style={{
          position: "sticky", top: 0, zIndex: 50,
          background: "rgba(255,255,255,0.28)",
          backdropFilter: "blur(28px) saturate(180%)",
          WebkitBackdropFilter: "blur(28px) saturate(180%)",
        }}
      >
        <div
          style={{
            maxWidth: 1100, margin: "0 auto",
            padding: "0 1.5rem", height: 56,
            display: "flex", alignItems: "center", gap: 16,
          }}
        >
          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div
              className="inline-flex items-center justify-center rounded-xl shrink-0"
              style={{
                width: 34, height: 34,
                background: "linear-gradient(135deg,#F59E0B,#EA580C)",
                boxShadow: "0 6px 14px -6px rgba(234,88,12,0.5)",
              }}
            >
              <MIcon name="restaurant" size={18} fill style={{ color: "white" }} />
            </div>
            <div className="leading-tight">
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">KANTÝNA</div>
              <div className="font-display font-extrabold text-[14px] text-slate-900 leading-none">Super Admin</div>
            </div>
            {isProd && (
              <span
                className="text-[10.5px] font-bold px-2 py-0.5 rounded-full ml-1 hidden sm:inline"
                style={{
                  background: "rgba(245,158,11,0.12)",
                  border: "1px solid rgba(245,158,11,0.3)",
                  color: "#b45309",
                }}
              >
                PRODUCTION
              </span>
            )}
          </div>

          {/* System status */}
          <div className="flex-1 flex items-center justify-center gap-4">
            <span className="hidden lg:inline-flex items-center gap-2 text-[12px] text-slate-500">
              <span className="dot dot-green" />
              Všechny systémy v provozu
            </span>
          </div>

          {/* User + logout */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-2.5">
              <span
                className="inline-flex items-center justify-center rounded-full font-display font-bold text-[12px] text-white shrink-0"
                style={{
                  width: 32, height: 32,
                  background: "linear-gradient(135deg,#F59E0B,#EA580C)",
                  boxShadow: "0 4px 10px -4px rgba(234,88,12,0.4)",
                }}
              >
                {emailInitials(admin.email)}
              </span>
              <div className="leading-tight hidden md:block">
                <div className="text-[12.5px] font-semibold text-slate-800 max-w-[160px] truncate">{admin.email}</div>
                <div className="text-[10.5px] text-slate-400">Super Admin</div>
              </div>
            </div>
            <SALogoutButton />
          </div>
        </div>
      </header>

      {/* ── Tab nav ── */}
      <SANav />

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 1.5rem" }}>
        {children}
      </main>
    </div>
  );
}
