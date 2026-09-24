const STEPS = [
  { emoji: "✍️", title: "Napíšeš", text: "co tě napadne" },
  { emoji: "👀", title: "Správce si to přečte", text: "nikdo jiný to nevidí" },
  { emoji: "✅", title: "Změníme to", text: "a ukáže se to tady" },
] as const;

/** Tři kroky, které odpovídají na „a kdo to čte?“ dřív, než to člověk musí hledat. */
export function HowItWorks() {
  return (
    <section className="glass rounded-3xl p-4" aria-label="Jak to funguje">
      <ol className="fb-steps">
        {STEPS.map((s) => (
          <li key={s.title} className="fb-step">
            <span aria-hidden="true" className="fb-step__icon emoji">{s.emoji}</span>
            <span className="text-[12px] font-semibold text-stone-800 leading-tight">{s.title}</span>
            <span className="text-[11px] text-stone-400 leading-snug">{s.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
