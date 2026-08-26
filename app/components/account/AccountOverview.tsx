"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionLogout } from "@/app/actions-auth";
import type { AccountView } from "@/lib/auth/account-view";
import { ChangePasswordForm } from "./PasswordForms";
import MIcon from "../MIcon";

function Radek({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b border-white/50 last:border-0">
      <span className="text-[12px] text-stone-500 shrink-0">{label}</span>
      <span className="text-[13px] text-stone-800 text-right min-w-0 break-words">{children}</span>
    </div>
  );
}

export function AccountOverview({ account }: { account: AccountView }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleLogout = () => {
    if (isPending) return;
    startTransition(async () => {
      await actionLogout();
      router.replace("/");
      router.refresh();
    });
  };

  return (
    <div className="max-w-sm mx-auto flex flex-col gap-4">
      <div className="glass rounded-3xl p-5 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg,rgba(245,158,11,0.15),rgba(234,88,12,0.15))" }}
          >
            <MIcon name="person" size={24} fill style={{ color: "#EA580C" }} />
          </span>
          <div className="min-w-0">
            <p className="font-display font-bold text-[16px] text-stone-900 truncate">{account.name}</p>
            <p className="text-[12px] text-stone-500 truncate">{account.email}</p>
          </div>
        </div>

        <div className="flex flex-col">
          <Radek label="Role">{account.role === "admin" ? "Správce" : "Strávník"}</Radek>
          <Radek label="E-mail">
            {account.emailVerified ? (
              <span className="inline-flex items-center gap-1 text-green-700">
                <MIcon name="check_circle" size={14} fill />
                ověřený
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-700">
                <MIcon name="schedule" size={14} />
                zatím neověřený
              </span>
            )}
          </Radek>
          {account.personCount > 1 && (
            <Radek label="Objednáváte za">{account.personCount} strávníky</Radek>
          )}
        </div>
      </div>

      <div className="glass rounded-3xl p-5 flex flex-col gap-3">
        <p className="font-display font-bold text-[14px] text-stone-900">Heslo</p>
        <ChangePasswordForm />
      </div>

      <button
        className="modal-btn modal-btn--secondary w-full flex items-center justify-center gap-2"
        disabled={isPending}
        onClick={handleLogout}
        type="button"
      >
        <MIcon name="logout" size={16} />
        {isPending ? "Odhlašuji…" : "Odhlásit se"}
      </button>
    </div>
  );
}
