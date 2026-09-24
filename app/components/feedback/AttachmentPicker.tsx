"use client";

import { useRef } from "react";
import { FEEDBACK_ATTACHMENT_LIMITS, FEEDBACK_ATTACHMENT_TYPES } from "@/lib/feedback-meta";
import MIcon from "../MIcon";
import type { PendingAttachment } from "./useAttachments";

/**
 * Screenshoty k připomínce: náhledy s křížkem a dlaždice pro přidání.
 * Přetažení a vložení přes Ctrl+V obsluhuje FeedbackComposer pro celou stránku,
 * tady je jen výběr souboru — ten jediný funguje i na mobilu.
 */
export function AttachmentPicker({
  items,
  busy,
  notice,
  onAdd,
  onRemove,
}: {
  items: PendingAttachment[];
  busy: boolean;
  notice: string | null;
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const canAdd = items.length < FEEDBACK_ATTACHMENT_LIMITS.maxFiles;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="modal-label">
        Screenshot <span className="modal-label-price">nepovinný, nejvýš {FEEDBACK_ATTACHMENT_LIMITS.maxFiles}</span>
      </span>

      <div className="flex gap-2 flex-wrap">
        {items.map((item, i) => (
          <div key={item.id} className="fb-thumb fade-up">
            {/* eslint-disable-next-line @next/next/no-img-element -- blob: URL, next/image s ním nepracuje */}
            <img alt={`Obrázek ${i + 1}`} src={item.url} />
            <button aria-label={`Odebrat obrázek ${i + 1}`} className="fb-thumb__remove" onClick={() => onRemove(item.id)} type="button">
              <MIcon name="close" size={14} />
            </button>
          </div>
        ))}

        {canAdd && (
          <button
            className={`fb-drop${items.length > 0 ? " fb-drop--compact" : ""}`}
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            type="button"
          >
            <span aria-hidden="true" className="emoji text-[20px] leading-none">{busy ? "⏳" : "📸"}</span>
            {items.length === 0 ? (
              <span className="flex flex-col items-start text-left">
                <span className="text-[12.5px] font-semibold text-stone-700">{busy ? "Připravuji obrázek…" : "Přidat obrázek"}</span>
                <span className="text-[11.5px] text-stone-400 hidden md:block">Nebo ho sem přetáhni či vlož přes Ctrl+V.</span>
              </span>
            ) : (
              <span className="text-[11.5px] font-semibold text-stone-500">{busy ? "…" : "Další"}</span>
            )}
          </button>
        )}
      </div>

      {notice && <p className="text-[11.5px] text-amber-700" role="status">{notice}</p>}

      <input
        ref={inputRef}
        accept={FEEDBACK_ATTACHMENT_TYPES.join(",")}
        className="sr-only"
        multiple
        onChange={(e) => {
          onAdd(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
        tabIndex={-1}
        type="file"
      />
    </div>
  );
}
