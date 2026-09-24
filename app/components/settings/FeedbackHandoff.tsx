"use client";

import { useState } from "react";
import { buildAiPrompt, buildGithubIssueUrl } from "@/lib/feedback-export";
import type { FeedbackEntry } from "@/lib/feedback-meta";
import MIcon from "../MIcon";
import { copyText } from "./copy-text";

/**
 * Předání připomínky k řešení: zadání pro AI do schránky, nebo nový úkol na
 * GitHubu. Ani jedno neobsahuje jméno autora; interní poznámka jde jen do schránky.
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
      <span className="modal-label">
        Předat k řešení <span className="modal-label-price">bez jména autora</span>
      </span>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-2xl glass-btn text-stone-600"
          onClick={copy}
          type="button"
        >
          <MIcon name={copied ? "check" : "smart_toy"} size={14} />
          {copied ? "Zkopírováno" : "Zkopírovat pro AI"}
        </button>
        <a
          className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-2xl glass-btn text-stone-600"
          href={buildGithubIssueUrl(entry)}
          rel="noopener noreferrer"
          target="_blank"
        >
          <MIcon name="link" size={14} />
          Založit úkol na GitHubu
        </a>
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
      ) : (
        <p className="text-[11px] text-stone-400 leading-snug">
          Zadání vložte do Claude Code nebo Codexu. Úkol na GitHubu je veřejný, před uložením projděte text.
        </p>
      )}
    </div>
  );
}
