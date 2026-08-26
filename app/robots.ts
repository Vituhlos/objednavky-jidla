import type { MetadataRoute } from "next";

/**
 * Aplikace se nemá indexovat.
 *
 * Čtení je veřejné schválně (R1) — vrátná musí vidět počty, aniž by měla účet.
 * Veřejné pro toho, kdo zná adresu, ale není totéž co veřejné pro vyhledávače:
 * jména kolegů ve výsledcích hledání nikdo nechce.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
