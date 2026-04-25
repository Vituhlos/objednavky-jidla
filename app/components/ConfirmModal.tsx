"use client";

import { useEffect } from "react";

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
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  useEffect(() => {
    const scrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollY);
    };
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className={`confirm-dialog__icon${confirmVariant === "primary" ? " confirm-dialog__icon--primary" : ""}`}>
          {confirmVariant === "primary" ? (
            <span aria-hidden className="material-symbols-outlined msym-fill" style={{ fontSize: 24 }}>send</span>
          ) : (
            <span aria-hidden className="material-symbols-outlined msym-fill" style={{ fontSize: 24 }}>warning</span>
          )}
        </div>
        <h3 className="confirm-dialog__title">{title}</h3>
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
    </div>
  );
}
