import Link from "next/link";
import { auth, signOut } from "@/auth";
import { getUserById } from "@/lib/users";
import { getBuildInfo } from "@/lib/build-info";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const userId = session?.userId;
  const dbUser = userId ? getUserById(userId) : null;
  const build = getBuildInfo();
  const isAdmin = session?.user?.role === "admin";

  return (
    <div className="v2-shell">
      <div className="v2-content">
        <div className="glass rounded-3xl p-6 max-w-2xl mx-auto mt-8">
          <div className="text-2xl font-display font-extrabold text-stone-900">Profil</div>

          {params.denied === "admin" && (
            <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-[13px] text-amber-900">
              Nastavení je dostupné jen pro administrátory. Požádej admina o přidání tvého e-mailu do <code className="bg-black/5 px-1 rounded">ADMIN_EMAILS</code>.
            </div>
          )}

          <div className="mt-4 grid gap-3 text-[13px]">
            <div className="flex items-center justify-between gap-4">
              <span className="text-stone-500">E-mail</span>
              <span className="font-semibold text-stone-800 text-right">{session?.user?.email ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-stone-500">Jméno</span>
              <span className="font-semibold text-stone-800 text-right">{session?.user?.name ?? dbUser?.name ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-stone-500">Role</span>
              <span className="font-semibold text-stone-800">{session?.user?.role ?? dbUser?.role ?? "user"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-stone-500">Build</span>
              <span className="font-mono text-[12px] text-stone-600 text-right">{build.displayString}</span>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {session?.user?.role === "admin" && (
              <Link href="/nastaveni" className="v2-btn v2-btn--secondary">
                Nastavení
              </Link>
            )}
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button type="submit" className="v2-btn v2-btn--ghost">
                Odhlásit se
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
