import Link from "next/link";
import MIcon from "../MIcon";

// Pevné pozice, ať se výbuch při každém renderu nepřeskupí (a sedí se SSR)
const BURST = [
  { e: "🎉", x: "-78px", y: "-58px", r: "-18deg", d: "0s" },
  { e: "💡", x: "70px", y: "-66px", r: "14deg", d: ".05s" },
  { e: "✨", x: "-96px", y: "4px", r: "0deg", d: ".1s" },
  { e: "🙌", x: "92px", y: "-8px", r: "10deg", d: ".08s" },
  { e: "💛", x: "-40px", y: "-88px", r: "-6deg", d: ".14s" },
  { e: "✨", x: "36px", y: "-92px", r: "6deg", d: ".18s" },
];

export function FeedbackSuccess({ name, onAgain }: { name: string; onAgain: () => void }) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-10 gap-3 fade-up" role="status">
      <div className="relative mb-2">
        {BURST.map((b, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="fb-burst emoji"
            style={{ "--x": b.x, "--y": b.y, "--r": b.r, "--d": b.d } as React.CSSProperties}
          >{b.e}</span>
        ))}
        <div className="fb-success__badge">
          <MIcon name="check" size={38} />
        </div>
      </div>
      <h2 className="font-display font-bold text-[20px] text-stone-900">
        Díky, dorazilo to!
      </h2>
      <p className="text-[12px] text-stone-400 -mt-2">{name.trim() ? `Odesláno pod jménem ${name.trim()}` : "Odesláno bez jména"}</p>
      <p className="text-[13px] text-stone-500 max-w-[340px] leading-relaxed">
        Správce si to přečte. Až se podle toho něco změní, objeví se to v seznamu změn.
      </p>
      <div className="flex items-center gap-2 mt-3 flex-wrap justify-center">
        <button className="modal-btn modal-btn--secondary" onClick={onAgain} type="button">Napsat další</button>
        <Link className="modal-btn modal-btn--primary inline-flex items-center gap-1.5" href="/">
          <MIcon name="restaurant_menu" size={15} />
          Zpátky k obědu
        </Link>
      </div>
    </div>
  );
}
