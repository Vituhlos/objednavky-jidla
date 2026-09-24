"use client";

import { FEEDBACK_CATEGORIES, type FeedbackCategory } from "@/lib/feedback-meta";

/**
 * Výběr kategorie jako řada emoji dlaždic.
 *
 * Pod povrchem obyčejné radio — funguje šipkami i čtečkou obrazovky, jen
 * vizuál je vlastní. Na mobilu 4 + 3, od `sm` všech sedm v řadě.
 */
export function CategoryPicker({
  value,
  onChange,
}: {
  value: FeedbackCategory | null;
  onChange: (id: FeedbackCategory) => void;
}) {
  return (
    <fieldset>
      <legend className="sr-only">O co jde?</legend>
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
        {FEEDBACK_CATEGORIES.map((c) => {
          const active = c.id === value;
          return (
            <label key={c.id} className={`fb-cat${active ? " fb-cat--active" : ""}`} title={c.label}>
              <input
                checked={active}
                className="sr-only"
                name="feedback-category"
                onChange={() => onChange(c.id)}
                type="radio"
                value={c.id}
              />
              {/* key na emoji: při každém výběru se prvek vymění a animace „poskočí“ znovu */}
              <span key={active ? "on" : "off"} aria-hidden="true" className="fb-cat__emoji emoji">{c.emoji}</span>
              <span className="fb-cat__label">{c.short}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
