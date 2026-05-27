import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["better-sqlite3", "pdf-parse", "nodemailer", "pdfkit"],
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.SEMVER ?? process.env.npm_package_version ?? "0.0.0",
    NEXT_PUBLIC_COMMIT_SHA: process.env.COMMIT_SHA ?? "",
    NEXT_PUBLIC_GIT_REF: process.env.GIT_REF ?? "",
    NEXT_PUBLIC_BUILD_TIME: process.env.BUILD_TIME ?? "",
  },
};

export default nextConfig;
