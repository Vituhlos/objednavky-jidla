export function safeInternalPath(raw: string | string[] | undefined): string {
  if (typeof raw !== "string" || raw.length > 2048) return "/";
  if (
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    raw.includes("\\") ||
    /%5c/i.test(raw) ||
    /[\u0000-\u001f\u007f]/.test(raw) ||
    raw.includes(":")
  ) {
    return "/";
  }

  try {
    const base = new URL("https://kantyna.invalid");
    const parsed = new URL(raw, base);
    return parsed.origin === base.origin ? raw : "/";
  } catch {
    return "/";
  }
}
