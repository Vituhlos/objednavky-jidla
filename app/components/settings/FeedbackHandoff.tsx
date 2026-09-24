"use client";

import { useState } from "react";
import { buildAiPrompt, buildGithubIssueUrl, GITHUB_REPO_URL } from "@/lib/feedback-export";
import type { FeedbackEntry } from "@/lib/feedback-meta";
import MIcon from "../MIcon";
import { copyText } from "./copy-text";

/**
 * Předání připomínky k řešení: zadání pro AI do schránky, nebo nový úkol na
 * GitHubu. Interní poznámka jde jen do schránky, na veřejný GitHub ne.
 */
export function FeedbackHandoff({ entry }: { entry: FeedbackEntry }) {
  const [copied, setCopied] = useState(false);
  const [manualText, setManualText] = useState<string | null>(null);

  const copy = async () => {
    const text = buildAiPrompt(entry);
    if (await copyText(text)) {
      setManualText(null);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } else {
      setManualText(text);
    }
  };

  return (
    <div className="modal-field">
      <span className="modal-label">Předat k řešení</span>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-2xl glass-btn text-stone-600"
          onClick={copy}
          type="button"
        >
          <MIcon name={copied ? "check" : "smart_toy"} size={14} />
          {copied ? "Zkopírováno" : "Zkopírovat pro AI"}
        </button>
        {entry.githubIssue ? (
          <a
            className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-2xl glass-btn text-stone-600"
            href={`${GITHUB_REPO_URL}/issues/${entry.githubIssue}`}
            rel="noopener noreferrer"
            target="_blank"
          >
            <MIcon name={entry.githubIssueState === "closed" ? "check_circle" : "link"} size={14} />
            Úkol #{entry.githubIssue}
            <span className="font-normal text-stone-400">{entry.githubIssueState === "closed" ? "uzavřený" : "otevřený"}</span>
          </a>
        ) : (
          <a
            className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-2xl glass-btn text-stone-600"
            href={buildGithubIssueUrl(entry)}
            rel="noopener noreferrer"
            target="_blank"
          >
            <MIcon name="link" size={14} />
            Založit úkol na GitHubu
          </a>
        )}
      </div>
      {manualText !== null ? (
        <>
          <p className="text-[11.5px] text-red-500" role="alert">Prohlížeč kopírování nedovolil. Text je v poli níž, stačí Ctrl+A a Ctrl+C.</p>
          <textarea
            aria-label="Zadání pro AI"
            className="modal-note font-mono text-[11.5px]"
            onFocus={(e) => e.currentTarget.select()}
            readOnly
            rows={8}
            value={manualText}
          />
        </>
      ) : entry.githubIssueState === "closed" && entry.status !== "done" && entry.status !== "rejected" ? (
        <p className="text-[11.5px] text-amber-700 inline-flex items-start gap-1.5 leading-snug">
          <MIcon name="info" size={13} className="mt-0.5 shrink-0" />
          Úkol je na GitHubu uzavřený. Až bude oprava nasazená, označte připomínku jako Hotovo a napište odpověď.
        </p>
      ) : (
        <p className="text-[11px] text-stone-400 leading-snug">
          {entry.githubIssue
            ? "Zadání vložte do Claude Code nebo Codexu, klidně s odkazem na úkol."
            : "Zadání vložte do Claude Code nebo Codexu. Úkol na GitHubu je veřejný, před uložením projděte text. Číslo úkolu se sem pak doplní samo."}
        </p>
      )}
    </div>
  );
}
