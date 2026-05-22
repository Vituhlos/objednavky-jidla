"use client";

import type { HTMLAttributes, CSSProperties } from "react";
import { useModalSwipe } from "./useModalSwipe";

type Props = HTMLAttributes<HTMLDivElement> & {
  onDismiss: () => void;
  style?: CSSProperties;
};

export function ModalSwipeShell({ onDismiss, className, style, children, ...props }: Props) {
  const { sheetRef } = useModalSwipe(onDismiss);
  return (
    <div
      ref={sheetRef}
      className={className}
      style={style}
      {...props}
    >
      <div className="modal-sheet__drag-handle" aria-hidden />
      {children}
    </div>
  );
}
