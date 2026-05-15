"use client";

export default function KuchyneError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <div className="glass-soft rounded-2xl p-8">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="font-display font-bold text-[18px] text-stone-800 mb-2">
          Nepodařilo se načíst data kuchyně
        </h2>
        <p className="text-[13px] text-stone-500 mb-6">
          {error.message || "Nastala neočekávaná chyba při načítání přehledu."}
        </p>
        <button
          onClick={reset}
          className="v2-btn v2-btn--primary text-[13px] py-2 px-5"
        >
          Zkusit znovu
        </button>
      </div>
    </div>
  );
}
