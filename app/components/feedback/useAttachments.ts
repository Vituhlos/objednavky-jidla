"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FEEDBACK_ATTACHMENT_LIMITS } from "@/lib/feedback-meta";
import { downscaleImage, isAcceptedImage } from "./image-utils";

export type PendingAttachment = { id: string; blob: Blob; url: string };

/**
 * Obrázky vybrané k připomínce: zmenšené, s náhledem přes object URL.
 * URL se uvolňují při odebrání i odchodu ze stránky, ať neteče paměť.
 */
export function useAttachments() {
  const [items, setItems] = useState<PendingAttachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Aktuální seznam pro callbacky a úklid při odchodu — bez nich v závislostech
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);

  useEffect(() => () => { itemsRef.current.forEach((i) => URL.revokeObjectURL(i.url)); }, []);

  const add = useCallback(async (files: File[]) => {
    const images = files.filter(isAcceptedImage);
    const free = FEEDBACK_ATTACHMENT_LIMITS.maxFiles - itemsRef.current.length;
    if (images.length === 0) {
      if (files.length > 0) setNotice("Tohle není obrázek. Přidat jde PNG, JPG, WebP nebo GIF.");
      return;
    }
    if (free <= 0) {
      setNotice(`Přidat jde nejvýš ${FEEDBACK_ATTACHMENT_LIMITS.maxFiles} obrázky.`);
      return;
    }
    setNotice(images.length > free ? `Přidat jde nejvýš ${FEEDBACK_ATTACHMENT_LIMITS.maxFiles} obrázky, zbytek se nepřidal.` : null);
    setBusy(true);
    try {
      const processed = await Promise.all(images.slice(0, free).map(async (file) => {
        const blob = await downscaleImage(file);
        return { id: crypto.randomUUID(), blob, url: URL.createObjectURL(blob) };
      }));
      setItems((prev) => [...prev, ...processed].slice(0, FEEDBACK_ATTACHMENT_LIMITS.maxFiles));
    } finally {
      setBusy(false);
    }
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => {
      const hit = prev.find((i) => i.id === id);
      if (hit) URL.revokeObjectURL(hit.url);
      return prev.filter((i) => i.id !== id);
    });
    setNotice(null);
  }, []);

  const clear = useCallback(() => {
    itemsRef.current.forEach((i) => URL.revokeObjectURL(i.url));
    setItems([]);
    setNotice(null);
  }, []);

  return { items, busy, notice, add, remove, clear };
}
