import fs from "node:fs";

const version = process.argv[2]?.replace(/^v/, "");
if (!version) {
  console.error("Usage: node tools/extract-release-notes.mjs vX.Y.Z");
  process.exit(1);
}

const changelog = fs.readFileSync("CHANGELOG.md", "utf8");
const heading = `## [${version}]`;
const start = changelog.indexOf(heading);

if (start === -1) {
  console.log(`Release notes for v${version} were not found in CHANGELOG.md.`);
  console.log("");
  console.log("See CHANGELOG.md for the full release history.");
  process.exit(0);
}

const rest = changelog.slice(start);
const next = rest.slice(heading.length).search(/\n## \[/);
const section = next === -1 ? rest : rest.slice(0, heading.length + next);

console.log(section.trim());
