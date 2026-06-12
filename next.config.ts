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
};

export default nextConfig;
