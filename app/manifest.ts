import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Objednávky LIMA",
    short_name: "Objednávky",
    description: "Objednávkový systém obědů a pizzy",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f9fb",
    theme_color: "#32ADE6",
    orientation: "any",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
