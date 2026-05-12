"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import MIcon from "./MIcon";

export function ConfirmModal({
  title,
  message,
  confirmLabel = "Smazat",
  confirmVariant = "danger",
  isPending = false,
  children,
  onConfirm,
  onClose,
}: {
  title: string;
  message?: string;
  confirmLabel?: string;
  confirmVariant?: "danger" | "primary";
  isPending?: boolean;
  children?: React.ReactNode;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" onClick={(e) => e.stopPropagation()}>
        <div className={`confirm-dialog__icon${confirmVariant === "primary" ? " confirm-dialog__icon--primary" : ""}`}>
          {confirmVariant === "primary" ? (
            <MIcon name="send" size={24} fill />
          ) : (
            <MIcon name="warning" size={24} fill />
          )}
        </div>
        <h3 className="confirm-dialog__title" id="confirm-dialog-title">{title}</h3>
        {message && <p className="confirm-dialog__message">{message}</p>}
        {children}
        <div className="confirm-dialog__actions">
          <button className="modal-btn modal-btn--secondary" onClick={onClose} type="button">Zrušit</button>
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
