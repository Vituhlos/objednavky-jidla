"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { FeedbackAttachment } from "@/lib/feedback-meta";
import MIcon from "../MIcon";

/**
 * Screenshoty u připomínky v Nastavení.
 *
 * Obrázky nejsou veřejné: stahují se s PINem v hlavičce a zobrazují přes
 * blob: URL. Obyčejné <img src> by PIN poslat neumělo.
 */
export function FeedbackAttachments({ attachments, getPin }: { attachments: FeedbackAttachment[]; getPin: () => string }) {
  const [urls, setUrls] = useState<Record<number, string>>({});
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  // Po uložení poznámky přijde nové pole se stejnými přílohami — stahovat
  // znovu jen když se opravdu změní, které to jsou.
  const idsKey = attachments.map((a) => a.id).join(",");

  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];
    const ids = idsKey ? idsKey.split(",").map(Number) : [];
    Promise.all(ids.map(async (id) => {
      const res = await fetch(`/api/feedback/attachments/${id}`, { headers: { "x-settings-pin": getPin() } });
      if (!res.ok) throw new Error(String(res.status));
      const url = URL.createObjectURL(await res.blob());
      created.push(url);
      return [id, url] as const;
    }))
      .then((pairs) => { if (!cancelled) setUrls(Object.fromEntries(pairs)); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => {
      cancelled = true;
      created.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [idsKey, getPin]);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (attachments.length === 0) return null;

  return (
    <div className="modal-field">
      <span className="modal-label">Screenshoty</span>
      {failed ? (
        <p className="text-[12px] text-red-500">Obrázky se nepodařilo načíst.</p>
      ) : (
        <div className="flex gap-2 flex-wrap">
          {attachments.map((a, i) => (
            <button
              key={a.id}
              aria-label={`Zvětšit obrázek ${i + 1}`}
              className="fb-thumb !w-[112px] !h-[84px] hover:shadow-lg transition-shadow"
              onClick={() => setOpen(a.id)}
              type="button"
            >
              {urls[a.id]
                // eslint-disable-next-line @next/next/no-img-element -- blob: URL, next/image s ním nepracuje
                ? <img alt={`Obrázek ${i + 1}`} src={urls[a.id]} />
                : <span className="w-full h-full flex items-center justify-center text-stone-300"><MIcon name="refresh" size={18} /></span>}
            </button>
          ))}
        </div>
      )}

      {open !== null && urls[open] && createPortal(
        <div className="modal-overlay" onClick={() => setOpen(null)} role="dialog" aria-modal="true" aria-label="Screenshot">
          <div className="relative scale-in" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element -- blob: URL */}
            <img
              alt="Screenshot v plné velikosti"
              className="block max-w-[92vw] max-h-[86vh] rounded-2xl shadow-2xl"
              src={urls[open]}
            />
            <button
              aria-label="Zavřít"
              className="absolute -top-3 -right-3 w-10 h-10 rounded-full glass-btn inline-flex items-center justify-center text-stone-600"
              onClick={() => setOpen(null)}
              type="button"
            >
              <MIcon name="close" size={18} />
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
