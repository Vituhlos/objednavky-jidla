import Link from "next/link";
import MIcon from "../MIcon";

export function FeedbackSuccess({ name, onAgain }: { name: string; onAgain: () => void }) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-10 gap-3 fade-up" role="status">
      <div className="mb-2">
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
