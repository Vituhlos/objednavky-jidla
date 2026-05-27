import { NextRequest, NextResponse } from "next/server";
import { consumeEmailVerificationToken } from "@/lib/users";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.redirect(new URL("/login?verify=invalid", req.url));

  const userId = consumeEmailVerificationToken(token);
  if (!userId) return NextResponse.redirect(new URL("/login?verify=expired", req.url));

  return NextResponse.redirect(new URL("/login?verify=success", req.url));
}
