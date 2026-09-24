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
export function FeedbackAttachments({
  feedbackId,
  attachments,
  getPin,
}: {
  feedbackId: number;
  attachments: FeedbackAttachment[];
  getPin: () => string;
}) {
  const [urls, setUrls] = useState<Record<number, string>>({});
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [downloading, setDownloading] = useState(false);
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
      <span className="modal-label flex items-center gap-2">
        Screenshoty
        {!failed && Object.keys(urls).length === attachments.length && (
          <button
            className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-amber-700 hover:text-amber-800 disabled:opacity-50"
            disabled={downloading}
            onClick={async () => {
              setDownloading(true);
              try {
                await downloadAsPng(attachments.map((a) => urls[a.id]), feedbackId);
              } finally {
                setDownloading(false);
              }
            }}
            type="button"
          >
            <MIcon name="download" size={13} />
            {attachments.length === 1 ? "Stáhnout" : "Stáhnout vše"}
          </button>
        )}
      </span>
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

/**
 * Uloží screenshoty jako PNG. Na disku jsou ve WebP (menší, bez metadat), ale
 * PNG vezme bez řečí GitHub, Claude Code, Codex i Malování. Převod dělá
 * prohlížeč přes canvas, takže server se znovu neptá.
 */
async function downloadAsPng(urls: string[], feedbackId: number): Promise<void> {
  for (const [i, url] of urls.entries()) {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext("2d")?.drawImage(img, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) continue;
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = urls.length === 1 ? `pripominka-${feedbackId}.png` : `pripominka-${feedbackId}-${i + 1}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Chrome potřebuje mezi stahováními chvilku, jinak pustí jen první soubor
    await new Promise((r) => setTimeout(r, 250));
    URL.revokeObjectURL(href);
  }
}
