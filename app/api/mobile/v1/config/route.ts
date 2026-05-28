import { buildAppConfig } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(buildAppConfig());
}
