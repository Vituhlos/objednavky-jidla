"use client";

import { useEffect } from "react";

const HREF = "/fonts/noto-color-emoji.css";

/**
 * Načte stylopis s písmem pro emoji tak, aby neblokoval první vykreslení.
 *
 * Self-hosted Noto Color Emoji, generovaný do public/fonts nástrojem
 * tools/download-emoji-font. Deset řezů s unicode-range, takže prohlížeč stáhne
 * jen řez s emoji, které je opravdu na obrazovce. Chybějící soubor skončí 404
 * a emoji převezme systémové písmo.
 *
 * `<link rel="stylesheet">` vložený parserem blokuje vykreslení bez ohledu na
 * to, jestli je v `head`, nebo na konci `body` — jen se o něm prohlížeč dozví
 * později. Stylopis vložený skriptem vykreslení neblokuje. Do té doby (a bez
 * JavaScriptu natrvalo) kreslí emoji systémové písmo, což je stejný stav, jako
 * když soubor chybí.
 *
 * Záměrně mimo graf bundlu: import by udělal z chybějícího písma chybu sestavení.
 */
export default function EmojiFont() {
  useEffect(() => {
    if (document.querySelector(`link[href="${HREF}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = HREF;
    document.head.appendChild(link);
  }, []);
  return null;
}
