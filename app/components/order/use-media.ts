"use client";

import { useSyncExternalStore } from "react";

const MOBILE_QUERY = "(max-width: 639px)";

function subscribeMobile(callback: () => void) {
  const mq = window.matchMedia(MOBILE_QUERY);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getMobileSnapshot() {
  return window.matchMedia(MOBILE_QUERY).matches;
}

function getServerMobileSnapshot() {
  return false;
}

/**
 * Je viewport mobilni?
 *
 * **Zamerne `useSyncExternalStore`, ne `useEffect` — neprepisovat.** Efekt by
 * dobehl az po prvnim renderu, takze by se na mobilu na okamzik vykreslila
 * desktopova varianta. Server vraci vzdy `false`, coz drzi server i klientsky
 * prvni render shodne a nevznika hydratacni nesoulad.
 */
export function useIsMobile() {
  return useSyncExternalStore(subscribeMobile, getMobileSnapshot, getServerMobileSnapshot);
}

const subscribeMounted = () => () => {};
const getMountedSnapshot = () => true;
const getServerMountedSnapshot = () => false;

/**
 * Bezi uz kod na klientovi?
 *
 * Portal potrebuje `document.body`, ktery na serveru neexistuje. Stejny duvod
 * pro `useSyncExternalStore` jako vyse: hodnota se lisi mezi serverem
 * a klientem, a tohle je zpusob, jak to Reactu rict bez varovani o hydrataci.
 */
export function useMounted() {
  return useSyncExternalStore(subscribeMounted, getMountedSnapshot, getServerMountedSnapshot);
}
