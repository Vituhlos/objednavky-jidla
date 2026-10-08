"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import MIcon from "./MIcon";

/**
 * Spodní navigace na mobilu s výběrovou pilulkou, která se chová jako v nativní
 * liště: mezi položkami plynule přejíždí a při tažení prstem po liště jede
 * s prstem; po puštění se zvolí položka pod ním.
 *
 * Do lišty se vejde nejvýš `MAX_SLOTS` položek. Když jich je víc, zůstanou
 * první čtyři a zbytek se schová do nabídky „Více" — jinak by se popisky na
 * úzkém telefonu nevešly a každá další stránka by lištu dál zahušťovala.
 *
 * Položky zůstávají obyčejné odkazy — klepnutí, klávesnice i čtečky fungují
 * jako dřív. Tažení je vrstva navíc: začne až po pár pixelech pohybu, takže
 * klepnutí se s ním neplete.
 *
 * Pilulka se přesune hned po volbě (`pendingHref`), nečeká na načtení stránky.
 * Čekající volba se ruší při každé změně adresy — i při návratu tlačítkem Zpět,
 * jinak by pilulka po návratu ukázala na stránku, ze které se odešlo.
 */

export type MobileNavItem = { href: string; label: string; shortLabel: string; icon: string; exact: boolean };

const MAX_SLOTS = 5;

/** Po tolika pixelech vodorovného pohybu se z doteku stane tažení. */
const DRAG_THRESHOLD_PX = 6;

type Drag = { x: number; itemWidth: number; trackWidth: number };

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export default function MobileNav({
  items,
  pathname,
  badgeFor,
  badgeLabel,
}: {
  items: MobileNavItem[];
  pathname: string;
  badgeFor: (href: string) => number;
  badgeLabel: (count: number) => string;
}) {
  const router = useRouter();
  const navRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ pointerId: number; startX: number; dragging: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setPendingHref(null);
  }
  // Nabídka je otevřená jen pro adresu, na které ji někdo otevřel — přechod
  // na jinou stránku ji tím sám zavře.
  const [menuOpenAt, setMenuOpenAt] = useState<string | null>(null);

  const hasMore = items.length > MAX_SLOTS;
  const primary = hasMore ? items.slice(0, MAX_SLOTS - 1) : items;
  const overflow = hasMore ? items.slice(MAX_SLOTS - 1) : [];
  const slotCount = primary.length + (hasMore ? 1 : 0);
  const moreIndex = hasMore ? primary.length : -1;
  const menuOpen = hasMore && menuOpenAt === pathname;

  const isActive = (item: MobileNavItem) => (item.exact ? pathname === item.href : pathname.startsWith(item.href));
  const slotOf = (href: string) => {
    const index = primary.findIndex((i) => i.href === href);
    return index >= 0 ? index : overflow.some((i) => i.href === href) ? moreIndex : -1;
  };
  const activeItem = items.find(isActive);
  const activeIndex = activeItem ? slotOf(activeItem.href) : -1;
  const pendingIndex = pendingHref ? slotOf(pendingHref) : -1;
  const dragIndex = drag ? clamp(Math.floor(drag.x / drag.itemWidth), 0, slotCount - 1) : -1;
  const shownIndex = dragIndex >= 0 ? dragIndex : menuOpen ? moreIndex : pendingIndex >= 0 ? pendingIndex : activeIndex;
  const overflowBadge = overflow.reduce((sum, item) => sum + badgeFor(item.href), 0);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpenAt(null);
    const onPointerDown = (e: PointerEvent) => {
      if (!navRef.current?.contains(e.target as Node)) close();
    };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const go = (href: string) => {
    setMenuOpenAt(null);
    if (activeItem?.href === href) return;
    setPendingHref(href);
  };

  const measure = (clientX: number): Drag | null => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    return { x: clientX - rect.left, itemWidth: rect.width / slotCount, trackWidth: rect.width };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    gesture.current = { pointerId: e.pointerId, startX: e.clientX, dragging: false };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    if (!g.dragging) {
      if (Math.abs(e.clientX - g.startX) < DRAG_THRESHOLD_PX) return;
      g.dragging = true;
      // Zachycení drží tažení, i když prst sjede mimo lištu. Když ho prohlížeč
      // odmítne, tažení funguje dál, jen končí na okraji lišty.
      try { trackRef.current?.setPointerCapture(e.pointerId); } catch { /* ukazatel už není aktivní */ }
    }
    const next = measure(e.clientX);
    if (next) setDrag(next);
  };

  const endGesture = (e: ReactPointerEvent<HTMLDivElement>, commit: boolean) => {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    gesture.current = null;
    if (!g.dragging) return;

    // Po tažení ještě může dorazit click na prvek pod prstem — ten nechceme.
    suppressClick.current = true;
    setTimeout(() => { suppressClick.current = false; }, 0);
    setDrag(null);

    const released = commit ? measure(e.clientX) : null;
    if (!released) return;
    const index = clamp(Math.floor(released.x / released.itemWidth), 0, slotCount - 1);
    if (index === moreIndex) {
      setMenuOpenAt(pathname);
      return;
    }
    const target = primary[index];
    if (!target) return;
    const alreadyThere = activeItem?.href === target.href;
    go(target.href);
    if (!alreadyThere) router.push(target.href);
  };

  const pillTransform = drag
    ? `translate3d(${clamp(drag.x - drag.itemWidth / 2, 0, drag.trackWidth - drag.itemWidth)}px, 0, 0) scale(1.06, 1.1)`
    : `translate3d(${Math.max(shownIndex, 0) * 100}%, 0, 0)`;

  const iconColor = (shown: boolean) => ({ color: shown ? "#D97706" : "#94a3b8", transition: "color .2s" });

  return (
    <nav aria-label="Navigace" className="md:hidden mobile-nav" ref={navRef}>
      {menuOpen && (
        <div className="mobile-nav__menu" id="mobile-nav-more">
          {overflow.map((item) => {
            const active = isActive(item);
            const badge = badgeFor(item.href);
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`mobile-nav__menu-item ${active ? "mobile-nav__menu-item--active" : ""}`}
                href={item.href}
                key={item.href}
                onClick={() => go(item.href)}
              >
                <MIcon name={item.icon} size={20} fill={active} style={iconColor(active)} />
                <span className="flex-1 font-display">{item.label}</span>
                {badge > 0 && (
                  <span className="nav-badge" title={badgeLabel(badge)}>
                    <span className="sr-only">{badgeLabel(badge)}</span>
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
      <div className="glass mobile-nav__bar">
        <div
          className="mobile-nav__track"
          onClickCapture={(e) => {
            if (!suppressClick.current) return;
            e.preventDefault();
            e.stopPropagation();
          }}
          onPointerCancel={(e) => endGesture(e, false)}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => endGesture(e, true)}
          ref={trackRef}
        >
          <span
            aria-hidden="true"
            className={`mobile-nav__pill ${drag ? "mobile-nav__pill--dragging" : ""}`}
            style={{ width: `${100 / slotCount}%`, transform: pillTransform, opacity: shownIndex >= 0 ? 1 : 0 }}
          />
          {primary.map((item, index) => {
            const shown = index === shownIndex;
            const badge = badgeFor(item.href);
            return (
              <Link
                aria-current={index === activeIndex ? "page" : undefined}
                className="mobile-nav__item"
                draggable={false}
                href={item.href}
                key={item.href}
                onClick={() => go(item.href)}
              >
                <span className="relative">
                  <MIcon name={item.icon} size={21} fill={shown} style={iconColor(shown)} />
                  {badge > 0 && (
                    <span className="nav-badge nav-badge--icon" title={badgeLabel(badge)}>
                      <span className="sr-only">{badgeLabel(badge)}</span>
                    </span>
                  )}
                </span>
                <span className={`mobile-nav__label font-display ${shown ? "text-stone-800" : "text-stone-400"}`}>
                  {item.shortLabel}
                </span>
              </Link>
            );
          })}
          {hasMore && (
            <button
              aria-controls="mobile-nav-more"
              aria-expanded={menuOpen}
              className="mobile-nav__item"
              onClick={() => setMenuOpenAt(menuOpen ? null : pathname)}
              type="button"
            >
              <span className="relative">
                <MIcon name="more_horiz" size={21} style={iconColor(shownIndex === moreIndex)} />
                {overflowBadge > 0 && !menuOpen && (
                  <span className="nav-badge nav-badge--icon" title={badgeLabel(overflowBadge)}>
                    <span className="sr-only">{badgeLabel(overflowBadge)}</span>
                  </span>
                )}
              </span>
              <span className={`mobile-nav__label font-display ${shownIndex === moreIndex ? "text-stone-800" : "text-stone-400"}`}>
                Více
              </span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
