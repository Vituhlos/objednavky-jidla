import { getDb } from "@/lib/db";
import { getAppVersionInfo } from "@/lib/version";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HealthStatus = "ok" | "error";

export function GET() {
  const startedAt = Date.now();
  const version = getAppVersionInfo();
  let database: HealthStatus = "ok";
  let error = "";

  try {
    getDb().prepare("SELECT 1").get();
  } catch (err) {
    database = "error";
    error = err instanceof Error ? err.message : String(err);
  }

  const ok = database === "ok";
  const body = {
    ok,
    status: ok ? "ok" : "error",
    checks: {
      app: "ok" as HealthStatus,
      database,
      scheduler: "registered",
    },
    version: version.version,
    commit: version.shortCommitSha || version.commitSha || "",
    releaseChannel: version.releaseChannel,
    uptimeSec: Math.round(process.uptime()),
    responseTimeMs: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
    ...(error ? { error } : {}),
  };

  return Response.json(body, {
    status: ok ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
