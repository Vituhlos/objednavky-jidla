import { auth } from "@/auth";
import { getUserById } from "@/lib/users";
import { getBuildInfo } from "@/lib/build-info";
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

  return (
    <ProfilePage
      email={session?.user?.email}
      name={session?.user?.name ?? dbUser?.name}
      role={role}
      build={build}
      showDeniedAdmin={params.denied === "admin"}
      showSettingsLink={role === "admin"}
    />
  );
}
