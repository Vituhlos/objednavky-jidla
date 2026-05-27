import Link from "next/link";
import { signOut } from "@/auth";
import type { BuildInfo } from "@/lib/build-info";
import type { UserOrderStats } from "@/lib/orders";
import PageHeader from "./PageHeader";
import MIcon from "./MIcon";
import CopyBuildButton from "./CopyBuildButton";
import ThemeToggle from "./ThemeToggle";
import { Section } from "./settings/_shared";

function ProfileRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-white/40 last:border-0">
      <span className="text-[12px] font-semibold text-stone-600 shrink-0">{label}</span>
      <span
        className={`text-[13px] font-semibold text-stone-800 text-right break-all ${mono ? "font-mono text-[12px]" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

export default function ProfilePage({
  email,
  name,
  role,
  build,
  showDeniedAdmin,
  showSettingsLink,
  stats,
}: {
  email: string | null | undefined;
  name: string | null | undefined;
  role: string;
  build: BuildInfo;
  showDeniedAdmin: boolean;
  showSettingsLink: boolean;
  stats?: UserOrderStats;
}) {
  const displayName = name || email || "Uživatel";
  const initial = displayName[0]?.toUpperCase() ?? "?";
  const isAdmin = role === "admin";

  const signOutAction = async () => {
    "use server";
    await signOut({ redirectTo: "/login" });
  };

  const headerActions = (
    <>
      {showSettingsLink && (
        <Link
          href="/nastaveni"
          className="hidden md:inline-flex items-center gap-1.5 font-semibold rounded-full glass-btn text-stone-600 text-[12px] px-3 py-1.5"
        >
          <MIcon name="settings" size={13} />
          Nastavení
        </Link>
      )}
      <form action={signOutAction} className="hidden md:block">
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 font-semibold rounded-full glass-btn text-stone-600 text-[12px] px-3 py-1.5"
        >
          <MIcon name="logout" size={13} />
          Odhlásit
        </button>
      </form>
    </>
  );

  return (
    <div className="k-shell">
      <PageHeader
        title="Profil"
        mobileTitle="Profil"
        meta={
          <span className={`status-pill ${isAdmin ? "status-pill--sent" : ""}`} style={isAdmin ? undefined : { background: "rgba(0,0,0,0.05)", color: "#57534e", border: "1px solid rgba(0,0,0,0.08)" }}>
            {isAdmin ? "Admin" : "Uživatel"}
          </span>
        }
        actions={headerActions}
        secondaryRow={
          <>
            {showSettingsLink && (
              <Link
                href="/nastaveni"
                className="inline-flex items-center gap-1 font-semibold rounded-full glass-btn text-stone-600 text-[11px] px-2.5 py-1.5"
              >
                <MIcon name="settings" size={12} />
                Nastavení
              </Link>
            )}
            <form action={signOutAction}>
              <button
                type="submit"
                className="inline-flex items-center gap-1 font-semibold rounded-full glass-btn text-stone-600 text-[11px] px-2.5 py-1.5"
              >
                <MIcon name="logout" size={12} />
                Odhlásit
              </button>
            </form>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto scroll-area p-4 md:p-5 pb-nav">
        <div className="max-w-3xl mx-auto w-full flex flex-col gap-4">
          {showDeniedAdmin && (
            <div
              className="px-3 py-2.5 rounded-2xl text-[12.5px] text-stone-600 leading-relaxed"
              style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.15)" }}
            >
              <strong>Nastavení je jen pro administrátory.</strong> Požádej admina o přidání tvého e-mailu do{" "}
              <code className="bg-black/5 px-1 rounded font-mono text-[11.5px]">ADMIN_EMAILS</code> nebo o změnu role v Nastavení → Uživatelé.
            </div>
          )}

          <div className="glass-card rounded-3xl overflow-hidden">
            <div className="flex flex-col items-center gap-3 p-6 md:p-8 border-b border-white/40" style={{ background: "rgba(245,158,11,0.05)" }}>
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-[22px] font-display font-bold shrink-0"
                style={{
                  background: isAdmin
                    ? "linear-gradient(135deg,#F59E0B,#EA580C)"
                    : "linear-gradient(135deg,#a8a29e,#78716c)",
                  boxShadow: isAdmin ? "0 6px 16px -6px rgba(245,158,11,0.45)" : undefined,
                }}
              >
                {initial}
              </div>
              <div className="text-center min-w-0">
                <p className="font-display font-bold text-[17px] text-stone-900 truncate max-w-full">{displayName}</p>
                {email && name && (
                  <p className="text-[12.5px] text-stone-500 mt-0.5 truncate max-w-full">{email}</p>
                )}
              </div>
            </div>
          </div>

          <Section title="Účet" icon="person">
            <ProfileRow label="E-mail" value={email ?? "—"} />
            <ProfileRow label="Jméno" value={name ?? "—"} />
            <ProfileRow label="Role" value={isAdmin ? "Administrátor" : "Uživatel"} />
          </Section>

          {stats && (stats.totalOrders > 0 || stats.monthlyOrders > 0) && (
            <Section title="Moje objednávky" icon="restaurant">
              <div className="grid grid-cols-2 gap-3 py-2">
                <div className="glass-card rounded-2xl p-3 text-center" style={{ background: "rgba(245,158,11,0.05)" }}>
                  <p className="text-[22px] font-display font-bold text-stone-900">{stats.monthlyOrders}</p>
                  <p className="text-[11px] text-stone-500 font-medium">tento měsíc</p>
                </div>
                <div className="glass-card rounded-2xl p-3 text-center" style={{ background: "rgba(245,158,11,0.05)" }}>
                  <p className="text-[22px] font-display font-bold text-stone-900">{stats.monthlySpent} Kč</p>
                  <p className="text-[11px] text-stone-500 font-medium">útrata tento měsíc</p>
                </div>
                <div className="glass-card rounded-2xl p-3 text-center" style={{ background: "rgba(79,111,82,0.05)" }}>
                  <p className="text-[22px] font-display font-bold text-stone-900">{stats.totalOrders}</p>
                  <p className="text-[11px] text-stone-500 font-medium">celkem objednávek</p>
                </div>
                <div className="glass-card rounded-2xl p-3 text-center" style={{ background: "rgba(79,111,82,0.05)" }}>
                  <p className="text-[22px] font-display font-bold text-stone-900">{stats.allTimeSpent} Kč</p>
                  <p className="text-[11px] text-stone-500 font-medium">celkem útrata</p>
                </div>
              </div>
              {stats.favoriteMeals.length > 0 && (
                <div className="pt-1 pb-1">
                  <p className="text-[11.5px] font-semibold text-stone-500 mb-2">Nejčastější jídla</p>
                  <div className="flex flex-col gap-1.5">
                    {stats.favoriteMeals.map((meal, i) => (
                      <div key={meal.name} className="flex items-center gap-2.5">
                        <span className="text-[13px] w-5 text-center" aria-hidden>
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
                        </span>
                        <span className="text-[12.5px] text-stone-700 font-medium flex-1 truncate">{meal.name}</span>
                        <span className="text-[11px] text-stone-400 font-medium shrink-0">{meal.count}×</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Section>
          )}

          <Section title="Vzhled" icon="palette">
            <div className="flex items-center justify-between py-2">
              <span className="text-[12px] font-semibold text-stone-600">Tmavý režim</span>
              <ThemeToggle />
            </div>
          </Section>

          <Section title="Aplikace" icon="build">
            <ProfileRow label="Verze" value={build.displayString} mono />
            <div className="flex items-center justify-end pt-1">
              <CopyBuildButton text={build.displayString} />
            </div>
            <p className="text-[11.5px] text-stone-400 leading-relaxed -mt-1">
              Při hlášení problému pošli adminovi tuto verzi — usnadní to dohledání chyby.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}
