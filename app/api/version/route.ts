import { getAppVersionInfo } from "@/lib/version";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return new Response(JSON.stringify(getAppVersionInfo(), null, 2), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
