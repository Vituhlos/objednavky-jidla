import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kantýna",
    short_name: "Kantýna",
    description: "Objednávkový systém obědů a pizzy",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f9fb",
    theme_color: "#EA580C",
    orientation: "any",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
    shortcuts: [
      { name: "Dnešní objednávka", short_name: "Oběd", url: "/" },
      { name: "Jídelníček", short_name: "Menu", url: "/jidelnicek" },
      { name: "Historie", short_name: "Historie", url: "/historie" },
      { name: "Profil", short_name: "Profil", url: "/profil" },
    ],
  };
}
