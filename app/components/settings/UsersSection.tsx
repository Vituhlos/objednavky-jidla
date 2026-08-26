"use client";

import { useEffect, useState, useTransition } from "react";
import {
  actionBootstrapPasswordUnchanged,
  actionCreateResetLink,
  actionDeleteUser,
  actionListUsers,
  actionSetUserRole,
  actionSetUserStatus,
} from "@/app/actions";
import { formatCzechDateTime } from "@/lib/format";
import type { AuthUser } from "@/lib/auth/users";
import { ConfirmModal } from "../ConfirmModal";
import MIcon from "../MIcon";
import { SettingsSection } from "./SettingsPrimitives";

/**
 * Správa účtů.
 *
 * Správce nic neschvaluje — kontrola je zpětná (R2). Proto se tu nedá účet
 * založit, jen dohlédnout na ty, které vznikly: zablokovat, změnit roli,
 * smazat, poslat odkaz na nové heslo.
 *
 * Cizí heslo správce nenastavuje. Generuje odkaz, takže se k němu nedostane.
 */
export function UsersSection({ isActive }: { isActive: boolean }) {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [bootstrapWarning, setBootstrapWarning] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetLink, setResetLink] = useState<{ name: string; url: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AuthUser | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!isActive || loaded) return;
    Promise.all([actionListUsers(), actionBootstrapPasswordUnchanged()])
      .then(([list, warn]) => {
        setUsers(list);
        setBootstrapWarning(warn);
      })
      .catch(() => setError("Účty se nepodařilo načíst."))
      .finally(() => setLoaded(true));
  }, [isActive, loaded]);

  const reload = () =>
    actionListUsers()
      .then(setUsers)
      .catch(() => {});

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error);
      await reload();
    });
  };

  if (!isActive) return null;

  return (
    <SettingsSection icon="manage_accounts" title={`Účty${users.length > 0 ? ` (${users.length})` : ""}`}>
      <p className="text-[12.5px] text-stone-500">
        Účty vznikají registrací, nic se neschvaluje. Kontrola je zpětná — tady účet
        zablokuješ, změníš mu roli nebo ho smažeš.
      </p>

      {bootstrapWarning && (
        <div
          className="rounded-2xl p-3 flex items-start gap-2"
          style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.18)" }}
        >
          <MIcon name="warning" size={15} style={{ color: "#dc2626", flexShrink: 0, marginTop: 1 }} />
          <span className="text-[12px] text-stone-700">
            První správce má pořád heslo z proměnné <code>ADMIN_PASSWORD</code>. Změň si ho
            ve svém účtu — dokud je stejné, zná ho každý, kdo vidí konfiguraci serveru.
          </span>
        </div>
      )}

      {error && <p className="text-[12px] text-red-500">{error}</p>}

      {resetLink && (
        <div
          className="rounded-2xl p-3 flex flex-col gap-2"
          style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.18)" }}
        >
          <p className="text-[12px] text-stone-700">
            Odkaz pro <b>{resetLink.name}</b>. Platí patnáct minut a je jednorázový.
            Pošli mu ho — heslo si nastaví sám.
          </p>
          <input
            aria-label={`Odkaz na obnovu hesla pro ${resetLink.name}`}
            className="modal-input text-[12px]"
            onFocus={(e) => e.currentTarget.select()}
            readOnly
            value={resetLink.url}
          />
          <button
            className="modal-btn modal-btn--secondary"
            onClick={() => setResetLink(null)}
            type="button"
          >
            Zavřít
          </button>
        </div>
      )}

      {!loaded ? (
        <p className="text-[12.5px] text-stone-400">Načítám…</p>
      ) : users.length === 0 ? (
        <p className="text-[12.5px] text-stone-400">Zatím nikdo — účty vzniknou první registrací.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {users.map((u) => (
            <div
              className={`glass-soft rounded-2xl px-3 py-2.5 flex flex-wrap items-center gap-2 ${u.status === "blocked" ? "opacity-60" : ""}`}
              key={u.id}
            >
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-stone-800 truncate">
                  {u.name}
                  {u.role === "admin" && (
                    <span className="ml-1.5 text-[11px] font-semibold text-amber-700">správce</span>
                  )}
                  {u.status === "blocked" && (
                    <span className="ml-1.5 text-[11px] font-semibold text-red-600">zablokován</span>
                  )}
                </div>
                <div className="text-[11px] text-stone-400 truncate">
                  {u.email}
                  {" · "}
                  {u.providers.includes("google") ? "ověřeno Googlem" : u.emailVerified ? "e-mail ověřen" : "neověřeno"}
                  {u.lastLoginAt && <> · naposledy {formatCzechDateTime(u.lastLoginAt)}</>}
                </div>
              </div>

              <button
                aria-label={
                  u.status === "active" ? `Zablokovat ${u.name}` : `Odblokovat ${u.name}`
                }
                className="modal-btn modal-btn--secondary shrink-0"
                disabled={isPending}
                onClick={() =>
                  run(() => actionSetUserStatus(u.id, u.status === "active" ? "blocked" : "active"))
                }
                type="button"
              >
                {u.status === "active" ? "Zablokovat" : "Odblokovat"}
              </button>

              <button
                aria-label={u.role === "admin" ? `Odebrat správce ${u.name}` : `Udělat správcem ${u.name}`}
                className="modal-btn modal-btn--secondary shrink-0"
                disabled={isPending}
                onClick={() => run(() => actionSetUserRole(u.id, u.role === "admin" ? "user" : "admin"))}
                type="button"
              >
                {u.role === "admin" ? "Odebrat správce" : "Udělat správcem"}
              </button>

              <button
                aria-label={`Poslat ${u.name} odkaz na nové heslo`}
                className="modal-btn modal-btn--secondary shrink-0"
                disabled={isPending}
                onClick={() => {
                  setError(null);
                  startTransition(async () => {
                    const res = await actionCreateResetLink(u.id);
                    if (res.ok) setResetLink({ name: u.name, url: res.url });
                    else setError(res.error);
                  });
                }}
                type="button"
              >
                Odkaz na heslo
              </button>

              <button
                aria-label={`Smazat účet ${u.name}`}
                className="modal-btn modal-btn--secondary shrink-0"
                disabled={isPending}
                onClick={() => setConfirmDelete(u)}
                type="button"
              >
                Smazat
              </button>
            </div>
          ))}
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal
          confirmLabel="Smazat účet"
          isPending={isPending}
          message={`Smaže se přihlášení účtu „${confirmDelete.name}“. Strávník a jeho objednávky zůstanou v historii, jen se označí jako neaktivní — jinak by přestaly sedět součty za minulé měsíce.`}
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => {
            const id = confirmDelete.id;
            setConfirmDelete(null);
            run(() => actionDeleteUser(id));
          }}
          title="Smazat účet"
        />
      )}
    </SettingsSection>
  );
}
