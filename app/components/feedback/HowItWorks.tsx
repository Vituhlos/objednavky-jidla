import MIcon from "../MIcon";

const STEPS = [
  { emoji: "✍️", text: "Napíšeš, co tě napadlo nebo co nefunguje." },
  { emoji: "👀", text: "Přečte si to jen správce aplikace." },
  { emoji: "✅", text: "Když se podle toho něco změní, uvidíš to níž v seznamu." },
] as const;

/** Tři kroky, které odpovídají na „a kdo to čte?“ dřív, než to člověk musí hledat. */
export function HowItWorks() {
  return (
    <section className="glass rounded-3xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/40" style={{ background: "rgba(245,158,11,0.07)" }}>
        <MIcon name="info" size={17} style={{ color: "#D97706" }} />
        <h2 className="font-display font-bold text-[13.5px] text-stone-900">Jak to funguje</h2>
      </div>
      <ol className="flex flex-col gap-3 p-4">
        {STEPS.map((s) => (
          <li key={s.emoji} className="flex items-center gap-3">
            <span aria-hidden="true" className="fb-step__icon emoji">{s.emoji}</span>
            <span className="text-[13px] text-stone-700 leading-snug">{s.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
