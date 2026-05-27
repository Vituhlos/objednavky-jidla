"use client";

import { Suspense, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

function LoginInner() {
  const params = useSearchParams();
  const from = params.get("from") || "/";

  useEffect(() => {
    signIn("oidc", { callbackUrl: from });
  }, [from]);

  return (
    <div className="v2-shell">
      <div className="v2-content">
        <div className="glass rounded-3xl p-6 max-w-md mx-auto mt-8">
          <div className="text-sm text-stone-600 mb-2">Přihlašování…</div>
          <div className="text-xl font-display font-extrabold text-stone-900">Přesměrovávám na SSO</div>
          <div className="text-[12.5px] text-stone-500 mt-3">Pokud se nic nestane, klikni:</div>
          <button
            type="button"
            className="v2-btn v2-btn--primary mt-3 w-full"
            onClick={() => signIn("oidc", { callbackUrl: from })}
          >
            Přihlásit se
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="v2-content p-8 text-center text-stone-500">Načítám přihlášení…</div>}>
      <LoginInner />
    </Suspense>
  );
}
