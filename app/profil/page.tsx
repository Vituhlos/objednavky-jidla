import { auth } from "@/auth";
import { getUserById } from "@/lib/users";
import { getBuildInfo } from "@/lib/build-info";
import { getUserOrderStats } from "@/lib/orders";
import ProfilePage from "@/app/components/ProfilePage";

export const dynamic = "force-dynamic";

export default async function ProfilRoute({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const userId = session?.userId;
  const dbUser = userId ? getUserById(userId) : null;
  const build = getBuildInfo();
  const role = session?.user?.role ?? dbUser?.role ?? "user";
  const userName = session?.user?.name ?? dbUser?.name ?? "";
  const stats = getUserOrderStats(userName);

  return (
    <ProfilePage
      email={session?.user?.email}
      name={userName || undefined}
      role={role}
      build={build}
      showDeniedAdmin={params.denied === "admin"}
      showSettingsLink={role === "admin"}
      stats={stats}
    />
  );
}
