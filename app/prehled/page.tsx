export const dynamic = "force-dynamic";

import { getTodayOrderData } from "@/lib/orders";
import OverviewPage from "@/app/components/OverviewPage";

export default function Page() {
  const data = getTodayOrderData();
  return (
    <OverviewPage
      initialDepartments={data.departments}
      initialSentAt={data.order.sentAt}
      initialStatus={data.order.status}
      initialTotalPrice={data.totalPrice}
      orderDate={data.order.date}
    />
  );
}
