"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import MIcon from "./MIcon";

type PairingData = {
  pairingId: string;
  expiresAt: string;
  qrPayload: string;
};

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export default function MobilePairingQr() {
  const [pairing, setPairing] = useState<PairingData | null>(null);
  const [status, setStatus] = useState<"pending" | "consumed" | "expired" | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState("");
  const [imgKey, setImgKey] = useState(0);
  const pairingRef = useRef<PairingData | null>(null);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/mobile/v1/pairing/qr", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message ?? "Nepodařilo se vygenerovat QR kód.");
      }
      const data = (await res.json()) as PairingData;
      pairingRef.current = data;
      setPairing(data);
      setStatus("pending");
      setImgKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba při generování.");
      setPairing(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void generate();
  }, [generate]);

  useEffect(() => {
    if (!pairing || status !== "pending") return;

    const tick = () => {
      const remaining = new Date(pairing.expiresAt).getTime() - Date.now();
      if (remaining <= 0) {
        setCountdown("0:00");
        setStatus("expired");
        return;
      }
      setCountdown(formatCountdown(remaining));
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [pairing, status]);

  useEffect(() => {
    const current = pairingRef.current;
    if (!current || status !== "pending") return;

    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/mobile/v1/pairing/qr/${current!.pairingId}/status`);
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as { status: "pending" | "consumed" | "expired" };
        if (cancelled) return;
        if (body.status === "consumed") {
          setStatus("consumed");
        } else if (body.status === "expired") {
          setStatus("expired");
        }
      } catch {
        /* ignore transient poll errors */
      }
    }

    void poll();
    const id = window.setInterval(poll, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [pairing?.pairingId, status]);

  const isExpired = status === "expired";
  const isConsumed = status === "consumed";
  const showQr = pairing && status === "pending" && !loading;

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-[12px] text-stone-500 text-center leading-relaxed">
        Naskenujte QR kód v mobilní aplikaci pro rychlé přihlášení bez hesla.
      </p>

      {loading && (
        <div className="flex flex-col items-center gap-2 py-6 text-stone-400">
          <MIcon name="refresh" size={28} className="animate-spin" style={{ color: "#d6d3d1" }} />
          <span className="text-[12px]">Generuji QR kód…</span>
        </div>
      )}

      {error && !loading && (
        <p className="text-[12px] font-semibold text-red-600 text-center">{error}</p>
      )}

      {isConsumed && (
        <div
          className="flex flex-col items-center gap-2 py-4 px-6 rounded-2xl w-full max-w-[220px]"
          style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}
        >
          <MIcon name="check_circle" size={40} style={{ color: "#16a34a" }} />
          <p className="text-[14px] font-bold text-green-700">Připojeno</p>
          <p className="text-[11px] text-green-600/80 text-center">Mobilní aplikace je přihlášena.</p>
        </div>
      )}

      {isExpired && !loading && (
        <div className="flex flex-col items-center gap-2 py-4 text-stone-500">
          <MIcon name="schedule" size={32} style={{ color: "#d6d3d1" }} />
          <p className="text-[12px] font-semibold text-stone-600">QR kód vypršel</p>
        </div>
      )}

      {showQr && (
        <div className="flex flex-col items-center gap-2">
          <img
            key={imgKey}
            src={`/api/mobile/v1/pairing/qr/${pairing.pairingId}/image?t=${imgKey}`}
            alt="QR kód pro přihlášení do mobilní aplikace"
            width={180}
            height={180}
            className="rounded-2xl"
            style={{ imageRendering: "pixelated" }}
          />
          <p className="text-[12px] text-stone-500">
            Platnost: <span className="font-semibold text-stone-700 tabular-nums">{countdown}</span>
          </p>
        </div>
      )}

      {!loading && (
        <button
          type="button"
          onClick={() => void generate()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold text-stone-600 glass-btn hover:text-stone-800 transition"
        >
          <MIcon name="refresh" size={15} />
          Vygenerovat nový kód
        </button>
      )}
    </div>
  );
}
