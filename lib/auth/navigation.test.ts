import { describe, expect, it } from "vitest";
import { safeInternalPath } from "./navigation";
import { validateCanonicalAppOrigin } from "./app-url";

describe("bezpečný návrat po přihlášení", () => {
  it("ponechá běžnou interní cestu", () => {
    expect(safeInternalPath("/ucet?sekce=sezeni")).toBe("/ucet?sekce=sezeni");
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/%5cevil.example",
    "/javascript:alert(1)",
  ])("odmítne externí nebo nejednoznačný cíl %s", (value) => {
    expect(safeInternalPath(value)).toBe("/");
  });
});

describe("kanonická veřejná adresa", () => {
  it("v produkci přijme jen čistý HTTPS origin", () => {
    expect(validateCanonicalAppOrigin("https://obedy.example.com/", true)).toBe(
      "https://obedy.example.com"
    );
    for (const value of [
      "http://obedy.example.com",
      "https://user:pass@obedy.example.com",
      "https://obedy.example.com/cesta",
      "https://obedy.example.com?cil=jiny",
    ]) {
      expect(() => validateCanonicalAppOrigin(value, true)).toThrow();
    }
  });

  it("HTTP povolí jen lokálnímu vývoji", () => {
    expect(validateCanonicalAppOrigin("http://localhost:3000", false)).toBe(
      "http://localhost:3000"
    );
    expect(() => validateCanonicalAppOrigin("http://192.168.1.10:3000", false)).toThrow();
  });
});
