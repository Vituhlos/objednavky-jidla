import { createHmac, timingSafeEqual } from "node:crypto";
import * as client from "openid-client";
import { getSettings } from "../settings";

const GOOGLE_ISSUER = new URL("https://accounts.google.com");
const COOKIE_TTL_MS = 10 * 60 * 1000;

export const GOOGLE_FLOW_COOKIE = "kantyna_google_flow";
export const GOOGLE_LINK_COOKIE = "kantyna_google_link";

export interface GoogleFlowCookie {
  state: string;
  nonce: string;
  codeVerifier: string;
  redirectUri: string;
}

export interface PendingGoogleLink {
  email: string;
  subject: string;
  name: string;
}

type SealedGoogleCookie =
  | ({ kind: "flow"; expiresAt: number } & GoogleFlowCookie)
  | ({ kind: "link"; expiresAt: number } & PendingGoogleLink);

let cachedConfiguration:
  | { clientId: string; secret: string; promise: Promise<client.Configuration> }
  | null = null;

function googleCredentials(): { clientId: string; secret: string } {
  const settings = getSettings();
  const clientId = settings.googleClientId.trim();
  const secret = settings.googleClientSecret;
  if (!clientId || !secret) throw new Error("Přihlášení přes Google není nastavené.");
  return { clientId, secret };
}

function validateRedirectUri(redirectUri: string): string {
  let url: URL;
  try {
    url = new URL(redirectUri);
  } catch {
    throw new Error("Návratová adresa Google není platná.");
  }
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.hash ||
    url.search
  ) {
    throw new Error("Návratová adresa Google není platná.");
  }
  const localHttp =
    url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && localHttp)) {
    throw new Error("Návratová adresa Google musí používat HTTPS.");
  }
  return url.href;
}

async function getGoogleConfiguration(): Promise<client.Configuration> {
  const credentials = googleCredentials();
  if (
    cachedConfiguration?.clientId === credentials.clientId &&
    cachedConfiguration.secret === credentials.secret
  ) {
    return cachedConfiguration.promise;
  }

  const promise = client.discovery(
    GOOGLE_ISSUER,
    credentials.clientId,
    { client_secret: credentials.secret },
    client.ClientSecretPost(credentials.secret),
    { timeout: 10 }
  );
  cachedConfiguration = { ...credentials, promise };
  try {
    return await promise;
  } catch (error) {
    if (cachedConfiguration?.promise === promise) cachedConfiguration = null;
    throw error;
  }
}

function sealCookie(value: SealedGoogleCookie): string {
  const { secret } = googleCredentials();
  const payload = Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(payload, "ascii").digest("base64url");
  return `${payload}.${signature}`;
}

function openCookie(value: string): SealedGoogleCookie | null {
  try {
    if (typeof value !== "string" || value.length > 4096) return null;
    const parts = value.split(".");
    if (parts.length !== 2 || !parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))) return null;

    const { secret } = googleCredentials();
    const expected = createHmac("sha256", secret).update(parts[0], "ascii").digest();
    const actual = Buffer.from(parts[1], "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

    const parsed = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const cookie = parsed as Partial<SealedGoogleCookie>;
    if (!Number.isSafeInteger(cookie.expiresAt) || (cookie.expiresAt ?? 0) <= Date.now()) return null;
    return cookie as SealedGoogleCookie;
  } catch {
    return null;
  }
}

function isOpaqueValue(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{32,128}$/.test(value);
}

export function sealGoogleFlowCookie(checks: GoogleFlowCookie): string {
  return sealCookie({ kind: "flow", expiresAt: Date.now() + COOKIE_TTL_MS, ...checks });
}

export function readGoogleFlowCookie(value: string): GoogleFlowCookie | null {
  const cookie = openCookie(value);
  if (
    !cookie ||
    cookie.kind !== "flow" ||
    !isOpaqueValue(cookie.state) ||
    !isOpaqueValue(cookie.nonce) ||
    !isOpaqueValue(cookie.codeVerifier)
  ) {
    return null;
  }
  try {
    return {
      state: cookie.state,
      nonce: cookie.nonce,
      codeVerifier: cookie.codeVerifier,
      redirectUri: validateRedirectUri(cookie.redirectUri),
    };
  } catch {
    return null;
  }
}

export function sealPendingGoogleLink(value: PendingGoogleLink): string {
  return sealCookie({ kind: "link", expiresAt: Date.now() + COOKIE_TTL_MS, ...value });
}

export function readPendingGoogleLink(value: string): PendingGoogleLink | null {
  const cookie = openCookie(value);
  if (
    !cookie ||
    cookie.kind !== "link" ||
    typeof cookie.email !== "string" ||
    !cookie.email ||
    cookie.email.length > 254 ||
    typeof cookie.subject !== "string" ||
    !cookie.subject ||
    cookie.subject.length > 255 ||
    typeof cookie.name !== "string" ||
    !cookie.name ||
    cookie.name.length > 200
  ) {
    return null;
  }
  return { email: cookie.email, subject: cookie.subject, name: cookie.name };
}

export function isGoogleConfigured(): boolean {
  const settings = getSettings();
  return !!settings.googleClientId.trim() && !!settings.googleClientSecret;
}

export async function buildGoogleAuthUrl(redirectUri: string): Promise<{
  url: string;
  state: string;
  nonce: string;
  codeVerifier: string;
}> {
  const safeRedirectUri = validateRedirectUri(redirectUri);
  const configuration = await getGoogleConfiguration();
  const codeVerifier = client.randomPKCECodeVerifier();
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
  const state = client.randomState();
  const nonce = client.randomNonce();
  const url = client.buildAuthorizationUrl(configuration, {
    redirect_uri: safeRedirectUri,
    scope: "openid email profile",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    nonce,
  });
  return { url: url.href, state, nonce, codeVerifier };
}

export async function completeGoogleLogin(
  currentUrl: URL,
  checks: GoogleFlowCookie
): Promise<{ email: string; emailVerified: boolean; subject: string; name: string }> {
  if (!(currentUrl instanceof URL) || !checks || typeof checks !== "object") {
    throw new Error("Odpověď Googlu není platná.");
  }
  const redirectUri = validateRedirectUri(checks.redirectUri);
  const actualCallback = new URL(currentUrl.href);
  actualCallback.search = "";
  actualCallback.hash = "";
  if (actualCallback.href !== redirectUri) {
    throw new Error("Návratová adresa Google nesouhlasí se zahájeným přihlášením.");
  }
  if (
    !isOpaqueValue(checks.state) ||
    !isOpaqueValue(checks.nonce) ||
    !isOpaqueValue(checks.codeVerifier)
  ) {
    throw new Error("Přihlášení přes Google vypršelo nebo není platné.");
  }

  const configuration = await getGoogleConfiguration();
  const tokens = await client.authorizationCodeGrant(
    configuration,
    currentUrl,
    {
      pkceCodeVerifier: checks.codeVerifier,
      expectedState: checks.state,
      expectedNonce: checks.nonce,
      idTokenExpected: true,
    },
    { redirect_uri: redirectUri }
  );
  const claims = tokens.claims();
  if (!claims) throw new Error("Google nevrátil ověřenou identitu.");

  const email = claims.email;
  const emailVerified = claims.email_verified;
  const subject = claims.sub;
  const name = claims.name;
  if (emailVerified !== true || typeof email !== "string" || !email || email.length > 254) {
    throw new Error("Google nepotvrdil e-mailovou adresu.");
  }
  if (typeof subject !== "string" || !subject || subject.length > 255) {
    throw new Error("Google nevrátil platný identifikátor účtu.");
  }
  if (typeof name !== "string" || !name.trim() || name.length > 200) {
    throw new Error("Google nevrátil jméno uživatele.");
  }

  return { email, emailVerified: true, subject, name: name.trim() };
}
