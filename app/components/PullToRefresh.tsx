"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import MIcon from "./MIcon";

/**
 * Potažení dolů pro obnovení stránky na dotykových zařízeních.
 *
 * Stránka sama neroluje (roluje jen obsah uvnitř `.scroll-area`), takže
 * prohlížeč vlastní potažení nenabízí — a appka z plochy nemá ani tlačítko
 * pro obnovení. Tohle ho nahrazuje: tah dolů od horní hrany obsahu vysune
 * ukazatel, po přetažení přes práh se stránka obnoví.
 *
 * Obnovení dělá dvě věci: `router.refresh()` znovu načte data stránky ze
 * serveru a událost `app:refresh` řekne klientským částem, které si stav drží
 * samy (živá objednávka), ať si ho stáhnou znovu.
 *
 * Gesto se nebere, když tah začne v otevřeném okně (to má vlastní stahování),
 * v odrolovaném obsahu, nebo když je spíš vodorovný (přepínání dnů).
 */

/** O kolik je potřeba ukazatel stáhnout, aby se po puštění obnovilo. */
const THRESHOLD_PX = 64;
const MAX_PULL_PX = 96;
/** Ukazatel jede za prstem pomaleji — klade odpor jako nativní potažení. */
const RESISTANCE = 0.5;
const DECIDE_PX = 6;
/** Ukazatel se točí aspoň takhle dlouho, i když data dorazí hned. */
const MIN_SPIN_MS = 500;

export const APP_REFRESH_EVENT = "app:refresh";

export default function PullToRefresh() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const indicatorRef = useRef<HTMLDivElement>(null);
  const refreshStarted = useRef<number | null>(null);

  // Schovat ukazatel, až obnovení doběhne (ne dřív než po MIN_SPIN_MS).
  useEffect(() => {
    const el = indicatorRef.current;
    if (isPending || refreshStarted.current === null || !el) return;
    const wait = Math.max(0, MIN_SPIN_MS - (Date.now() - refreshStarted.current));
    const timer = setTimeout(() => {
      refreshStarted.current = null;
      el.dataset.state = "idle";
      el.style.transform = "";
      el.style.opacity = "";
    }, wait);
    return () => clearTimeout(timer);
  }, [isPending]);

  useEffect(() => {
    const el = indicatorRef.current;
    if (!el) return;
    let gesture: { startX: number; startY: number; scroller: HTMLElement; pulling: boolean; pull: number } | null = null;

    const isScrolledWithin = (target: Element, scroller: HTMLElement): boolean => {
      let node: Element | null = target;
      while (node) {
        if (node.scrollTop > 0) return true;
        if (node === scroller) return false;
        node = node.parentElement;
      }
      return false;
    };

    const show = (pull: number) => {
      el.style.transition = "none";
      el.style.transform = `translate3d(-50%, ${pull}px, 0)`;
      el.style.opacity = String(Math.min(pull / THRESHOLD_PX, 1));
      el.style.setProperty("--pull-turn", `${Math.min(pull / THRESHOLD_PX, 1) * 270}deg`);
      el.dataset.state = pull >= THRESHOLD_PX ? "ready" : "pulling";
    };

    const onTouchStart = (e: TouchEvent) => {
      gesture = null;
      if (refreshStarted.current !== null || e.touches.length !== 1 || !(e.target instanceof Element)) return;
      if (e.target.closest(".modal-overlay")) return;
      const scroller = e.target.closest<HTMLElement>(".k-shell .scroll-area");
      if (!scroller || isScrolledWithin(e.target, scroller)) return;
      const touch = e.touches[0];
      gesture = { startX: touch.clientX, startY: touch.clientY, scroller, pulling: false, pull: 0 };
    };

    const onTouchMove = (e: TouchEvent) => {
      const g = gesture;
      if (!g) return;
      const touch = e.touches[0];
      const dy = touch.clientY - g.startY;
      const dx = touch.clientX - g.startX;
      if (!g.pulling) {
        if (dy < 0 || Math.abs(dx) > Math.abs(dy) || g.scroller.scrollTop > 0) {
          if (Math.abs(dy) >= DECIDE_PX || Math.abs(dx) >= DECIDE_PX) gesture = null;
          return;
        }
        if (dy < DECIDE_PX) return;
        g.pulling = true;
      }
      // Bez toho by si tah vzal prohlížeč a obsah by pružil.
      if (e.cancelable) e.preventDefault();
      g.pull = Math.min(Math.max(0, dy) * RESISTANCE, MAX_PULL_PX);
      show(g.pull);
    };

    const onTouchEnd = () => {
      const g = gesture;
      gesture = null;
      if (!g?.pulling) return;
      el.style.transition = "";
      if (g.pull < THRESHOLD_PX) {
        el.dataset.state = "idle";
        el.style.transform = "";
        el.style.opacity = "";
        return;
      }
      el.dataset.state = "refreshing";
      el.style.transform = `translate3d(-50%, ${THRESHOLD_PX}px, 0)`;
      el.style.opacity = "1";
      refreshStarted.current = Date.now();
      window.dispatchEvent(new Event(APP_REFRESH_EVENT));
      startTransition(() => { router.refresh(); });
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
    document.addEventListener("touchcancel", onTouchEnd);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [router]);

  return (
    <div aria-hidden="true" className="pull-refresh" data-state="idle" ref={indicatorRef}>
      <MIcon name="refresh" size={20} />
    </div>
  );
}
