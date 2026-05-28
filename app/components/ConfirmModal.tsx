"use client";

import { useEffect, useRef, useId, useState } from "react";
import { createPortal } from "react-dom";
import MIcon from "./MIcon";

export function ConfirmModal({
  title,
  message,
  confirmLabel = "Smazat",
  confirmVariant = "danger",
  isPending = false,
  children,
  dialogClassName,
  onConfirm,
  onClose,
}: {
  title: string;
  message?: string;
  confirmLabel?: string;
  confirmVariant?: "danger" | "primary";
  isPending?: boolean;
  children?: React.ReactNode;
  dialogClassName?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<Element | null>(null);

  // Mount + focus save/restore
  useEffect(() => {
    triggerRef.current = document.activeElement;
    setMounted(true);
    return () => {
      if (triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus();
      }
    };
  }, []);

  // Initial focus on Cancel button
  useEffect(() => {
    if (mounted) cancelRef.current?.focus();
  }, [mounted]);

  // Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  // Focus trap
  useEffect(() => {
    if (!mounted) return;
    const h = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [mounted]);

  if (!mounted) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className={`confirm-dialog${dialogClassName ? ` ${dialogClassName}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`confirm-dialog__icon${confirmVariant === "primary" ? " confirm-dialog__icon--primary" : ""}`}>
          {confirmVariant === "primary" ? (
            <MIcon name="send" size={24} fill />
          ) : (
            <MIcon name="warning" size={24} fill />
          )}
        </div>
        <h3 className="confirm-dialog__title" id={titleId}>{title}</h3>
        {message && <p className="confirm-dialog__message">{message}</p>}
        {children}
        <div className="confirm-dialog__actions">
          <button ref={cancelRef} className="modal-btn modal-btn--secondary" onClick={onClose} type="button">Zrušit</button>
          <button
            className={`modal-btn ${confirmVariant === "primary" ? "modal-btn--primary" : "modal-btn--danger"}`}
            disabled={isPending}
            onClick={onConfirm}
            type="button"
          >
            {isPending ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
