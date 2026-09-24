"use client";

import { useEffect, useState, useTransition } from "react";
import { actionSubmitFeedback } from "@/app/actions";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_LIMITS,
  getCategoryMeta,
  type FeedbackCategory,
  type PublicFeedbackReply,
} from "@/lib/feedback-meta";
import MIcon from "./MIcon";

function formatDate(value: string): string {
  // SQLite datetime je v UTC bez zóny — bez "Z" by ho prohlížeč bral jako místní čas
  const d = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  return d.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric", timeZone: "Europe/Prague" });
}

/** Odkud člověk na stránku přišel — jen cesta v rámci appky, nic jiného. */
function getReferrerPath(): string {
  try {
    if (!document.referrer) return "";
    const url = new URL(document.referrer);
    if (url.origin !== window.location.origin) return "";
    return url.pathname === "/pripominky" ? "" : url.pathname;
  } catch {
    return "";
  }
}

function getRememberedName(): string {
  try {
    const first = localStorage.getItem("lastFirstName") ?? "";
    const last = localStorage.getItem("lastLastName") ?? "";
    return `${first} ${last}`.trim();
  } catch {
    return "";
  }
}

export default function FeedbackPage({ replies }: { replies: PublicFeedbackReply[] }) {
  const [category, setCategory] = useState<FeedbackCategory>("napad");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  // localStorage existuje jen v prohlížeči — načíst až po hydrataci
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- jednorázové předvyplnění z prohlížeče
    setName(getRememberedName());
  }, []);

  const trimmedLength = message.trim().length;
  const tooShort = trimmedLength < FEEDBACK_LIMITS.messageMin;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (tooShort || isPending) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await actionSubmitFeedback({
          category,
          message,
          authorName: anonymous ? "" : name,
          page: getReferrerPath(),
          website,
        });
        if (res.ok) {
          setSent(true);
          setMessage("");
        } else {
          setError(res.error);
        }
      } catch {
        setError("Připomínku se nepodařilo odeslat. Zkuste to prosím znovu.");
      }
    });
  };

  return (
    <div className="k-shell">

      {/* Desktop topbar */}
      <div className="hidden md:flex px-5 py-2.5 border-b border-white/50 items-center gap-4 topbar shrink-0">
        <span className="font-display font-bold text-[15px] text-stone-900">Připomínky</span>
        <span className="text-[12px] text-stone-500">Co byste v Kantýně změnili, přidali nebo opravili</span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-stone-500">
          <MIcon name="lock" size={13} style={{ color: "#a8a29e" }} />
          Čte jen správce · můžete i anonymně
        </span>
      </div>

      {/* Mobile topbar */}
      <div className="md:hidden border-b border-white/50 topbar shrink-0">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <span className="font-display font-bold text-[14px] text-stone-900 flex-1">Připomínky</span>
          <span className="inline-flex items-center gap-1 text-[11px] text-stone-500">
            <MIcon name="lock" size={12} style={{ color: "#a8a29e" }} />
            Čte jen správce
          </span>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto scroll-area p-4 md:p-5 pb-nav">
        <div className="flex flex-col lg:flex-row lg:items-start gap-4">

          {/* ── Formulář ── */}
          <section className="glass rounded-3xl overflow-hidden flex-1 min-w-0 lg:max-w-[720px]">
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/40" style={{ background: "rgba(245,158,11,0.07)" }}>
              <MIcon name="edit" size={17} style={{ color: "#D97706" }} />
              <h1 className="font-display font-bold text-[13.5px] text-stone-900 flex-1">Nová připomínka</h1>
            </div>

            {sent ? (
              <div className="empty-state" role="status">
                <div className="empty-state__icon" style={{ background: "rgba(21,128,61,0.08)", borderColor: "rgba(21,128,61,0.25)" }}>
                  <MIcon name="check" size={22} style={{ color: "#15803d" }} />
                </div>
                <p className="empty-state__title">Díky, připomínka dorazila 🙌</p>
                <p className="empty-state__sub" style={{ maxWidth: 280 }}>
                  Když se podle ní něco upraví, objeví se to v seznamu změn.
                </p>
                <button className="modal-btn modal-btn--secondary mt-1" onClick={() => setSent(false)} type="button">
                  Napsat další
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                <div className="p-4 flex flex-col gap-4">

                  <fieldset className="modal-field">
                    <legend className="modal-label mb-1.5">O co jde?</legend>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {FEEDBACK_CATEGORIES.map((c) => {
                        const active = c.id === category;
                        return (
                          <label
                            key={c.id}
                            className={`flex items-center gap-2 px-3 py-2.5 min-h-[44px] rounded-[14px] text-[12.5px] cursor-pointer select-none transition active:scale-[0.98] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-amber-500/60 ${
                              active ? "sidebar-item-active font-semibold text-stone-900" : "font-medium text-stone-600 hover:bg-white/70"
                            }`}
                            style={active ? {} : { background: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.68)" }}
                          >
                            <input
                              checked={active}
                              className="sr-only"
                              name="category"
                              onChange={() => setCategory(c.id)}
                              type="radio"
                              value={c.id}
                            />
                            <span className="text-[16px] leading-none" aria-hidden="true">{c.emoji}</span>
                            <span className="leading-tight">{c.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>

                  <div className="modal-field">
                    <label className="modal-label" htmlFor="feedback-message">Vaše připomínka</label>
                    <textarea
                      className="modal-note"
                      id="feedback-message"
                      maxLength={FEEDBACK_LIMITS.messageMax}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={placeholderFor(category)}
                      rows={5}
                      value={message}
                    />
                    <span className={`text-[11px] self-end ${message.length > FEEDBACK_LIMITS.messageMax * 0.9 ? "text-amber-700" : "text-stone-400"}`}>
                      {message.length} / {FEEDBACK_LIMITS.messageMax}
                    </span>
                  </div>

                  <div className="modal-field">
                    <label className="modal-label" htmlFor="feedback-name">
                      Jméno <span className="modal-label-price">nepovinné</span>
                    </label>
                    <input
                      autoComplete="name"
                      className="modal-input"
                      disabled={anonymous}
                      id="feedback-name"
                      maxLength={FEEDBACK_LIMITS.nameMax}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={anonymous ? "Odešle se anonymně" : "Ať se můžeme doptat"}
                      type="text"
                      value={anonymous ? "" : name}
                    />
                    <label className="flex items-center gap-2 cursor-pointer select-none self-start mt-1.5">
                      <div className="relative shrink-0">
                        <input checked={anonymous} className="peer sr-only" onChange={(e) => setAnonymous(e.target.checked)} type="checkbox" />
                        <div className="w-8 h-[18px] rounded-full bg-black/15 transition-colors peer-checked:[background:linear-gradient(135deg,#F59E0B,#EA580C)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-amber-500/60" />
                        <div className="absolute top-[3px] left-[3px] w-3 h-3 rounded-full bg-white shadow transition-transform peer-checked:translate-x-[14px]" />
                      </div>
                      <span className="text-[12px] text-stone-600">Odeslat anonymně</span>
                    </label>
                  </div>

                  {/* Past na roboty — člověk pole nevidí a nevyplní */}
                  <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
                    <label>
                      Web
                      <input autoComplete="off" name="website" onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} type="text" value={website} />
                    </label>
                  </div>

                  {error && (
                    <div role="alert" className="px-3 py-2 rounded-xl text-[12px] text-red-700 font-medium flex items-center gap-1.5"
                      style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.18)" }}>
                      <MIcon name="warning" size={13} style={{ color: "#dc2626", flexShrink: 0 }} />
                      {error}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 px-4 py-3 border-t border-white/40">
                  <span className="text-[11.5px] text-stone-400 flex-1">
                    {tooShort && trimmedLength > 0 ? "Ještě pár slov, prosím." : "IP adresa se neukládá."}
                  </span>
                  <button className="modal-btn modal-btn--primary inline-flex items-center gap-1.5" disabled={tooShort || isPending} type="submit">
                    <MIcon name="send" size={14} />
                    {isPending ? "Odesílám…" : "Odeslat"}
                  </button>
                </div>
              </form>
            )}
          </section>

          {/* ── Co jsme upravili ── */}
          <section className="glass rounded-3xl overflow-hidden lg:w-[360px] lg:shrink-0">
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/40" style={{ background: "rgba(21,128,61,0.06)" }}>
              <MIcon name="check_circle" size={17} fill style={{ color: "#15803d" }} />
              <h2 className="font-display font-bold text-[13.5px] text-stone-900 flex-1">Upravili jsme podle vás</h2>
              {replies.length > 0 && <span className="text-[11px] text-stone-500">{replies.length} změn</span>}
            </div>
            {replies.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state__icon">
                  <MIcon name="check_circle" size={22} style={{ color: "#94a3b8" }} />
                </div>
                <p className="empty-state__title">Zatím tu nic není</p>
                <p className="empty-state__sub">První úprava podle vašich připomínek se objeví tady</p>
              </div>
            ) : (
              <ul>
                {replies.map((r) => {
                  const cat = getCategoryMeta(r.category);
                  return (
                    <li key={r.id} className="flex gap-3 px-4 py-3 border-b border-white/40 last:border-b-0">
                      <span className="text-[16px] leading-none mt-0.5" aria-hidden="true">{cat.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] text-stone-800 leading-snug whitespace-pre-line break-words">{r.publicReply}</p>
                        <span className="text-[11px] text-stone-400">{formatDate(r.resolvedAt)} · {cat.label}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function placeholderFor(category: FeedbackCategory): string {
  switch (category) {
    case "chyba": return "Co jste dělali a co se stalo? Třeba: „Po kliknutí na Uložit se řádek neuložil…“";
    case "jidlo": return "Co by vám usnadnilo objednávání? Chybí něco v jídelníčku nebo v přílohách?";
    case "ovladani": return "Co je nepřehledné, špatně čitelné nebo zbytečně složité?";
    case "mobil": return "Co na telefonu nefunguje nebo se špatně ovládá? Jaký máte telefon?";
    case "pochvala": return "Co se povedlo? Uděláme víc toho 🙂";
    case "jine": return "Cokoli, co vás ke Kantýně napadne…";
    default: return "Co byste přidali nebo udělali jinak?";
  }
}
