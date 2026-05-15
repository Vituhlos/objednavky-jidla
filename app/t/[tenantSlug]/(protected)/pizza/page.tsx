export const dynamic = "force-dynamic";

import { getTodayPizzaOrderData } from "@/lib/pizza";
import PizzaPage from "@/app/components/PizzaPage";
import { requireTenantAccess } from "@/lib/tenant-auth";

export default async function TenantPizzaPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const currentUser = await requireTenantAccess(tenantSlug);
  const isAdmin = currentUser.role === "admin";
  const data = getTodayPizzaOrderData();
  return <PizzaPage initialData={data} isAdmin={isAdmin} />;
}
