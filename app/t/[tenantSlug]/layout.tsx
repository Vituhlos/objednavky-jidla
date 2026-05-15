import { setTenantSlug } from "@/lib/tenant-context";

// Outer tenant shell: sets DB context for all nested renders.
// Auth check lives in (protected)/layout.tsx so public paths
// (login, register, zapomenute-heslo, reset-hesla, api/auth)
// can render without a session.
export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  setTenantSlug(tenantSlug);
  return <>{children}</>;
}
