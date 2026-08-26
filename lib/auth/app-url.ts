import { getSettings } from "../settings";

export function validateCanonicalAppOrigin(
  configured: string,
  production = process.env.NODE_ENV === "production"
): string {
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new Error("Veřejná adresa aplikace není platná.");
  }

  const localHttp =
    url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !(localHttp && !production)) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== "/" && url.pathname !== "")
  ) {
    throw new Error("Veřejná adresa aplikace není platná nebo nepoužívá HTTPS.");
  }

  return url.origin;
}

export function getCanonicalAppOrigin(): string {
  const configured = process.env.APP_URL?.trim() || getSettings().telegramAppUrl.trim();
  if (!configured) throw new Error("Pro odesílání odkazů nastavte APP_URL.");
  return validateCanonicalAppOrigin(configured);
}
