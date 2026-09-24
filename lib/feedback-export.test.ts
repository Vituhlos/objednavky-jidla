import { describe, expect, it } from "vitest";
import { buildAiPrompt, buildGithubIssueUrl, feedbackIssueMarker, GITHUB_REPO_URL, parseFeedbackIssueMarker } from "./feedback-export";
import type { FeedbackEntry } from "./feedback-meta";

const entry: FeedbackEntry = {
  id: 42,
  createdAt: "2026-09-24 07:15:00",
  category: "chyba",
  message: "Po uložení řádku zmizí poznámka.\nStalo se to dvakrát.",
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
  isPublic: false,
  isProposal: false,
  hidden: false,
  up: 0,
  down: 0,
  githubIssue: null,
  githubIssueState: "",
};

function issueParams(url: string) {
  expect(url.startsWith(`${GITHUB_REPO_URL}/issues/new?`)).toBe(true);
  return new URL(url).searchParams;
}

describe("buildAiPrompt", () => {
  it("obsahuje text, údaje a interní poznámku", () => {
    const text = buildAiPrompt(entry);
    expect(text).toContain("Připomínka #42");
    expect(text).toContain("> Po uložení řádku zmizí poznámka.\n> Stalo se to dvakrát.");
    expect(text).toContain("Verze aplikace: v1.5.0");
    expect(text).toContain("Stránka: /");
    expect(text).toContain("Screenshoty: 1");
    expect(text).toContain("Asi optimistický update");
  });

  it("nerozbije formátování zpětným apostrofem v technickém údaji", () => {
    expect(buildAiPrompt(entry)).toContain("`digest 123'abc`");
  });

  it("vynechá prázdnou poznámku", () => {
    expect(buildAiPrompt({ ...entry, adminNote: "  " })).not.toContain("Moje poznámka");
  });
});

describe("buildGithubIssueUrl", () => {
  it("předvyplní název i text a vynechá interní poznámku", () => {
    const params = issueParams(buildGithubIssueUrl(entry));
    expect(params.get("title")).toBe("🐞 Chyba: Po uložení řádku zmizí poznámka.");
    const body = params.get("body") ?? "";
    expect(body).toContain("> Stalo se to dvakrát.");
    expect(body).toContain("Verze aplikace: v1.5.0");
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

describe("značka úkolu", () => {
  it("je v textu úkolu a jde zpátky přečíst", () => {
    const body = issueParams(buildGithubIssueUrl(entry)).get("body") ?? "";
    expect(body).toContain(feedbackIssueMarker(entry));
    expect(parseFeedbackIssueMarker(body)).toEqual({ id: 42, createdAt: "2026-09-24 07:15:00" });
  });

  it("přežije úpravu textu kolem a odmítne poškozenou značku", () => {
    expect(parseFeedbackIssueMarker("Upraveno.\n<!--kantyna-feedback:7@2026-01-02T03:04:05-->")).toEqual({ id: 7, createdAt: "2026-01-02 03:04:05" });
    expect(parseFeedbackIssueMarker("<!-- kantyna-feedback: 7 -->")).toBeNull();
    expect(parseFeedbackIssueMarker(null)).toBeNull();
  });
});

