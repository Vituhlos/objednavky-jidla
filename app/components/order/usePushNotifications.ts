"use client";

import { useCallback, useEffect, useState } from "react";

export type PushState = "unsupported" | "denied" | "subscribed" | "unsubscribed";

/**
 * Přihlášení k push notifikacím prohlížeče.
 *
 * Stav se nedá zjistit synchronně — `pushManager.getSubscription()` je
 * asynchronní — proto se počáteční hodnota odhaduje z `Notification.permission`
 * a teprve efekt ji upřesní. Bez toho by tlačítko při každém načtení na okamžik
 * problikávalo do „nepřihlášeno".
 *
 * `getPushEndpoint()` slouží k označení řádků, které založil tenhle prohlížeč,
 * aby mu server neposílal notifikaci o jeho vlastní změně.
 */
export function usePushNotifications() {
  const [pushState, setPushState] = useState<PushState>(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
    if (Notification.permission === "denied") return "denied";
    return "unsubscribed";
  });

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (Notification.permission === "denied") return;
    let cancelled = false;
    navigator.serviceWorker.ready.then(async (reg) => {
      const existing = await reg.pushManager.getSubscription();
      if (cancelled) return;
      setPushState(existing ? "subscribed" : "unsubscribed");
    });
    return () => { cancelled = true; };
  }, []);

  const handlePushToggle = useCallback(async () => {
    if (pushState === "unsupported" || pushState === "denied") return;
    try {
      const reg = await navigator.serviceWorker.ready;
      if (pushState === "subscribed") {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await fetch("/api/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
          await sub.unsubscribe();
        }
        setPushState("unsubscribed");
        return;
      }
      const { publicKey } = await fetch("/api/push").then((r) => r.json());
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: publicKey });
      const res = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub) });
      if (!res.ok) { await sub.unsubscribe(); return; }
      setPushState("subscribed");
    } catch {
      // Uživatel odmítl oprávnění nebo selhal server — nic nezměníme
      if (Notification.permission === "denied") setPushState("denied");
    }
  }, [pushState]);

  const getPushEndpoint = useCallback(async (): Promise<string | undefined> => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return undefined;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub?.endpoint ?? undefined;
  }, []);

  return { pushState, handlePushToggle, getPushEndpoint };
}
