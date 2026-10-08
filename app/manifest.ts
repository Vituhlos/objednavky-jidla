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
    icons: PWA_ICONS.map(({ variant, size, maskable }) => ({
      src: `/pwa-icon/${variant}`,
      sizes: `${size}x${size}`,
      type: "image/png",
      purpose: maskable ? "maskable" : "any",
    })),
  };
}
