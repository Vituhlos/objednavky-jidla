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

const STATUS_TONES: Record<FeedbackStatus, string> = {
  new: "bg-amber-100 text-amber-800",
  read: "bg-sky-100 text-sky-800",
  planned: "bg-violet-100 text-violet-800",
  done: "bg-green-100 text-green-800",
  rejected: "bg-stone-200 text-stone-600",
};

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

  const filters: { id: Filter; label: string }[] = [
    { id: "open", label: "📬 K vyřízení" },
    ...FEEDBACK_STATUSES.map((s) => ({ id: s.id as Filter, label: `${s.emoji} ${s.label}` })),
    { id: "all", label: "Vše" },
  ];

  const visible = entries.filter((e) => matchesFilter(e, filter));

  return (
    <SettingsSection
      icon="feedback"
      title={`Připomínky od uživatelů${counts.new > 0 ? ` · ${counts.new} nových` : ""}`}
      helpContent={
        <div className="text-[12px] text-stone-500 leading-relaxed pb-2 flex flex-col gap-1.5">
          <p>Lidé je posílají ze stránky <b>Připomínky</b> v menu. IP adresa se neukládá, jméno je dobrovolné.</p>
          <p>Když připomínku označíte jako <b>✅ Hotovo</b> a vyplníte <b>veřejnou odpověď</b>, objeví se na stránce Připomínky v seznamu „Co jsme podle vás upravili“. Původní text ani autor se veřejně nikdy neukazují.</p>
          <p>Upozornění na Telegram si admin zapne v botovi: <code className="bg-black/5 px-1 rounded">/nastaveni</code> → 💬 Nové připomínky.</p>
        </div>
      }
    >
      <div className="flex gap-1.5 flex-wrap">
        {filters.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`text-[12px] font-semibold px-2.5 py-1.5 rounded-xl transition ${active ? "text-white" : "glass-btn text-stone-600"}`}
              style={active ? { background: "linear-gradient(135deg,#F59E0B,#EA580C)" } : {}}
            >
              {f.label}
              <span className={`ml-1.5 text-[10.5px] ${active ? "text-white/80" : "text-stone-400"}`}>{counts[f.id] ?? 0}</span>
            </button>
          );
        })}
      </div>

      {loadError ? (
        <p className="text-[12.5px] text-red-600">{loadError}</p>
      ) : !isLoaded ? (
        <p className="text-[12.5px] text-stone-400">Načítám…</p>
      ) : visible.length === 0 ? (
        <p className="text-[12.5px] text-stone-400 py-2">
          {entries.length === 0 ? "Zatím žádné připomínky. 📭" : "V tomhle filtru nic není. 🎉"}
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
  const status = getStatusMeta(entry.status);
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
    <li className={`rounded-2xl border transition ${entry.status === "new" ? "border-amber-300/70 bg-amber-50/50" : "border-white/60 bg-white/40"}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full text-left flex items-start gap-3 px-3 py-2.5"
      >
        <span className="text-[20px] leading-none mt-0.5" aria-hidden="true">{cat.emoji}</span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[12.5px] font-semibold text-stone-800">{cat.label}</span>
            <span className={`text-[10.5px] px-1.5 py-0.5 rounded-full font-semibold ${STATUS_TONES[entry.status]}`}>
              {status.emoji} {status.label}
            </span>
          </span>
          <span className={`block text-[13px] text-stone-700 mt-1 break-words ${expanded ? "whitespace-pre-line" : "line-clamp-2"}`}>
            {entry.message}
          </span>
          <span className="block text-[11px] text-stone-400 mt-1">
            {entry.authorName || "🕶️ anonymně"} · {formatDateTime(entry.createdAt)}
            {entry.page && <> · 📍 {entry.page}</>}
            {entry.device && <> · {entry.device === "mobil" ? "📱" : "💻"} {entry.device}</>}
          </span>
        </span>
        <MIcon name={expanded ? "expand_less" : "expand_more"} size={18} className="text-stone-400 shrink-0 mt-0.5" />
      </button>

      {expanded && (
        <div className="px-3 pb-3 flex flex-col gap-3 border-t border-white/60 pt-3">
          <div className="flex flex-col gap-1">
            <span className="text-[12px] font-semibold text-stone-600">Stav</span>
            <div className="flex gap-1.5 flex-wrap">
              {FEEDBACK_STATUSES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setDraftStatus(s.id)}
                  aria-pressed={draftStatus === s.id}
                  className={`text-[12px] px-2.5 py-1.5 rounded-xl font-semibold transition ${draftStatus === s.id ? STATUS_TONES[s.id] + " ring-2 ring-amber-400/60" : "glass-btn text-stone-500"}`}
                >
                  {s.emoji} {s.label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-semibold text-stone-600">Interní poznámka <span className="font-normal text-stone-400">(vidíte jen vy)</span></span>
            <textarea
              className="modal-input min-h-[60px] resize-y"
              maxLength={FEEDBACK_LIMITS.adminNoteMax}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="Třeba co s tím uděláme nebo proč ne…"
              value={adminNote}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-semibold text-stone-600">Veřejná odpověď <span className="font-normal text-stone-400">(ukáže se všem, když je stav ✅ Hotovo)</span></span>
            <textarea
              className="modal-input min-h-[60px] resize-y"
              maxLength={FEEDBACK_LIMITS.publicReplyMax}
              onChange={(e) => setPublicReply(e.target.value)}
              placeholder="Např. „Přidali jsme připomenutí uzávěrky do Telegramu.“"
              value={publicReply}
            />
            {draftStatus === "done" && !publicReply.trim() && (
              <span className="text-[11px] text-stone-400">Bez veřejné odpovědi se hotová připomínka na stránce Připomínky neukáže.</span>
            )}
          </label>

          {error && <p className="text-[12px] text-red-600" role="alert">{error}</p>}

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              className="modal-btn modal-btn--primary"
              disabled={!dirty || isPending}
              onClick={() => save({ status: draftStatus, adminNote, publicReply })}
            >
              {isPending ? "Ukládám…" : "Uložit"}
            </button>
            {entry.status === "new" && !dirty && (
              <button type="button" className="modal-btn modal-btn--secondary" disabled={isPending} onClick={() => save({ status: "read" })}>
                👀 Označit jako přečtené
              </button>
            )}
            {saved && <span className="text-[12px] text-emerald-700">Uloženo.</span>}
            <button
              type="button"
              className="ml-auto w-8 h-8 rounded-lg glass-btn-danger inline-flex items-center justify-center text-red-500"
              disabled={isPending}
              onClick={() => setConfirmDelete(true)}
              title="Smazat připomínku"
              aria-label="Smazat připomínku"
            >
              <MIcon name="delete" size={16} />
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
