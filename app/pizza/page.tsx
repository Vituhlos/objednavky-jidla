export const dynamic = "force-dynamic";
export const metadata = { title: "Pizza" };

import { notFound } from "next/navigation";
import { getTodayPizzaOrderData } from "@/lib/pizza";
import PizzaPage from "@/app/components/PizzaPage";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

export default async function Page() {
  if (getSettings().pizzaEnabled === "false") notFound();
  const data = getTodayPizzaOrderData();
  const currentUser = await getCurrentUser();
  const isAdmin = currentUser?.role === "admin";
  return <PizzaPage initialData={data} isAdmin={isAdmin} />;
}
