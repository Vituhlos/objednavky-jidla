"use client";

import { Suspense, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import PageHeader from "@/app/components/PageHeader";
import MIcon from "@/app/components/MIcon";

function LoginInner() {
  const params = useSearchParams();
  const from = params.get("from") || "/";

  useEffect(() => {
    signIn("oidc", { callbackUrl: from });
  }, [from]);

  return (
    <div className="k-shell">
      <PageHeader title="Přihlášení" mobileTitle="Přihlášení" />

      <div className="flex-1 overflow-y-auto scroll-area p-4 md:p-5 pb-nav">
        <div className="max-w-sm mx-auto w-full mt-4 md:mt-8">
          <div className="glass-card rounded-3xl overflow-hidden">
            <div className="flex flex-col items-center gap-4 p-8">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,rgba(245,158,11,0.15),rgba(234,88,12,0.15))" }}
              >
                <MIcon name="lock" size={28} fill style={{ color: "#EA580C" }} />
              </div>
              <div className="text-center">
                <p className="font-display font-bold text-[17px] text-stone-900">Přihlášení přes SSO</p>
                <p className="text-[12.5px] text-stone-500 mt-1 leading-relaxed">
                  Přesměrovávám na firemní přihlášení…
                </p>
              </div>
              <div className="w-full flex flex-col gap-2">
                <div className="flex items-center justify-center gap-2 text-[12px] text-stone-400">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" aria-hidden />
                  Načítám poskytovatele identity
                </div>
                <button
                  type="button"
                  className="modal-btn modal-btn--primary w-full"
                  onClick={() => signIn("oidc", { callbackUrl: from })}
                >
                  Přihlásit se ručně
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginFallback() {
  return (
    <div className="k-shell">
      <PageHeader title="Přihlášení" mobileTitle="Přihlášení" />
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-[13px] text-stone-500">Načítám přihlášení…</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginInner />
    </Suspense>
  );
}
