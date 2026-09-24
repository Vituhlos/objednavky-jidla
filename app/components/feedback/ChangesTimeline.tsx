import { getCategoryMeta, type PublicFeedbackReply } from "@/lib/feedback-meta";
import MIcon from "../MIcon";
import { formatFeedbackDate, pluralizeChanges } from "./feedback-utils";

/**
 * „Změnili jsme díky vám“ — hotové připomínky s veřejnou odpovědí správce.
 * Ukazuje jen tu odpověď; původní text ani autor sem nikdy nedorazí.
 */
export function ChangesTimeline({ replies }: { replies: PublicFeedbackReply[] }) {
  return (
    <section className="glass rounded-3xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/40" style={{ background: "rgba(21,128,61,0.06)" }}>
        <MIcon name="check_circle" size={17} fill style={{ color: "#15803d" }} />
        <h2 className="font-display font-bold text-[13.5px] text-stone-900 flex-1">Změnili jsme díky vám</h2>
        {replies.length > 0 && <span className="text-[11px] text-stone-500">{pluralizeChanges(replies.length)}</span>}
      </div>

      {replies.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">
            <MIcon name="check_circle" size={22} style={{ color: "#94a3b8" }} />
          </div>
          <p className="empty-state__title">Zatím nic</p>
          <p className="empty-state__sub">První změna podle vašich připomínek se objeví tady</p>
        </div>
      ) : (
        <ol className="fb-timeline py-2">
          {replies.map((r) => {
            const cat = getCategoryMeta(r.category);
            return (
              <li key={r.id} className="flex gap-3 px-4 py-2.5">
                <span aria-hidden="true" className="fb-timeline__dot emoji">{cat.emoji}</span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-[13px] text-stone-800 leading-snug whitespace-pre-line break-words">{r.publicReply}</p>
                  <p className="text-[11px] text-stone-400 mt-1">
                    <time dateTime={r.resolvedAt.replace(" ", "T")}>{formatFeedbackDate(r.resolvedAt)}</time> · {cat.short}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
