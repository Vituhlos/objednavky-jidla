"use client";

import { useState } from "react";
import MIcon from "./MIcon";

export default function CopyBuildButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 font-semibold rounded-full glass-btn text-stone-600 text-[11px] px-2.5 py-1"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* ignore */
        }
      }}
      title="Zkopírovat verzi"
    >
      <MIcon name="upload_file" size={12} />
      {copied ? "Zkopírováno" : "Kopírovat"}
    </button>
  );
}
