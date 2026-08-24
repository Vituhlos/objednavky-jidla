"use client";

import { useTransition, type Dispatch, type SetStateAction } from "react";
import {
  actionRemoveTelegramSubscription,
  actionSetTelegramAdmin,
} from "@/app/actions";
import type { TelegramSubscription } from "@/lib/telegram";
import MIcon from "../MIcon";
import { SettingsSection } from "./SettingsPrimitives";

/**
 * Kdo bota používá a kdo je admin.
 *
 * Seznam sem přichází shora a ne z vlastního načtení: jeho počet čte i odznak
 * u záložky „Lidé“ v navigaci, takže musí být vidět i když je sekce zavřená.
 */
export function TelegramSubscribersSection({
  subscriptions,
  isLoaded,
  isActive,
  onChange,
}: {
  subscriptions: TelegramSubscription[];
  isLoaded: boolean;
  isActive: boolean;
  onChange: Dispatch<SetStateAction<TelegramSubscription[]>>;
}) {
  const [isPending, startTransition] = useTransition();

  if (!isActive) return null;

  return (
    <div className="flex flex-col gap-4">

      {/* Subscriber list */}
      <SettingsSection icon="group" title={`Registrovaní uživatelé${subscriptions.length > 0 ? ` (${subscriptions.length})` : ""}`}>
        {!isLoaded ? (
          <p className="text-[12.5px] text-stone-400">Načítám…</p>
        ) : subscriptions.length === 0 ? (
          <div className="text-[12.5px] text-stone-400 leading-relaxed">
            Zatím nikdo. Každý si otevře chat s botem a pošle <code className="bg-black/5 px-1 rounded">/start</code>.
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {subscriptions.map((sub) => (
              <div key={sub.chatId} className="flex items-center gap-2 py-1.5 px-2 rounded-xl hover:bg-black/3 group">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0" style={{ background: sub.isAdmin ? "linear-gradient(135deg,#F59E0B,#EA580C)" : "#a8a29e" }}>
                  {(sub.firstName || sub.username || "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[13px] font-semibold text-stone-800 truncate block">
                    {sub.firstName || sub.username || `Chat ${sub.chatId}`}
                    {sub.username && sub.firstName && <span className="text-stone-400 font-normal text-[11px] ml-1">@{sub.username}</span>}
                  </span>
                  <span className="text-[11px] text-stone-400">
                    {sub.isAdmin ? "Admin" : "Uživatel"} · registrován {new Date(sub.registeredAt).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" })}
                  </span>
                  <span className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className={`text-[10.5px] px-1.5 py-0.5 rounded-full font-medium ${sub.notifyReminder ? "bg-amber-100 text-amber-700" : "bg-stone-100 text-stone-400"}`} title="Připomenutí uzávěrky">🔔</span>
                    <span className={`text-[10.5px] px-1.5 py-0.5 rounded-full font-medium ${sub.notifyMorningMenu ? "bg-sky-100 text-sky-700" : "bg-stone-100 text-stone-400"}`} title="Ranní jídelníček">🌅</span>
                    <span className={`text-[10.5px] px-1.5 py-0.5 rounded-full font-medium ${sub.notifyMenuImported ? "bg-green-100 text-green-700" : "bg-stone-100 text-stone-400"}`} title="Nový jídelníček">📋</span>
                    {sub.personalReminderTime && <span className="text-[10.5px] px-1.5 py-0.5 rounded-full font-medium bg-amber-50 text-amber-600">⏰ {sub.personalReminderTime}</span>}
                  </span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={async () => {
                      await actionSetTelegramAdmin(sub.chatId, !sub.isAdmin);
                      onChange((prev) => prev.map((s) => s.chatId === sub.chatId ? { ...s, isAdmin: !s.isAdmin } : s));
                    }}
                    className="text-[11px] px-2 py-1 rounded-lg glass-btn text-stone-500 font-medium"
                    title={sub.isAdmin ? "Odebrat admin" : "Nastavit jako admin"}
                  >
                    {sub.isAdmin ? "→ User" : "→ Admin"}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await actionRemoveTelegramSubscription(sub.chatId);
                      onChange((prev) => prev.filter((s) => s.chatId !== sub.chatId));
                    }}
                    className="w-7 h-7 rounded-lg glass-btn flex items-center justify-center text-red-400"
                    title="Odebrat"
                  >
                    <MIcon name="close" size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SettingsSection>

    </div>
  );
}
