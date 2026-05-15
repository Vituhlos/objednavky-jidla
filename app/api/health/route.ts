export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getGlobalDb } from "@/lib/global-db";
import { getGlobalSettings } from "@/lib/global-settings";

export function GET() {
  try {
    const db = getGlobalDb();

    const tenantCount = (
      db.prepare("SELECT COUNT(*) as n FROM tenants WHERE active = 1").get() as { n: number }
    ).n;

    const s = getGlobalSettings();

    return Response.json({
      status: "ok",
      db: "ok",
      tenants: tenantCount,
      uptime: Math.floor(process.uptime()),
      memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      lastImapCheckAt: s.lastImapCheckAt ?? null,
      lastBackupAt: s.lastBackupAt ?? null,
      lastCronRunAt: s.lastCronRunAt ?? null,
    });
  } catch (err) {
    console.error("[health] DB check failed:", err);
    return Response.json({ status: "error", db: "fail" }, { status: 503 });
  }
}
