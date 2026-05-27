export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getBuildInfo } from "@/lib/build-info";

export function GET() {
  return Response.json({ ok: true, ...getBuildInfo(), ts: Date.now() });
}

