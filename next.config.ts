import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["better-sqlite3", "pdf-parse", "nodemailer", "pdfkit"],
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version ?? "1.0.0",
    NEXT_PUBLIC_COMMIT_SHA: process.env.COMMIT_SHA ?? "",
    NEXT_PUBLIC_PROD_URL: process.env.PROD_URL ?? "",
  },
};

export default nextConfig;
