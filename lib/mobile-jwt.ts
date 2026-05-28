import { createHmac, timingSafeEqual } from "crypto";

const ACCESS_TTL_SEC = 15 * 60;

function getSecret(): string {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not configured");
  return secret;
}

function base64urlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function parseBase64urlJson<T>(segment: string): T {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as T;
}

export type AccessTokenPayload = {
  sub: number;
  role: "admin" | "user";
  sv: number;
  typ: "access";
  iat: number;
  exp: number;
};

export function signAccessToken(userId: number, role: "admin" | "user", sessionVersion: number): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload: Omit<AccessTokenPayload, "iat" | "exp"> & { iat: number; exp: number } = {
    sub: userId,
    role,
    sv: sessionVersion,
    typ: "access",
    iat: now,
    exp: now + ACCESS_TTL_SEC,
  };
  const h = base64urlJson(header);
  const p = base64urlJson(payload);
  const sig = createHmac("sha256", getSecret()).update(`${h}.${p}`).digest("base64url");
  return `${h}.${p}.${sig}`;
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, sig] = parts;
  const expected = createHmac("sha256", getSecret()).update(`${h}.${p}`).digest("base64url");
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  const payload = parseBase64urlJson<AccessTokenPayload>(p);
  if (payload.typ !== "access") return null;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export function accessTokenExpiresIn(): number {
  return ACCESS_TTL_SEC;
}

export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}
