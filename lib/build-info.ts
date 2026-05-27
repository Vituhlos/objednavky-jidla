export type BuildInfo = {
  appVersion: string;
  commitSha: string;
  commitShort: string | null;
  gitRef: string;
  buildTime: string;
  displayString: string;
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function shortSha(sha: string): string | null {
  const s = sha.trim();
  if (!s) return null;
  return s.length > 7 ? s.slice(0, 7) : s;
}

export function getBuildInfo(): BuildInfo {
  const appVersion = clean(process.env.NEXT_PUBLIC_APP_VERSION) || "0.0.0";
  const commitSha = clean(process.env.NEXT_PUBLIC_COMMIT_SHA);
  const gitRef = clean(process.env.NEXT_PUBLIC_GIT_REF);
  const buildTime = clean(process.env.NEXT_PUBLIC_BUILD_TIME);

  const commitShort = shortSha(commitSha);

  const parts = [
    `v${appVersion}`,
    commitShort ? `sha ${commitShort}` : null,
    gitRef ? gitRef : null,
    buildTime ? buildTime : null,
  ].filter(Boolean) as string[];

  return {
    appVersion,
    commitSha,
    commitShort,
    gitRef,
    buildTime,
    displayString: parts.join(" · "),
  };
}
