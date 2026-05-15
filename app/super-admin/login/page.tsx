import { getGlobalDb } from "@/lib/global-db";
import SALoginClient from "./LoginClient";

export const dynamic = "force-dynamic";

export default function SuperAdminLoginPage() {
  const { count } = getGlobalDb()
    .prepare("SELECT COUNT(*) as count FROM super_admins")
    .get() as { count: number };

  return <SALoginClient bootstrapMode={count === 0} />;
}
