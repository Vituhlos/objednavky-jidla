import { Fragment } from "react";

const STEPS = [
  { emoji: "✍️", text: "Napíšeš, co tě napadlo" },
  { emoji: "👀", text: "Přečte si to správce" },
  { emoji: "✅", text: "Změny uvidíš níž" },
] as const;

/** Šipka mezi kroky — v gradientu appky, zarovnaná na střed koleček. */
function StepArrow({ id }: { id: string }) {
  return (
    <svg aria-hidden="true" className="fb-step__arrow" fill="none" height="14" viewBox="0 0 30 14" width="30">
      <defs>
        <linearGradient id={id} x1="0" x2="30" y1="0" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#F59E0B" stopOpacity="0.45" />
          <stop offset="1" stopColor="#EA580C" />
        </linearGradient>
      </defs>
      <path d="M2 7h24M20 2l6 5-6 5" stroke={`url(#${id})`} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

/** Tři kroky, které odpovídají na „a kdo to čte?“ dřív, než to člověk musí hledat. */
export function HowItWorks() {
  return (
    <section className="glass rounded-3xl p-4" aria-label="Jak to funguje">
      <ol className="fb-steps">
        {STEPS.map((s, i) => (
          <Fragment key={s.emoji}>
            {i > 0 && <li aria-hidden="true" className="fb-steps__sep"><StepArrow id={`fb-arrow-${i}`} /></li>}
            <li className="fb-step">
              <span aria-hidden="true" className="fb-step__icon emoji">{s.emoji}</span>
              <span className="text-[12px] font-medium text-stone-700 leading-snug">{s.text}</span>
            </li>
          </Fragment>
        ))}
      </ol>
    </section>
  );
}
