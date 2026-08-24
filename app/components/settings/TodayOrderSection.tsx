"use client";

import { useState, useTransition } from "react";
import {
  actionClearOrder,
  actionReopenOrder,
  actionResendOrder,
  actionSendOrder,
} from "@/app/actions";
import { ConfirmModal } from "../ConfirmModal";
import MIcon from "../MIcon";
import { SettingsSection } from "./SettingsPrimitives";

/**
 * Zásahy do dnešní objednávky z nastavení: znovuotevření, ruční odeslání,
 * opakované odeslání e-mailu a smazání.
 *
 * Nabídka se řídí stavem objednávky — odeslaná se dá otevřít a poslat znovu,
 * otevřená odeslat nebo smazat. Po zásahu se stránka nepřenačítá, jen se
 * ukáže hláška: operátor sem přišel kvůli nastavení, ne kvůli objednávce,
 * a odskočení na jinou obrazovku by ho vytrhlo z toho, co dělal.
 *
 * Smazání se ptá, protože je nevratné a dopadne na všechna oddělení naráz.
 */
export function TodayOrderSection({
  order,
  isActive,
}: {
  order?: { id: number; status: string };
  isActive: boolean;
}) {
  const [reopenDone, setReopenDone] = useState(false);
  const [resendStatus, setResendStatus] = useState<"idle" | "pending" | "done" | "error">("idle");
  const [sendStatus, setSendStatus] = useState<"idle" | "pending" | "done" | "error">("idle");
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearDone, setClearDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!isActive || !order) return null;

  return (
    <>
      <SettingsSection icon="lock_open" title="Dnešní objednávka">
        {order.status === "sent" && !reopenDone ? (
          <div className="flex flex-col gap-3">
            <p className="text-[12.5px] text-stone-500">Objednávka je odeslána.</p>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-2xl glass-btn text-stone-600"
                disabled={isPending}
                onClick={() => {
                  startTransition(async () => {
                    await actionReopenOrder(order.id);
                    setReopenDone(true);
                  });
                }}
                type="button"
              >
                <MIcon name="lock_open" size={14} /> Znovu otevřít
              </button>
              <button
                className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-2xl glass-btn text-stone-600"
                disabled={isPending || resendStatus === "pending"}
                onClick={() => {
                  setResendStatus("pending");
                  startTransition(async () => {
                    try {
                      await actionResendOrder(order.id);
                      setResendStatus("done");
                      setTimeout(() => setResendStatus("idle"), 4000);
                    } catch {
                      setResendStatus("error");
                    }
                  });
                }}
                type="button"
              >
                <MIcon name="send" size={14} /> {resendStatus === "pending" ? "Odesílám..." : "Znovu odeslat email"}
              </button>
            </div>
            {resendStatus === "done" && (
              <p className="text-[12px] text-green-700 inline-flex items-center gap-1.5">
                <MIcon name="check_circle" size={13} fill /> Email byl znovu odeslán.
              </p>
            )}
            {resendStatus === "error" && (
              <p className="text-[12px] text-red-500">Chyba při odesílání. Zkontrolujte SMTP nastavení.</p>
            )}
          </div>
        ) : reopenDone ? (
          <p className="text-[12.5px] text-green-700 inline-flex items-center gap-1.5">
            <MIcon name="check_circle" size={14} fill /> Objednávka byla znovu otevřena.
          </p>
        ) : null}
        {order.status === "draft" && !clearDone && (
          <div className="flex flex-col gap-2 pt-1 border-t border-white/40">
            <p className="text-[12.5px] text-stone-500">Objednávka je otevřená.</p>
            <div className="flex flex-wrap gap-2">
              <button
                className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-2xl glass-btn text-stone-600"
                disabled={isPending || sendStatus === "pending"}
                onClick={() => {
                  setSendStatus("pending");
                  startTransition(async () => {
                    try {
                      await actionSendOrder(order.id);
                      setSendStatus("done");
                    } catch {
                      setSendStatus("error");
                    }
                  });
                }}
                type="button"
              >
                <MIcon name="send" size={14} />
                {sendStatus === "pending" ? "Odesílám…" : "Odeslat ručně"}
              </button>
              <button
                className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-2xl glass-btn-danger"
                disabled={isPending}
                onClick={() => setClearConfirm(true)}
                type="button"
              >
                <MIcon name="delete" size={14} /> Smazat celou objednávku
              </button>
            </div>
            {sendStatus === "done" && (
              <p className="text-[12px] text-green-700 inline-flex items-center gap-1.5">
                <MIcon name="check_circle" size={13} fill /> Objednávka byla odeslána.
              </p>
            )}
            {sendStatus === "error" && (
              <p className="text-[12px] text-red-500">Chyba při odesílání. Zkontrolujte SMTP nastavení.</p>
            )}
          </div>
        )}
        {clearDone && (
          <p className="text-[12.5px] text-stone-500 inline-flex items-center gap-1.5">
            <MIcon name="check_circle" size={14} fill style={{ color: "#94a3b8" }} /> Objednávka byla smazána.
          </p>
        )}
      </SettingsSection>

      {clearConfirm && (
        <ConfirmModal
          confirmLabel="Smazat"
          isPending={isPending}
          message="Celá dnešní objednávka bude vymazána. Tuto akci nelze vrátit."
          onClose={() => setClearConfirm(false)}
          onConfirm={() => {
            startTransition(async () => {
              await actionClearOrder(order.id);
              setClearConfirm(false);
              setClearDone(true);
            });
          }}
          title="Smazat objednávku"
        />
      )}
    </>
  );
}
