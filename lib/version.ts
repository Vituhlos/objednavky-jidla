export type AppVersionInfo = {
  name: string;
  version: string;
  commitSha: string;
  shortCommitSha: string;
  buildDate: string;
  releaseChannel: string;
  gitRef: string;
  dockerTag: string;
  nodeEnv: string;
};

function clean(value: string | undefined): string {
  return value?.trim() ?? "";
}

export function getAppVersionInfo(): AppVersionInfo {
  const commitSha = clean(process.env.NEXT_PUBLIC_COMMIT_SHA || process.env.COMMIT_SHA);
  const releaseChannel = clean(process.env.NEXT_PUBLIC_RELEASE_CHANNEL || process.env.RELEASE_CHANNEL)
    || (process.env.NODE_ENV === "production" ? "stable" : "dev");

  return {
    name: "Kantýna",
    version: clean(process.env.NEXT_PUBLIC_APP_VERSION || process.env.APP_VERSION || process.env.npm_package_version) || "1.0.0",
    commitSha,
    shortCommitSha: commitSha ? commitSha.slice(0, 7) : "",
    buildDate: clean(process.env.NEXT_PUBLIC_BUILD_DATE || process.env.BUILD_DATE),
    releaseChannel,
    gitRef: clean(process.env.NEXT_PUBLIC_GIT_REF || process.env.GIT_REF),
    dockerTag: clean(process.env.NEXT_PUBLIC_DOCKER_TAG || process.env.DOCKER_TAG),
    nodeEnv: clean(process.env.NODE_ENV) || "development",
  };
}
