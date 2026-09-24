"use client";

import { useState, useTransition, type Dispatch, type SetStateAction } from "react";
import { actionDeleteFeedback, actionUpdateFeedback } from "@/app/actions";
import {
  FEEDBACK_LIMITS,
  FEEDBACK_STATUSES,
  getCategoryMeta,
  getStatusMeta,
  type FeedbackEntry,
  type FeedbackStatus,
} from "@/lib/feedback-meta";
import { ConfirmModal } from "../ConfirmModal";
import MIcon from "../MIcon";
import { SettingsSection } from "./SettingsPrimitives";

type Filter = "open" | "all" | FeedbackStatus;

const OPEN_STATUSES: FeedbackStatus[] = ["new", "read", "planned"];

// Stejná řeč barev jako štítky v historii: tlumené pozadí, sytý text.
const STATUS_STYLES: Record<FeedbackStatus, React.CSSProperties> = {
  new: { background: "rgba(234,88,12,0.12)", color: "#c2410c" },
  read: { background: "rgba(26,18,8,0.07)", color: "#7a6552" },
  planned: { background: "rgba(59,130,246,0.12)", color: "#1d4ed8" },
  done: { background: "rgba(21,128,61,0.12)", color: "#15803d" },
  rejected: { background: "rgba(26,18,8,0.05)", color: "#a8a29e" },
};

function StatusBadge({ status }: { status: FeedbackStatus }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold" style={STATUS_STYLES[status]}>
      {getStatusMeta(status).label}
    </span>
  );
}

/** Přepínač jako záložky Nastavení na mobilu — šedá lišta, aktivní položka v gradientu. */
function Segmented<T extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <div className="overflow-x-auto no-scrollbar -mx-1 px-1">
      <div
        aria-label={label}
        className="flex p-1 rounded-2xl gap-0.5"
        role="group"
        style={{ width: "max-content", background: "rgba(26,18,8,0.06)", border: "1px solid rgba(255,255,255,0.55)" }}
      >
        {items.map((item) => {
          const active = item.id === value;
          return (
            <button
              key={item.id}
              aria-pressed={active}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] rounded-xl text-[12px] font-semibold transition-all duration-200 active:scale-[0.96] ${
                active ? "text-white" : "text-stone-500 hover:text-stone-700 hover:bg-white/60"
              }`}
              onClick={() => onChange(item.id)}
              style={active ? { background: "linear-gradient(135deg,#F59E0B,#EA580C)", boxShadow: "0 2px 8px -2px rgba(234,88,12,0.35)" } : {}}
              type="button"
            >
              {item.label}
              {item.count !== undefined && (
                <span className={`text-[10.5px] ${active ? "text-white/80" : "text-stone-400"}`}>{item.count}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function formatDateTime(value: string): string {
  // SQLite datetime('now') je UTC bez zóny
  const d = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  return d.toLocaleString("cs-CZ", {
    day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
    timeZone: "Europe/Prague",
  });
}

function matchesFilter(entry: FeedbackEntry, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "open") return OPEN_STATUSES.includes(entry.status);
  return entry.status === filter;
}

/**
 * Správa připomínek z /pripominky.
 *
 * Seznam žije o patro výš v SettingsPage — počet nových čte i odznak u záložky.
 * Každá akce posílá PIN znovu: Server Actions jsou veřejné endpointy a to, že
 * je volá odemčená obrazovka, samo o sobě nic nezaručuje.
 */
export function FeedbackSection({
  entries,
  isLoaded,
  loadError,
  isActive,
  getPin,
  onChange,
}: {
  entries: FeedbackEntry[];
  isLoaded: boolean;
  loadError: string | null;
  isActive: boolean;
  getPin: () => string;
  onChange: Dispatch<SetStateAction<FeedbackEntry[]>>;
}) {
  const [filter, setFilter] = useState<Filter>("open");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (!isActive) return null;

  const counts = {
    open: entries.filter((e) => OPEN_STATUSES.includes(e.status)).length,
    all: entries.length,
    ...Object.fromEntries(FEEDBACK_STATUSES.map((s) => [s.id, entries.filter((e) => e.status === s.id).length])),
  } as Record<Filter, number>;

  const filters = [
    { id: "open" as Filter, label: "K vyřízení" },
    ...FEEDBACK_STATUSES.map((s) => ({ id: s.id as Filter, label: s.label })),
    { id: "all" as Filter, label: "Vše" },
  ].map((f) => ({ ...f, count: counts[f.id] ?? 0 }));

  const visible = entries.filter((e) => matchesFilter(e, filter));

  return (
    <SettingsSection
      icon="feedback"
      title="Připomínky od uživatelů"
      helpContent={
        <div className="text-[12px] text-stone-500 leading-relaxed pb-2 flex flex-col gap-1.5">
          <p>Když připomínku označíte jako <b>Hotovo</b> a vyplníte <b>veřejnou odpověď</b>, objeví se na stránce Připomínky v seznamu „Upravili jsme podle vás“. Původní text ani autor se veřejně nikdy neukazují.</p>
          <p>Upozornění na Telegram si admin zapne v botovi: <code className="bg-black/5 px-1 rounded">/nastaveni</code> → 💬 Nové připomínky.</p>
        </div>
      }
    >
      <p className="text-[12.5px] text-stone-500">
        Nápady a hlášení ze stránky Připomínky. IP adresa se neukládá, jméno je dobrovolné.
      </p>

      <Segmented items={filters} label="Filtr podle stavu" onChange={setFilter} value={filter} />

      {loadError ? (
        <p className="text-[12.5px] text-red-600">{loadError}</p>
      ) : !isLoaded ? (
        <p className="text-[12.5px] text-stone-400">Načítám…</p>
      ) : visible.length === 0 ? (
        <p className="text-[12.5px] text-stone-400">
          {entries.length === 0 ? "Zatím žádné připomínky." : "V tomhle filtru nic není."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((entry) => (
            <FeedbackItem
              key={entry.id}
              entry={entry}
              expanded={expandedId === entry.id}
              getPin={getPin}
              onToggle={() => setExpandedId((id) => (id === entry.id ? null : entry.id))}
              onChange={onChange}
            />
          ))}
        </ul>
      )}
    </SettingsSection>
  );
}

function FeedbackItem({
  entry,
  expanded,
  getPin,
  onToggle,
  onChange,
}: {
  entry: FeedbackEntry;
  expanded: boolean;
  getPin: () => string;
  onToggle: () => void;
  onChange: Dispatch<SetStateAction<FeedbackEntry[]>>;
}) {
  const cat = getCategoryMeta(entry.category);
  const [draftStatus, setDraftStatus] = useState<FeedbackStatus>(entry.status);
  const [adminNote, setAdminNote] = useState(entry.adminNote);
  const [publicReply, setPublicReply] = useState(entry.publicReply);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  const dirty =
    draftStatus !== entry.status || adminNote !== entry.adminNote || publicReply !== entry.publicReply;

  const save = (updates: { status?: FeedbackStatus; adminNote?: string; publicReply?: string }) => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        const updated = await actionUpdateFeedback(getPin(), entry.id, updates);
        onChange((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
        setDraftStatus(updated.status);
        setAdminNote(updated.adminNote);
        setPublicReply(updated.publicReply);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Uložení se nepovedlo.");
      }
    });
  };

  const remove = () => {
    setError(null);
    startTransition(async () => {
      try {
        await actionDeleteFeedback(getPin(), entry.id);
        setConfirmDelete(false);
        onChange((prev) => prev.filter((e) => e.id !== entry.id));
      } catch (err) {
        setConfirmDelete(false);
        setError(err instanceof Error ? err.message : "Smazání se nepovedlo.");
      }
    });
  };

  return (
    <li className="glass-soft rounded-2xl">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full text-left flex items-start gap-3 px-3 py-2.5"
      >
        <span className="text-[18px] leading-none mt-0.5" aria-hidden="true">{cat.emoji}</span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2 flex-wrap">
            {entry.status === "new" && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: "#EA580C" }} title="Nová" />}
            <span className="text-[13px] font-semibold text-stone-800">{cat.label}</span>
            <StatusBadge status={entry.status} />
          </span>
          <span className={`block text-[12.5px] text-stone-700 mt-1 break-words ${expanded ? "whitespace-pre-line" : "line-clamp-2"}`}>
            {entry.message}
          </span>
          <span className="block text-[11px] text-stone-400 mt-1">
            {entry.authorName || "anonymně"} · {formatDateTime(entry.createdAt)}
            {entry.page && <> · {entry.page}</>}
            {entry.device && <> · {entry.device}</>}
          </span>
        </span>
        <MIcon name={expanded ? "expand_less" : "expand_more"} size={18} className="text-stone-400 shrink-0 mt-0.5" />
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-3 flex flex-col gap-3 border-t border-white/50">
          <div className="modal-field">
            <span className="modal-label">Stav</span>
            <Segmented
              items={FEEDBACK_STATUSES.map((s) => ({ id: s.id, label: s.label }))}
              label="Stav připomínky"
              onChange={setDraftStatus}
              value={draftStatus}
            />
          </div>

          <div className="modal-field">
            <label className="modal-label" htmlFor={`fb-note-${entry.id}`}>
              Interní poznámka <span className="modal-label-price">vidíte jen vy</span>
            </label>
            <textarea
              className="modal-note"
              id={`fb-note-${entry.id}`}
              maxLength={FEEDBACK_LIMITS.adminNoteMax}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="Třeba co s tím uděláme nebo proč ne…"
              rows={2}
              value={adminNote}
            />
          </div>

          <div className="modal-field">
            <label className="modal-label" htmlFor={`fb-reply-${entry.id}`}>
              Veřejná odpověď <span className="modal-label-price">ukáže se všem, když je stav Hotovo</span>
            </label>
            <textarea
              className="modal-note"
              id={`fb-reply-${entry.id}`}
              maxLength={FEEDBACK_LIMITS.publicReplyMax}
              onChange={(e) => setPublicReply(e.target.value)}
              placeholder="Např. „Přidali jsme připomenutí uzávěrky do Telegramu.“"
              rows={2}
              value={publicReply}
            />
            {draftStatus === "done" && !publicReply.trim() && (
              <span className="text-[11px] text-stone-400">Bez veřejné odpovědi se hotová připomínka na stránce Připomínky neukáže.</span>
            )}
          </div>

          {error && <p className="text-[12px] text-red-500" role="alert">{error}</p>}

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-2xl glass-btn text-stone-600"
              disabled={!dirty || isPending}
              onClick={() => save({ status: draftStatus, adminNote, publicReply })}
            >
              <MIcon name="check" size={14} />
              {isPending ? "Ukládám…" : "Uložit"}
            </button>
            {entry.status === "new" && !dirty && (
              <button
                type="button"
                className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-2xl glass-btn text-stone-600"
                disabled={isPending}
                onClick={() => save({ status: "read" })}
              >
                Označit jako přečtené
              </button>
            )}
            {saved && (
              <span className="text-[12px] text-green-700 inline-flex items-center gap-1.5">
                <MIcon name="check_circle" size={14} /> Uloženo
              </span>
            )}
            <button
              type="button"
              className="ml-auto shrink-0 inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-2xl text-red-600 transition"
              style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.15)" }}
              disabled={isPending}
              onClick={() => setConfirmDelete(true)}
            >
              <MIcon name="delete" size={14} />
              Smazat
            </button>
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Smazat připomínku?"
          message="Smaže se natrvalo, včetně poznámky a veřejné odpovědi. Hodí se hlavně na spam."
          isPending={isPending}
          onConfirm={remove}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </li>
  );
}
