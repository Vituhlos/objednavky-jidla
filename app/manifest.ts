import type { MetadataRoute } from "next";
import { PWA_ICONS } from "@/lib/pwa-assets";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kantýna",
    short_name: "Kantýna",
    description: "Objednávkový systém obědů a pizzy",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f4ef",
    theme_color: "#f8f4ef",
    orientation: "any",
    // Nabídka po dlouhém podržení ikony na ploše.
    shortcuts: [
      { name: "Dnešní objednávka", short_name: "Oběd", url: "/" },
      { name: "Jídelníček", short_name: "Jídelníček", url: "/jidelnicek" },
      { name: "Připomínky", short_name: "Nápady", url: "/pripominky" },
    ].map((s) => ({ ...s, icons: [{ src: "/pwa-icon/192", sizes: "192x192", type: "image/png" }] })),
    icons: PWA_ICONS.map(({ variant, size, maskable }) => ({
      src: `/pwa-icon/${variant}`,
      sizes: `${size}x${size}`,
      type: "image/png",
      purpose: maskable ? "maskable" : "any",
    })),
  };
}
