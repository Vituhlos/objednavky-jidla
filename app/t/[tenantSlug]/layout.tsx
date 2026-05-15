import { redirect } from "next/navigation";
import { setTenantSlug } from "@/lib/tenant-context";
import { requireTenantAccess, TenantAuthError } from "@/lib/tenant-auth";

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  // Set for all getDb() calls in this render (layout + page + lib)
  setTenantSlug(tenantSlug);

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
