"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSwipeable } from "react-swipeable";
import type { CSSProperties, RefCallback } from "react";

export function useModalSwipe(onDismiss: () => void) {
  const onDismissRef = useRef(onDismiss);
  useEffect(() => { onDismissRef.current = onDismiss; }, [onDismiss]);

  const [dragY, setDragY] = useState(0);
  const [isClosing, setIsClosing] = useState(false);
  const sheetElRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const dismiss = useCallback(() => {
    setIsClosing(true);
    timerRef.current = setTimeout(() => onDismissRef.current(), 240);
  }, []);

  const handlers = useSwipeable({
    onSwiping: ({ deltaY }) => {
      const body = sheetElRef.current?.querySelector(".modal-sheet__body") as HTMLElement | null;
      if (body && body.scrollTop > 0) { setDragY(0); return; }
      // deltaY = initialY - currentY, proto je záporné při tahu dolů → negujeme
      setDragY(Math.max(0, -deltaY));
    },
    onSwipedDown: ({ absY, velocity }) => {
      if (absY > 80 || velocity > 0.5) dismiss();
      else setDragY(0);
    },
    onSwiped: ({ dir }) => { if (dir !== "Down") setDragY(0); },
    preventScrollOnSwipe: false,
    touchEventOptions: { passive: false },
    trackMouse: false,
    delta: 10,
  });

  const { ref: swipeRef, ...swipeProps } = handlers;

  const sheetRef: RefCallback<HTMLDivElement> = useCallback(
    (el) => { sheetElRef.current = el; swipeRef(el); },
    [swipeRef]
  );

  const sheetStyle: CSSProperties = isClosing
    ? { transform: "translateY(110%)", transition: "transform 0.24s ease-in" }
    : dragY > 0
      ? { transform: `translateY(${dragY}px)`, transition: "none" }
      : {};

  return { sheetRef, sheetStyle, swipeProps };
}
