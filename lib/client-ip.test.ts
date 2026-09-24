import { describe, expect, it } from "vitest";
import { getClientIpFromHeaders } from "./api-auth";

const h = (init: Record<string, string>) => new Headers(init);

describe("getClientIpFromHeaders", () => {
  it("za Cloudflarem věří CF-Connecting-IP, ne tomu, co si návštěvník napsal do X-Forwarded-For", () => {
    expect(getClientIpFromHeaders(h({
      "cf-connecting-ip": "198.51.100.7",
      "x-forwarded-for": "1.2.3.4, 198.51.100.7",
    }))).toBe("198.51.100.7");
  });

  it("podvržená první položka X-Forwarded-For nerozhoduje — bere se poslední, kterou připsala proxy", () => {
    expect(getClientIpFromHeaders(h({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("zvládne IPv6 a jednu adresu", () => {
    expect(getClientIpFromHeaders(h({ "cf-connecting-ip": "2001:db8::1" }))).toBe("2001:db8::1");
    expect(getClientIpFromHeaders(h({ "x-forwarded-for": "10.0.0.5" }))).toBe("10.0.0.5");
  });

  it("nesmysl v hlavičce ignoruje", () => {
    expect(getClientIpFromHeaders(h({ "cf-connecting-ip": "<script>", "x-forwarded-for": "10.0.0.5" }))).toBe("10.0.0.5");
    expect(getClientIpFromHeaders(h({ "x-forwarded-for": "nesmysl" }))).toBe("local");
    expect(getClientIpFromHeaders(h({}))).toBe("local");
  });
});
