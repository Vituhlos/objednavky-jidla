import { execFileSync } from "node:child_process";

const baseRef = process.env.BASE_REF || process.argv[2];
if (!baseRef) {
  console.error("BASE_REF is required.");
  process.exit(1);
}

const diffBase = `origin/${baseRef}...HEAD`;
const changed = execFileSync("git", ["diff", "--name-only", diffBase], { encoding: "utf8" })
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);

const changelogChanged = changed.includes("CHANGELOG.md");
const releaseNotesChanged = changed.includes("lib/release-notes.ts");

const productPaths = [
  "app/",
  "lib/",
  "public/",
  "Dockerfile",
  "next.config.ts",
  "package.json",
  "package-lock.json",
  ".github/workflows/",
];

const ignoredProductFiles = new Set([
  "lib/release-notes.ts",
]);

const productChanged = changed.some((file) => {
  if (ignoredProductFiles.has(file)) return false;
  return productPaths.some((prefix) => file === prefix || file.startsWith(prefix));
});

if (productChanged && !changelogChanged && !releaseNotesChanged) {
  console.error("Product-impacting files changed without CHANGELOG.md or lib/release-notes.ts.");
  console.error("Changed files:");
  for (const file of changed) console.error(`- ${file}`);
  console.error("");
  console.error("Add a CHANGELOG.md entry, update lib/release-notes.ts for user-visible release notes, or document why this PR has no release impact.");
  process.exit(1);
}

console.log("Changelog check passed.");
