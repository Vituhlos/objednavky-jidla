"use client";

import { useOptimistic, useState, useTransition, type Dispatch, type SetStateAction } from "react";
import { actionDeleteFeedback, actionUpdateFeedback } from "@/app/actions";
import {
  FEEDBACK_LIMITS,
  FEEDBACK_STATUSES,
  pluralizeVotes,
  getCategoryMeta,
  type FeedbackEntry,
  type FeedbackStatus,
} from "@/lib/feedback-meta";
import { formatFeedbackDate, parseDbDate } from "../feedback/feedback-utils";
import { StatusBadge } from "../feedback/StatusBadge";
import { ConfirmModal } from "../ConfirmModal";
import { FeedbackAttachments } from "./FeedbackAttachments";
import { FeedbackHandoff } from "./FeedbackHandoff";
import MIcon from "../MIcon";
import { SettingsSection } from "./SettingsPrimitives";

type Filter = "open" | "new" | "planned" | "done" | "all";

const OPEN_STATUSES: FeedbackStatus[] = ["new", "read", "planned"];

const FILTERS: { id: Filter; label: string; matches: (s: FeedbackStatus) => boolean }[] = [
  { id: "open",    label: "K vyřízení", matches: (s) => OPEN_STATUSES.includes(s) },
  { id: "new",     label: "Nové",       matches: (s) => s === "new" },
  { id: "planned", label: "V plánu",    matches: (s) => s === "planned" },
  { id: "done",    label: "Hotovo",     matches: (s) => s === "done" },
  { id: "all",     label: "Vše",        matches: () => true },
];

function formatRelative(value: string): string {
  const date = parseDbDate(value);
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return "právě teď";
  if (minutes < 60) return `před ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `před ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return "včera";
  if (days < 7) return `před ${days} dny`;
  return formatFeedbackDate(value);
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

  const active = FILTERS.find((f) => f.id === filter)!;
  // Rozkliknutá připomínka zůstane vidět, i když ji změna stavu z filtru vyřadí —
  // jinak by po kliknutí na „Hotovo“ zmizela dřív, než se dopíše odpověď.
  const visible = entries.filter((e) => active.matches(e.status) || e.id === expandedId);

  return (
    <SettingsSection
      icon="feedback"
      title="Připomínky od uživatelů"
      helpContent={
        <div className="text-[12px] text-stone-500 leading-relaxed pb-2 flex flex-col gap-1.5">
          <p>Připomínka se po rozkliknutí sama označí jako přečtená. Stav se mění jedním klikem.</p>
          <p><b>Odpověď</b> uvidí autor hned v kartě „Moje připomínky“ (jen ve svém prohlížeči). Když připomínku označíte jako <b>Hotovo</b>, objeví se odpověď i veřejně v seznamu „Změnili jsme díky vám“. Původní text ani autor se veřejně nikdy neukazují.</p>
          <p><b>Hlasování:</b> otevřené připomínce dejte krátký název (třeba „Tmavý režim“) a zapněte „Dát k hlasování“. Název se ukáže v kartě „Co chystáme“ a lidé u něj dávají 👍. Hlas je vázaný na prohlížeč, ne na člověka – kdo si smaže data prohlížeče, může hlasovat znovu. Berte počty jako orientační.</p>
          <p>Screenshoty vyřízených připomínek (Hotovo, Zamítnuto) se po 90 dnech samy smažou, text zůstává.</p>
          <p>Upozornění na Telegram si admin zapne v botovi: <code className="bg-black/5 px-1 rounded">/nastaveni</code> → 💬 Nové připomínky.</p>
        </div>
      }
    >
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2" role="group" aria-label="Filtr podle stavu">
        {FILTERS.map((f) => {
          const count = entries.filter((e) => f.matches(e.status)).length;
          const on = f.id === filter;
          return (
            <button
              key={f.id}
              aria-pressed={on}
              className={`fb-stat${on ? " fb-stat--active" : ""}`}
              onClick={() => setFilter(f.id)}
              type="button"
            >
              <span className="fb-stat__value" style={f.id === "new" && count > 0 ? { color: "#c2410c" } : undefined}>
                {isLoaded ? count : "–"}
              </span>
              <span className="fb-stat__label">{f.label}</span>
            </button>
          );
        })}
      </div>

      {loadError ? (
        <p className="text-[12.5px] text-red-600">{loadError}</p>
      ) : !isLoaded ? (
        <p className="text-[12.5px] text-stone-400">Načítám…</p>
      ) : visible.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon"><MIcon name="feedback" size={22} style={{ color: "#94a3b8" }} /></div>
          <p className="empty-state__title">{entries.length === 0 ? "Zatím žádné připomínky" : "Tady je prázdno"}</p>
          <p className="empty-state__sub">
            {entries.length === 0 ? "Objeví se tu, jakmile někdo pošle první" : "V tomhle filtru nic není"}
          </p>
        </div>
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
  // Stav se přepne hned; když server odmítne, React ho po skončení přechodu vrátí sám
  const [status, setOptimisticStatus] = useOptimistic(entry.status);
  const [adminNote, setAdminNote] = useState(entry.adminNote);
  const [publicReply, setPublicReply] = useState(entry.publicReply);
  const [voteTitle, setVoteTitle] = useState(entry.voteTitle);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  const textsDirty = adminNote !== entry.adminNote || publicReply !== entry.publicReply || voteTitle !== entry.voteTitle;

  const persist = (updates: { status?: FeedbackStatus; adminNote?: string; publicReply?: string; voteTitle?: string; votable?: boolean }) => {
    setError(null);
    startTransition(async () => {
      if (updates.status) setOptimisticStatus(updates.status);
      try {
        const updated = await actionUpdateFeedback(getPin(), entry.id, updates);
        onChange((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
        if (updates.adminNote !== undefined || updates.publicReply !== undefined) {
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Uložení se nepovedlo.");
      }
    });
  };

  const toggle = () => {
    // Rozkliknutí nové připomínky = přečteno, jako v poště
    if (!expanded && entry.status === "new") persist({ status: "read" });
    onToggle();
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
    <li className={`glass-soft rounded-2xl transition-shadow ${expanded ? "shadow-[0_10px_30px_-18px_rgba(26,18,8,0.35)]" : ""}`}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        className="w-full text-left flex items-start gap-3 px-3 py-3"
      >
        <span className="relative shrink-0">
          <span aria-hidden="true" className="fb-timeline__dot emoji" style={{ borderColor: "rgba(245,158,11,0.3)" }}>{cat.emoji}</span>
          {status === "new" && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white" style={{ background: "#EA580C" }} title="Nová" />
          )}
        </span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2 flex-wrap">
            <span className={`text-[13px] text-stone-800 ${status === "new" ? "font-bold" : "font-semibold"}`}>{cat.label}</span>
            <StatusBadge status={status} />
            <span className="ml-auto text-[11px] text-stone-400">{formatRelative(entry.createdAt)}</span>
          </span>
          <span className={`block text-[12.5px] text-stone-700 mt-1 break-words ${expanded ? "whitespace-pre-line" : "line-clamp-2"}`}>
            {entry.message}
          </span>
          <span className="flex items-center gap-1.5 mt-1.5 text-[11px] text-stone-400 flex-wrap">
            <span>{entry.authorName || "bez jména"}</span>
            {entry.page && <span>· {entry.page}</span>}
            {entry.device && <span>· {entry.device}</span>}
            {entry.appVersion && <span>· v{entry.appVersion}</span>}
            {(entry.votable || entry.votes > 0) && <span className="text-blue-700">· {pluralizeVotes(entry.votes)}</span>}
            {entry.attachments.length > 0 && (
              <span>· {entry.attachments.length} {entry.attachments.length === 1 ? "obrázek" : "obrázky"}</span>
            )}
          </span>
        </span>
        <MIcon name={expanded ? "expand_less" : "expand_more"} size={18} className="text-stone-400 shrink-0 mt-1.5" />
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-3 flex flex-col gap-3 border-t border-white/50 fade-up">
          {entry.context && (
            <div className="modal-field">
              <span className="modal-label">Technický údaj</span>
              <code className="text-[11.5px] text-stone-600 px-2.5 py-1.5 rounded-lg break-all" style={{ background: "rgba(26,18,8,0.05)" }}>{entry.context}</code>
            </div>
          )}
          <FeedbackAttachments attachments={entry.attachments} getPin={getPin} />
          <FeedbackHandoff entry={{ ...entry, adminNote, status }} />

          <div className="modal-field">
            <span className="modal-label">Stav</span>
            <div className="overflow-x-auto no-scrollbar -mx-1 px-1">
              <div
                aria-label="Stav připomínky"
                className="flex p-1 rounded-2xl gap-0.5"
                role="group"
                style={{ width: "max-content", background: "rgba(26,18,8,0.06)", border: "1px solid rgba(255,255,255,0.55)" }}
              >
                {FEEDBACK_STATUSES.map((s) => {
                  const on = s.id === status;
                  return (
                    <button
                      key={s.id}
                      aria-pressed={on}
                      className={`shrink-0 px-3 py-1.5 min-h-[34px] rounded-xl text-[12px] font-semibold transition-all duration-200 active:scale-[0.96] ${
                        on ? "text-white" : "text-stone-500 hover:text-stone-700 hover:bg-white/60"
                      }`}
                      onClick={() => { if (!on) persist({ status: s.id }); }}
                      style={on ? { background: "linear-gradient(135deg,#F59E0B,#EA580C)", boxShadow: "0 2px 8px -2px rgba(234,88,12,0.35)" } : {}}
                      type="button"
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="modal-field">
              <label className="modal-label" htmlFor={`fb-note-${entry.id}`}>
                Interní poznámka <span className="modal-label-price">vidíte jen vy</span>
              </label>
              <textarea
                className="modal-note"
                id={`fb-note-${entry.id}`}
                maxLength={FEEDBACK_LIMITS.adminNoteMax}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Co s tím uděláme, nebo proč ne…"
                rows={3}
                value={adminNote}
              />
            </div>

            <div className="modal-field">
              <label className="modal-label" htmlFor={`fb-reply-${entry.id}`}>
                Odpověď <span className="modal-label-price">autor ji uvidí hned, ostatní u stavu Hotovo</span>
              </label>
              <textarea
                className="modal-note"
                id={`fb-reply-${entry.id}`}
                maxLength={FEEDBACK_LIMITS.publicReplyMax}
                onChange={(e) => setPublicReply(e.target.value)}
                placeholder="Např. „Přidali jsme připomenutí uzávěrky do Telegramu.“"
                rows={3}
                value={publicReply}
              />
            </div>
          </div>

          {status !== "done" && status !== "rejected" && (
            <div className="flex flex-col gap-2 p-3 rounded-2xl" style={{ background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.12)" }}>
              <div className="modal-field">
                <label className="modal-label" htmlFor={`fb-vote-${entry.id}`}>
                  Název k hlasování <span className="modal-label-price">krátce, uvidí ho všichni</span>
                </label>
                <input
                  className="modal-input"
                  id={`fb-vote-${entry.id}`}
                  maxLength={FEEDBACK_LIMITS.voteTitleMax}
                  onChange={(e) => setVoteTitle(e.target.value)}
                  placeholder="Např. „Tmavý režim“"
                  type="text"
                  value={voteTitle}
                />
              </div>
              <label className={`flex items-start gap-2.5 select-none ${entry.voteTitle.trim() ? "cursor-pointer" : "opacity-60 cursor-not-allowed"}`}>
                <div className="relative shrink-0 mt-0.5">
                  <input
                    checked={entry.votable}
                    className="peer sr-only"
                    disabled={!entry.voteTitle.trim() || isPending}
                    onChange={(e) => persist({ votable: e.target.checked })}
                    type="checkbox"
                  />
                  <div className="w-9 h-5 rounded-full bg-black/15 transition-colors peer-checked:[background:linear-gradient(135deg,#F59E0B,#EA580C)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-amber-500/60" />
                  <div className="absolute top-[3px] left-[3px] w-3.5 h-3.5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
                </div>
                <span className="text-[12.5px] text-stone-700 leading-snug">
                  Dát k hlasování
                  <span className="block text-[11px] text-stone-400">
                    {entry.voteTitle.trim()
                      ? "Název se ukáže v kartě „Co chystáme“ a lidé u něj dávají 👍. Text autora ne."
                      : "Nejdřív napište a uložte název."}
                  </span>
                </span>
              </label>
            </div>
          )}

          {status === "done" && !publicReply.trim() && (
            <p className="text-[11.5px] text-amber-700 inline-flex items-center gap-1.5">
              <MIcon name="info" size={13} />
              Bez odpovědi se hotová připomínka v seznamu změn neukáže.
            </p>
          )}

          {error && <p className="text-[12px] text-red-500" role="alert">{error}</p>}

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-2xl glass-btn text-stone-600"
              disabled={!textsDirty || isPending}
              onClick={() => persist({ adminNote, publicReply, voteTitle })}
            >
              <MIcon name="check" size={14} />
              Uložit texty
            </button>
            {saved && (
              <span className="text-[12px] text-green-700 inline-flex items-center gap-1.5 fade-up">
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
