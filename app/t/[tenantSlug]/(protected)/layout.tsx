import { redirect } from "next/navigation";
import { requireTenantAccess, TenantAuthError } from "@/lib/tenant-auth";

export default async function ProtectedLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  try {
    await requireTenantAccess(tenantSlug);
  } catch (e) {
    if (e instanceof TenantAuthError) {
      redirect(`/t/${tenantSlug}/login`);
    }
    throw e;
  }
  return <>{children}</>;
}
