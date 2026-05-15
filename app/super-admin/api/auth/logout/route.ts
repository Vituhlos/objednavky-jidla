import { NextResponse } from "next/server";
import { deleteSuperAdminSession, SA_COOKIE_NAME } from "@/lib/tenant-auth";
import { cookies } from "next/headers";

export async function POST() {
  const jar = await cookies();
  const token = jar.get(SA_COOKIE_NAME)?.value;
  if (token) deleteSuperAdminSession(token);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SA_COOKIE_NAME);
  return res;
}
