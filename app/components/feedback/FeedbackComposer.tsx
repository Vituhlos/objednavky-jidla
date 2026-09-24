"use client";

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { FEEDBACK_LIMITS, getCategoryMeta, isPublicCategory, type FeedbackCategory } from "@/lib/feedback-meta";
import { getAppVersionInfo } from "@/lib/version";
import MIcon from "../MIcon";
import { AttachmentPicker } from "./AttachmentPicker";
import { CategoryPicker } from "./CategoryPicker";
import { FeedbackSuccess } from "./FeedbackSuccess";
import { insertStarter } from "./feedback-utils";
import { useAttachments } from "./useAttachments";
import { useFeedbackDraft } from "./useFeedbackDraft";

/** Odkud člověk na stránku přišel — jen cesta v rámci appky, nic jiného. */
function getReferrerPath(): string {
  try {
    if (!document.referrer) return "";
    const url = new URL(document.referrer);
    if (url.origin !== window.location.origin || url.pathname === "/pripominky") return "";
    return url.pathname;
  } catch {
    return "";
  }
}

/** Obrázky ze schránky nebo z přetažení — jen soubory, text se ignoruje. */
function imageFiles(list: DataTransferItemList | FileList | null | undefined): File[] {
  if (!list) return [];
  if (list instanceof FileList) return Array.from(list);
  return Array.from(list)
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((f): f is File => !!f);
}

/**
 * Psaní připomínky, postupně odhalované:
 * 1. dlaždice s kategorií,
 * 2. otázka podle kategorie, rychlé začátky vět a text,
 * 3. odeslání. Připomínky jsou anonymní — kdo chce, podepíše se do textu.
 *
 * Druhý a třetí krok se ukážou až po výběru kategorie — prázdný formulář
 * se všemi poli najednou působí jako úřední tiskopis, ne jako „napište nám“.
 */
export type FeedbackPrefill = {
  category: FeedbackCategory | null;
  /** Stránka, kde problém vznikl — přebije referrer. */
  page: string;
  /** Technický údaj z chybové stránky (kód chyby). Uživatel ho vidí a může ho odebrat. */
  context: string;
};

const APP_VERSION = getAppVersionInfo().version;

export function FeedbackComposer({
  prefill,
  onSent,
}: {
  prefill: FeedbackPrefill;
  onSent: (id: number, token: string) => void;
}) {
  const { category, setCategory, message, setMessage, restored, clearDraft } = useFeedbackDraft(prefill.category);
  const [context, setContext] = useState(prefill.context);
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Kategorie odeslané připomínky — poděkování podle ní řekne, jestli ji uvidí i ostatní
  const [sentAs, setSentAs] = useState<FeedbackCategory | null>(null);
  const [isPending, startTransition] = useTransition();
  const attachments = useAttachments();
  const [dragging, setDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Kam posadit kurzor po vložení začátku věty — až když React zapíše nový text
  const pendingCursor = useRef<number | null>(null);

  const meta = category ? getCategoryMeta(category) : null;
  const length = message.trim().length;
  const missing = Math.max(0, FEEDBACK_LIMITS.messageMin - length);
  const canSend = !!category && missing === 0 && !isPending && !attachments.busy;

  // Obrázek přetažený nebo vložený dřív, než je vybraná kategorie, je skoro
  // vždycky hlášení chyby — kategorie se předvybere, jde ji změnit.
  const addFiles = attachments.add;
  const acceptFiles = useRef<(files: File[]) => void>(() => {});
  useEffect(() => {
    acceptFiles.current = (files: File[]) => {
      if (files.length === 0) return;
      if (!category) setCategory("chyba");
      void addFiles(files);
    };
  }, [addFiles, category, setCategory]);

  // Přetažení kamkoli na stránku a vložení přes Ctrl+V. Počítadlo, protože
  // dragenter/dragleave chodí i při přechodu mezi potomky.
  useEffect(() => {
    if (sentAs !== null) return;
    let depth = 0;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const onEnter = (e: DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); depth++; setDragging(true); };
    const onOver = (e: DragEvent) => { if (hasFiles(e)) e.preventDefault(); };
    const onLeave = (e: DragEvent) => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (depth === 0) setDragging(false); };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      acceptFiles.current(imageFiles(e.dataTransfer?.files));
    };
    const onPaste = (e: ClipboardEvent) => {
      const files = imageFiles(e.clipboardData?.items);
      if (files.length === 0) return;
      e.preventDefault();
      acceptFiles.current(files);
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("paste", onPaste);
    };
  }, [sentAs]);

  // Pole roste s textem — scrollovat uvnitř malého okýnka se píše špatně
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [message, category]);

  const pickCategory = (id: NonNullable<typeof category>) => {
    setCategory(id);
    setError(null);
    // Po výběru rovnou psát — ale až se pole vykreslí
    requestAnimationFrame(() => textareaRef.current?.focus({ preventScroll: true }));
  };

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el || pendingCursor.current === null) return;
    el.setSelectionRange(pendingCursor.current, pendingCursor.current);
    pendingCursor.current = null;
  }, [message]);

  const applyStarter = (starter: string) => {
    const next = insertStarter(message, starter);
    // Fokus hned, ne až po překreslení — jinak první napsané písmeno skončí jinde
    textareaRef.current?.focus();
    pendingCursor.current = next.length;
    setMessage(next);
  };

  const submit = () => {
    if (!canSend || !category) return;
    setError(null);
    startTransition(async () => {
      try {
        const body = new FormData();
        body.set("category", category);
        body.set("message", message);
        body.set("page", prefill.page || getReferrerPath());
        body.set("context", context);
        body.set("appVersion", APP_VERSION);
        body.set("website", website);
        attachments.items.forEach((a, i) => body.append("attachments", a.blob, `obrazek-${i + 1}`));
        const res = await fetch("/api/feedback", { method: "POST", body })
          .then((r) => r.json() as Promise<{ ok: true; id?: number; token?: string } | { ok: false; error: string }>);
        if (res.ok) {
          if (res.id && res.token) onSent(res.id, res.token);
          setContext("");
          clearDraft();
          attachments.clear();
          setSentAs(category);
        } else {
          setError(res.error);
        }
      } catch {
        setError("Nepodařilo se to odeslat. Zkus to znovu.");
      }
    });
  };

  if (sentAs !== null) {
    return (
      <section className="glass rounded-3xl overflow-hidden">
        <FeedbackSuccess isPublic={isPublicCategory(sentAs)} onAgain={() => setSentAs(null)} />
      </section>
    );
  }

  return (
    <>
    {dragging && (
      <div aria-hidden="true" className="fb-dropzone-overlay">
        <div className="fb-dropzone-overlay__box">
          <MIcon name="upload_file" size={36} style={{ color: "#D97706" }} />
          <span className="font-display font-bold text-[16px] text-stone-900">Pusť obrázek sem</span>
          <span className="text-[12px] text-stone-500">Přidá se k připomínce</span>
        </div>
      </div>
    )}
    <section className="glass rounded-3xl overflow-hidden" aria-labelledby="fb-title">
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
        <div className="p-4 md:p-5 flex flex-col gap-4">
          <div>
            <h1 id="fb-title" className="font-display font-bold text-[17px] md:text-[19px] text-stone-900 leading-tight">
              Máš nápad, nebo tě něco štve?
            </h1>
            <p className="text-[12.5px] text-stone-500 mt-1">
              Vyber, čeho se to týká, a napiš pár slov.
            </p>
          </div>

          <CategoryPicker onChange={pickCategory} value={category} />

          {meta && (
            <div key={meta.id} className="flex flex-col gap-3 fade-up">
              <div className="flex items-center gap-2">
                <label className="font-display font-bold text-[14px] text-stone-900" htmlFor="fb-message">{meta.question}</label>
                {restored && message.trim() && (
                  <span className="ml-auto text-[11px] text-stone-400 inline-flex items-center gap-1">
                    <MIcon name="history" size={12} /> Máš tu rozepsaný text
                  </span>
                )}
              </div>

              <div className="flex gap-1.5 flex-wrap" aria-label="Rychlé začátky vět">
                {meta.starters.map((s) => (
                  <button key={s} className="fb-starter" onClick={() => applyStarter(s)} type="button">
                    <MIcon name="add" size={12} />
                    {s}
                  </button>
                ))}
              </div>

              <div className="relative">
                <textarea
                  ref={textareaRef}
                  className="fb-textarea"
                  id="fb-message"
                  maxLength={FEEDBACK_LIMITS.messageMax}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); }
                  }}
                  placeholder="Klidně stručně, po svém."
                  value={message}
                />
                {message.length > FEEDBACK_LIMITS.messageMax * 0.8 && (
                  <span className="absolute right-3 bottom-2.5 text-[11px] text-amber-700">
                    {message.length} / {FEEDBACK_LIMITS.messageMax}
                  </span>
                )}
              </div>

              {context && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-xl text-[12px] text-stone-600"
                  style={{ background: "rgba(26,18,8,0.04)", border: "1px solid rgba(26,18,8,0.06)" }}>
                  <MIcon name="info" size={14} style={{ color: "#a8a29e", flexShrink: 0, marginTop: 1 }} />
                  <span className="flex-1 min-w-0">
                    Přiloží se i technický údaj o chybě: <code className="text-[11.5px] break-all">{context}</code>
                  </span>
                  <button aria-label="Nepřikládat technický údaj" className="text-stone-400 hover:text-stone-600" onClick={() => setContext("")} type="button">
                    <MIcon name="close" size={14} />
                  </button>
                </div>
              )}

              <AttachmentPicker
                busy={attachments.busy}
                items={attachments.items}
                notice={attachments.notice}
                onAdd={(files) => void attachments.add(files)}
                onRemove={attachments.remove}
              />

              {/* Past na roboty — člověk pole nevidí a nevyplní */}
              <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
                <label>
                  Web
                  <input autoComplete="off" name="website" onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} type="text" value={website} />
                </label>
              </div>

              {error && (
                <div role="alert" className="px-3 py-2 rounded-xl text-[12px] text-red-700 font-medium flex items-center gap-1.5"
                  style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.18)" }}>
                  <MIcon name="warning" size={13} style={{ color: "#dc2626", flexShrink: 0 }} />
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {meta && (
          <div className="flex items-center gap-3 px-4 md:px-5 py-3 border-t border-white/50" style={{ background: "rgba(255,255,255,0.3)" }}>
            <span className="text-[11.5px] text-stone-400 flex-1 min-w-0">
              {missing > 0 && length > 0
                ? "Ještě kousek…"
                : <>
                    {isPublicCategory(meta.id)
                      ? "Bez jména. Uvidí ji i ostatní a můžou dát palec."
                      : "Bez jména. Uvidí ji jen správce."}
                    <span className="hidden md:inline"> Zkratka: <kbd className="font-sans px-1.5 py-0.5 rounded-md bg-black/5 text-stone-500">Ctrl</kbd> + <kbd className="font-sans px-1.5 py-0.5 rounded-md bg-black/5 text-stone-500">Enter</kbd></span>
                  </>}
            </span>
            <button className="modal-btn modal-btn--primary inline-flex items-center gap-1.5 !px-5" disabled={!canSend} type="submit">
              <MIcon name="send" size={15} />
              {isPending ? "Odesílám…" : "Odeslat"}
            </button>
          </div>
        )}
      </form>
    </section>
    </>
  );
}
