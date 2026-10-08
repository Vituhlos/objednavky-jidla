"use client";

import { useEffect } from "react";

export default function SwRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      // sw.js řeší push notifikace a stránku „Bez připojení"; appku necachuje
      navigator.serviceWorker.register("/sw.js").catch((err) => console.warn("Service worker se nepodařilo zaregistrovat:", err));
    }
  }, []);
  return null;
}
