"use client";

import { useRef } from "react";
import { getInitials } from "@/lib/format";
import { FEEDBACK_LIMITS } from "@/lib/feedback-meta";

/**
 * Podpis: vlastní jméno, nebo anonymně. Dvě „pilulky“ místo pole s přepínačem —
 * je hned vidět, pod čím připomínka odejde.
 */
export function SignaturePicker({
  name,
  anonymous,
  onNameChange,
  onAnonymousChange,
}: {
  name: string;
  anonymous: boolean;
  onNameChange: (name: string) => void;
  onAnonymousChange: (anonymous: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const initials = name.trim() ? getInitials(name) : "";

  return (
    <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Podpis">
      <label
        className={`fb-sign${anonymous ? "" : " fb-sign--active"}`}
        onClick={() => { onAnonymousChange(false); inputRef.current?.focus(); }}
      >
        <span aria-hidden="true" className={`fb-sign__avatar${initials ? "" : " fb-sign__avatar--muted"}`}>
          {initials || <span className="emoji">👤</span>}
        </span>
        <span className="sr-only">Poslat pod jménem</span>
        <input
          ref={inputRef}
          autoComplete="name"
          maxLength={FEEDBACK_LIMITS.nameMax}
          onChange={(e) => { onNameChange(e.target.value); onAnonymousChange(false); }}
          placeholder="Tvoje jméno"
          type="text"
          value={name}
        />
      </label>
      <button
        aria-pressed={anonymous}
        className={`fb-sign${anonymous ? " fb-sign--active" : ""}`}
        onClick={() => onAnonymousChange(!anonymous)}
        type="button"
      >
        <span aria-hidden="true" className="fb-sign__avatar fb-sign__avatar--muted"><span className="emoji">🕶️</span></span>
        Bez jména
      </button>
    </div>
  );
}
