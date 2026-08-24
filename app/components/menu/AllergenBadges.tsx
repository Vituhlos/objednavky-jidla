"use client";

import { memo } from "react";

export const ALLERGEN_NAMES: Record<number, string> = {
  1: "Lepek",
  2: "Korýši",
  3: "Vejce",
  4: "Ryby",
  5: "Arašídy",
  6: "Sója",
  7: "Mléko",
  8: "Ořechy",
  9: "Celer",
  10: "Hořčice",
  11: "Sezam",
  12: "Siřičitany",
  13: "Vlčí bob",
  14: "Měkkýši",
};

/**
 * Alergeny drží databáze jako volný text („1,3,7", „1 3 7", „1;3;7"), protože
 * takhle je vyzobe parser z PDF. Čísla mimo rozsah 1–14 se zahazují — v PDF
 * občas skončí u názvu i něco, co alergen není.
 */
export function parseAllergens(allergens: string): number[] {
  return allergens
    .split(/[\s,;]+/)
    .map(Number)
    .filter((number) => number >= 1 && number <= 14);
}

/** Opačný směr: z vybraných čísel zpět do tvaru pro databázi. */
export function formatAllergens(numbers: Iterable<number>): string {
  return [...numbers].sort((a, b) => a - b).join(",");
}

export const AllergenBadges = memo(function AllergenBadges({ allergens }: { allergens: string }) {
  const numbers = parseAllergens(allergens);
  if (numbers.length === 0) return null;

  return (
    <span className="inline-flex flex-wrap gap-0.5 mt-0.5">
      {numbers.map((n) => (
        <span
          key={n}
          title={ALLERGEN_NAMES[n]}
          className="inline-block text-[11px] font-semibold leading-none px-1.5 py-0.5 rounded"
          style={{ background: "rgba(245,158,11,0.12)", color: "#92400e" }}
        >
          {n}
        </span>
      ))}
    </span>
  );
});
