"use client";

import { useState, useTransition } from "react";
import type { AppSettings } from "@/lib/settings";
import { actionSendTestPush } from "@/app/actions";
import MIcon from "../MIcon";
import { SettingsField, SettingsSection } from "./SettingsPrimitives";

/** Push upozornění před uzávěrkou. Odběr si zapíná každý sám na hlavní stránce. */
export function PushSection({ settings }: { settings: AppSettings }) {
  const [pushTestStatus, setPushTestStatus] = useState<"idle" | "pending" | "ok" | "error">("idle");
  const [pushTestMsg, setPushTestMsg] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleTestPush = () => {
    setPushTestStatus("pending");
    setPushTestMsg("Odesílám...");
    startTransition(async () => {
      try {
        const result = await actionSendTestPush();
        if (result.error) { setPushTestStatus("error"); setPushTestMsg(result.error); }
        else { setPushTestStatus("ok"); setPushTestMsg(`Notifikace odeslána do ${result.sent} prohlížeče/ů.`); }
      } catch {
        setPushTestStatus("error");
        setPushTestMsg("Nepodařilo se odeslat testovací notifikaci.");
      }
    });
  };

  return (
    <SettingsSection icon="notifications" title="Push notifikace">
      <p className="text-[12.5px] text-stone-500">
        Upozornění do prohlížeče před uzávěrkou. Každý si je povolí sám tlačítkem 🔔 na hlavní stránce.
      </p>
      <SettingsField hint="kolik minut před uzávěrkou přijde upozornění" label="Upozornit před uzávěrkou (min)">
        <input className="modal-input w-24" defaultValue={settings.pushReminderMinutes} min="1" max="120" name="pushReminderMinutes" type="number" />
      </SettingsField>
      <div className="flex items-center gap-3 flex-wrap">
        <button
          className="glass-btn px-4 py-2 rounded-xl text-[12.5px] font-semibold text-stone-700 inline-flex items-center gap-2"
          disabled={isPending}
          onClick={handleTestPush}
          type="button"
        >
          <MIcon name="send" size={16} />
          Odeslat testovací notifikaci
        </button>
        {pushTestStatus !== "idle" && (
          <span className={`text-[12px] font-medium ${pushTestStatus === "ok" ? "text-green-600" : pushTestStatus === "error" ? "text-red-500" : "text-stone-500"}`}>
            {pushTestStatus === "ok" && "✓ "}
            {pushTestMsg}
          </span>
        )}
      </div>
    </SettingsSection>
  );
}
