import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["better-sqlite3", "pdf-parse", "nodemailer", "pdfkit"],
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.APP_VERSION ?? process.env.npm_package_version ?? "1.0.0",
    NEXT_PUBLIC_COMMIT_SHA: process.env.COMMIT_SHA ?? "",
    NEXT_PUBLIC_BUILD_DATE: process.env.BUILD_DATE ?? "",
    NEXT_PUBLIC_RELEASE_CHANNEL: process.env.RELEASE_CHANNEL ?? (process.env.NODE_ENV === "production" ? "stable" : "dev"),
    NEXT_PUBLIC_GIT_REF: process.env.GIT_REF ?? "",
    NEXT_PUBLIC_DOCKER_TAG: process.env.DOCKER_TAG ?? "",
  },
  async headers() {
    return [
      {
        // Veřejné pro toho, kdo zná adresu, není totéž co veřejné pro Google.
        // Čtení zůstává otevřené záměrně (R1), ale jména kolegů nemá nic
        // indexovat. Hlavička platí i tam, kam robots.txt nedosáhne.
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        // Emoji font slices and the generated emoji list never change in place —
        // a new build ships new files. Without this, Next serves everything under
        // public/ with max-age=0 and the browser re-validates them on every visit.
        source: "/:path(fonts/.*\\.woff2|fonts/noto-color-emoji\\.css|emoji\\.json)",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
