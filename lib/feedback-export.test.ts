import { describe, expect, it } from "vitest";
import { buildAiPrompt, buildGithubIssueUrl, GITHUB_REPO_URL } from "./feedback-export";
import type { FeedbackEntry } from "./feedback-meta";

const entry: FeedbackEntry = {
  id: 42,
  createdAt: "2026-09-24 07:15:00",
  category: "chyba",
  message: "Po uložení řádku zmizí poznámka.\nStalo se to dvakrát.",
  authorName: "Jana Nováková",
  page: "/",
  device: "mobil",
  status: "new",
  adminNote: "Asi optimistický update v DepartmentPanel.",
  publicReply: "",
  resolvedAt: null,
  attachments: [{ id: 1, width: 800, height: 600, size: 1000 }],
  context: "digest 123`abc",
  appVersion: "1.5.0",
  votable: false,
  voteTitle: "",
  votes: 0,
};

function issueParams(url: string) {
  expect(url.startsWith(`${GITHUB_REPO_URL}/issues/new?`)).toBe(true);
  return new URL(url).searchParams;
}

describe("buildAiPrompt", () => {
  it("obsahuje text, údaje a interní poznámku, ale ne jméno autora", () => {
    const text = buildAiPrompt(entry);
    expect(text).toContain("Připomínka #42");
    expect(text).toContain("> Po uložení řádku zmizí poznámka.\n> Stalo se to dvakrát.");
    expect(text).toContain("Verze aplikace: v1.5.0");
    expect(text).toContain("Stránka: /");
    expect(text).toContain("Screenshoty: 1");
    expect(text).toContain("Asi optimistický update");
    expect(text).not.toContain("Jana");
  });

  it("nerozbije formátování zpětným apostrofem v technickém údaji", () => {
    expect(buildAiPrompt(entry)).toContain("`digest 123'abc`");
  });

  it("vynechá prázdnou poznámku", () => {
    expect(buildAiPrompt({ ...entry, adminNote: "  " })).not.toContain("Moje poznámka");
  });
});

describe("buildGithubIssueUrl", () => {
  it("předvyplní název i text a vynechá jméno autora a interní poznámku", () => {
    const params = issueParams(buildGithubIssueUrl(entry));
    expect(params.get("title")).toBe("🐞 Chyba: Po uložení řádku zmizí poznámka.");
    const body = params.get("body") ?? "";
    expect(body).toContain("> Stalo se to dvakrát.");
    expect(body).toContain("Verze aplikace: v1.5.0");
    expect(body).not.toContain("Jana");
    expect(body).not.toContain("optimistický");
  });

  it("dlouhý text zkrátí tak, aby se adresa vešla do limitu", () => {
    const url = buildGithubIssueUrl({ ...entry, message: "Dlouhá věta s diakritikou. ".repeat(600) });
    expect(url.length).toBeLessThanOrEqual(7500);
    expect(issueParams(url).get("body")).toContain("(zkráceno, celý text je v Nastavení)");
  });

  it("zkrátí i dlouhý první řádek v názvu", () => {
    const title = issueParams(buildGithubIssueUrl({ ...entry, message: "x".repeat(200) })).get("title") ?? "";
    expect(title.length).toBeLessThan(90);
    expect(title.endsWith("…")).toBe(true);
  });
});
