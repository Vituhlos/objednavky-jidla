import Link from "next/link";
import { getGlobalDb } from "@/lib/global-db";
import MIcon from "@/app/components/MIcon";
import JoinRegisterForm from "./JoinRegisterForm";

export default async function JoinWithCodePage({ params }: { params: Promise<{ kod: string }> }) {
  const { kod } = await params;
  const normalizedCode = kod.trim().toUpperCase();

  const tenant = getGlobalDb()
    .prepare("SELECT slug, display_name FROM tenants WHERE join_code = ? AND active = 1")
    .get(normalizedCode) as { slug: string; display_name: string } | undefined;

  return (
    <div style={{ position: "fixed", inset: 0, overflowY: "auto" }}>
      <div style={{ minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem 1rem" }}>
        <div className="glass scale-in" style={{ width: "100%", maxWidth: 420, borderRadius: 24, padding: "2rem", position: "relative", zIndex: 10 }}>
          {!tenant ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 52, height: 52, borderRadius: 16, background: "rgba(220,38,38,0.1)", margin: "0 auto 1rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <MIcon name="error" size={26} fill style={{ color: "#dc2626" }} />
              </div>
              <div className="font-display" style={{ fontSize: 20, fontWeight: 700, color: "#b91c1c" }}>Neplatný kód</div>
              <p style={{ fontSize: 14, color: "#9b8474", margin: "0.75rem 0 1.5rem" }}>
                Kód{" "}
                <code style={{ background: "rgba(0,0,0,0.06)", padding: "1px 6px", borderRadius: 6 }}>
                  {normalizedCode}
                </code>{" "}
                nenalezen nebo kantýna není aktivní.
              </p>
              <Link href="/join" style={{ color: "#D97706", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>
                ← Zadat jiný kód
              </Link>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "1.75rem", gap: 10 }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, background: "linear-gradient(135deg,#F59E0B,#EA580C)", boxShadow: "0 8px 24px -8px rgba(245,158,11,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <MIcon name="restaurant" size={26} fill className="text-white" />
                </div>
                <div style={{ textAlign: "center" }}>
                  <div className="font-display" style={{ fontSize: 20, fontWeight: 800, background: "linear-gradient(135deg,#D97706,#EA580C)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                    Vítejte v {tenant.display_name}
                  </div>
                  <div style={{ fontSize: 13, color: "#9b8474", marginTop: 2 }}>Vytvoření nového účtu</div>
                </div>
              </div>

              <JoinRegisterForm initialCode={normalizedCode} tenantSlug={tenant.slug} />

              <p style={{ textAlign: "center", marginTop: "1.25rem", fontSize: 13, color: "#9b8474" }}>
                Již máte účet?{" "}
                <Link href={`/t/${tenant.slug}/login`} style={{ color: "#D97706", fontWeight: 600, textDecoration: "none" }}>
                  Přihlásit se
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
