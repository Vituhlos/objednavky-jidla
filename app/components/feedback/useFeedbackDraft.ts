"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FeedbackCategory } from "@/lib/feedback-meta";
import { parseDraft } from "./feedback-utils";

const DRAFT_KEY = "feedbackDraft";

/**
 * Rozepsaná připomínka přežije odchod ze stránky i zavření prohlížeče.
 *
 * Koncept se čte až po hydrataci — localStorage na serveru není
 * a první render musí sedět s HTML ze serveru. Zápis jde s krátkým
 * zpožděním, ať se neukládá na každé písmeno.
 */
export function useFeedbackDraft(prefillCategory?: FeedbackCategory | null) {
  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [message, setMessage] = useState("");
  const [restored, setRestored] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const draft = parseDraft(localStorage.getItem(DRAFT_KEY));
      /* eslint-disable react-hooks/set-state-in-effect -- jednorázové načtení z prohlížeče po hydrataci */
      if (draft) {
        setCategory(draft.category);
        setMessage(draft.message);
        setRestored(Boolean(draft.message.trim()));
      }
      // Odkaz „Nahlásit problém“ ví, o co jde, líp než starý koncept
      if (prefillCategory) setCategory(prefillCategory);
      /* eslint-enable react-hooks/set-state-in-effect */
    } catch { /* soukromý režim apod. – prostě bez konceptu */ }
    hydrated.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- jen při prvním načtení
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    const id = setTimeout(() => {
      try {
        if (!category && !message.trim()) localStorage.removeItem(DRAFT_KEY);
        else localStorage.setItem(DRAFT_KEY, JSON.stringify({ category, message }));
      } catch { /* */ }
    }, 400);
    return () => clearTimeout(id);
  }, [category, message]);

  const clearDraft = useCallback(() => {
    setMessage("");
    setCategory(null);
    setRestored(false);
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* */ }
  }, []);

  return { category, setCategory, message, setMessage, restored, clearDraft };
}
