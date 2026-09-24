"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * Text zkrácený na pár řádků s „celý text“. Rozbalení i sbalení plynule
 * změní výšku (měří se skutečná výška před a po), bez skoku.
 */
export function ExpandableText({ text, lines = 3 }: { text: string; lines?: number }) {
  const [open, setOpen] = useState(false);
  const [clamped, setClamped] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);
  const prevHeight = useRef<number | null>(null);

  // Tlačítko jen když se text opravdu nevejde
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && !open) setClamped(el.scrollHeight > el.clientHeight + 1);
  }, [text, open]);

  useLayoutEffect(() => {
    const el = ref.current;
    const from = prevHeight.current;
    prevHeight.current = null;
    if (!el || from === null || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const to = el.getBoundingClientRect().height;
    el.animate([{ height: `${from}px` }, { height: `${to}px` }], { duration: 260, easing: "cubic-bezier(.2,.8,.2,1)" });
  }, [open]);

  const toggle = () => {
    prevHeight.current = ref.current?.getBoundingClientRect().height ?? null;
    setOpen((v) => !v);
  };

  return (
    <div>
      <p
        ref={ref}
        className="text-[12.5px] text-stone-800 leading-snug whitespace-pre-line break-words overflow-hidden"
        style={open ? undefined : { display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: lines }}
      >
        {text}
      </p>
      {(clamped || open) && (
        <button className="text-[11.5px] font-semibold text-amber-700 hover:text-amber-800 mt-0.5" onClick={toggle} type="button">
          {open ? "Méně" : "Celý text"}
        </button>
      )}
    </div>
  );
}
