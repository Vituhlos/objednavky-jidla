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
      <div className="hidden md:flex px-5 py-2.5 border-b border-white/50 items-center gap-3 topbar shrink-0">
        <MIcon name="feedback" size={16} fill style={{ color: "#D97706" }} />
        <span className="font-display font-bold text-[15px] text-stone-900">Připomínky k aplikaci</span>
      </div>

      {/* Mobile topbar */}
      <div className="md:hidden border-b border-white/50 topbar shrink-0 px-4 py-2.5">
        <span className="font-display font-bold text-[14px] text-stone-900">Připomínky</span>
      </div>

      <main className="flex-1 overflow-y-auto scroll-area p-4 md:p-5 pb-nav">
        <div className="flex flex-col lg:flex-row lg:items-start gap-4 lg:gap-5 max-w-[1100px]">

          {/* ── Formulář ── */}
          <section className="glass rounded-3xl overflow-hidden flex-1 min-w-0" aria-labelledby="feedback-form-title">
            <div className="px-4 md:px-5 py-4 border-b border-white/40" style={{ background: "rgba(245,158,11,0.07)" }}>
              <h1 id="feedback-form-title" className="font-display font-bold text-[16px] text-stone-900">
                Co byste v Kantýně změnili? ✍️
              </h1>
              <p className="text-[12.5px] text-stone-500 mt-1 leading-relaxed">
                Nápad, chyba, co vás štve nebo co se povedlo — všechno se hodí.
                Připomínky čte jen správce aplikace a podepsat se nemusíte.
              </p>
            </div>

            {sent ? (
              <div className="p-6 md:p-8 flex flex-col items-center text-center gap-3" role="status">
                <span className="text-[44px] leading-none" aria-hidden="true">🎉</span>
                <div className="font-display font-bold text-[17px] text-stone-900">Díky, připomínka dorazila!</div>
                <p className="text-[13px] text-stone-500 max-w-[360px] leading-relaxed">
                  Správce ji uvidí v Nastavení. Když se podle ní něco upraví, objeví se to vpravo v seznamu změn.
                </p>
                <button className="modal-btn modal-btn--secondary mt-2" onClick={() => setSent(false)} type="button">
                  Napsat další
                </button>
              </div>
            ) : (
              <form className="p-4 md:p-5 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>

                <fieldset className="flex flex-col gap-2">
                  <legend className="text-[12px] font-semibold text-stone-600 mb-2">O co jde?</legend>
                  <div className="flex flex-wrap gap-1.5">
                    {FEEDBACK_CATEGORIES.map((c) => {
                      const active = c.id === category;
                      return (
                        <label
                          key={c.id}
                          className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl text-[12.5px] font-semibold cursor-pointer select-none transition-all duration-150 active:scale-[0.97] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-amber-500/70 ${
                            active ? "text-white" : "glass-btn text-stone-600"
                          }`}
                          style={active ? {
                            background: "linear-gradient(135deg,#F59E0B,#EA580C)",
                            boxShadow: "0 2px 8px -2px rgba(234,88,12,0.35)",
                          } : {}}
                        >
                          <input
                            checked={active}
                            className="sr-only"
                            name="category"
                            onChange={() => setCategory(c.id)}
                            type="radio"
                            value={c.id}
                          />
                          <span aria-hidden="true">{c.emoji}</span>
                          {c.label}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                <label className="flex flex-col gap-1">
                  <span className="text-[12px] font-semibold text-stone-600">Vaše připomínka</span>
                  <textarea
                    className="modal-input min-h-[140px] resize-y leading-relaxed"
                    maxLength={FEEDBACK_LIMITS.messageMax}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={placeholderFor(category)}
                    required
                    value={message}
                  />
                  <span className={`text-[10.5px] self-end ${message.length > FEEDBACK_LIMITS.messageMax * 0.9 ? "text-amber-700" : "text-stone-400"}`}>
                    {message.length} / {FEEDBACK_LIMITS.messageMax}
                  </span>
                </label>

                <div className="flex flex-col gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-[12px] font-semibold text-stone-600">Jméno <span className="font-normal text-stone-400">(nepovinné)</span></span>
                    <input
                      autoComplete="name"
                      className="modal-input"
                      disabled={anonymous}
                      maxLength={FEEDBACK_LIMITS.nameMax}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ať se můžeme doptat"
                      type="text"
                      value={anonymous ? "" : name}
                    />
                  </label>
                  <label className="inline-flex items-center gap-2 text-[12.5px] text-stone-600 cursor-pointer select-none self-start">
                    <input
                      checked={anonymous}
                      className="w-4 h-4 accent-amber-600"
                      onChange={(e) => setAnonymous(e.target.checked)}
                      type="checkbox"
                    />
                    🕶️ Odeslat anonymně
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
                  <div className="text-[12.5px] text-red-700 bg-red-50/80 border border-red-200 rounded-xl px-3 py-2" role="alert">
                    {error}
                  </div>
                )}

                <div className="flex items-center gap-3 flex-wrap">
                  <button className="modal-btn modal-btn--primary inline-flex items-center gap-1.5" disabled={tooShort || isPending} type="submit">
                    <MIcon name="send" size={15} />
                    {isPending ? "Odesílám…" : "Odeslat připomínku"}
                  </button>
                  {tooShort && trimmedLength > 0 && (
                    <span className="text-[11.5px] text-stone-400">Ještě pár slov, prosím.</span>
                  )}
                </div>
              </form>
            )}
          </section>

          {/* ── Co jsme upravili ── */}
          <section className="glass rounded-3xl overflow-hidden lg:w-[380px] lg:shrink-0" aria-labelledby="feedback-done-title">
            <div className="px-4 md:px-5 py-3.5 border-b border-white/40 flex items-center gap-2" style={{ background: "rgba(79,138,83,0.08)" }}>
              <span aria-hidden="true">🛠️</span>
              <h2 id="feedback-done-title" className="font-display font-bold text-[14px] text-stone-900">Co jsme podle vás upravili</h2>
            </div>
            {replies.length === 0 ? (
              <p className="p-4 md:p-5 text-[12.5px] text-stone-400 leading-relaxed">
                Zatím tu nic není. První úprava podle vašich připomínek se objeví právě tady. 🌱
              </p>
            ) : (
              <ul className="p-2 md:p-3 flex flex-col gap-1">
                {replies.map((r) => {
                  const cat = getCategoryMeta(r.category);
                  return (
                    <li key={r.id} className="flex gap-3 px-2 py-2.5 rounded-2xl">
                      <span className="text-[20px] leading-none mt-0.5" aria-hidden="true">{cat.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] text-stone-800 leading-snug whitespace-pre-line break-words">{r.publicReply}</p>
                        <span className="text-[11px] text-stone-400">✅ {formatDate(r.resolvedAt)} · {cat.label}</span>
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
