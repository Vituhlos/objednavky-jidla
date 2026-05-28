import { getDepartments } from "@/lib/departments";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(getDepartments());
}
