const STEPS = [
  { emoji: "✍️", text: "Napíšeš, co tě napadlo" },
  { emoji: "👀", text: "Přečte si to správce" },
  { emoji: "✅", text: "Změny uvidíš níž" },
] as const;

/** Tři kroky, které odpovídají na „a kdo to čte?“ dřív, než to člověk musí hledat. */
export function HowItWorks() {
  return (
    <section className="glass rounded-3xl p-4" aria-label="Jak to funguje">
      <ol className="fb-steps">
        {STEPS.map((s) => (
          <li key={s.emoji} className="fb-step">
            <span aria-hidden="true" className="fb-step__icon emoji">{s.emoji}</span>
            <span className="text-[12px] font-medium text-stone-700 leading-snug">{s.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
