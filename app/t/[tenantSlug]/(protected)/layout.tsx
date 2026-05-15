import { redirect } from "next/navigation";
import { requireTenantAccess, TenantAuthError } from "@/lib/tenant-auth";
import AppTopBar from "@/app/components/AppTopBar";

export default async function ProtectedLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  let user;
  try {
    user = await requireTenantAccess(tenantSlug);
  } catch (e) {
    if (e instanceof TenantAuthError) {
      redirect(`/t/${tenantSlug}/login`);
    }
    throw e;
  }

  const initialUser = { firstName: user.firstName, lastName: user.lastName, role: user.role };

  return (
    <>
      <AppTopBar initialUser={initialUser} tenantSlug={tenantSlug} />
      <div className="md:ml-[232px]">
        {children}
      </div>
    </>
  );
}
