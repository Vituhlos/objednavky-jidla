"use client";

/** Pocet prilohy: cena za kus a +/- ovladani. Nulu uz dal nejde ubirat. */
export function ModalStepper({
  label, price, value, onChange,
}: {
  label: string; price: number; value: number; onChange: (v: number) => void;
}) {
  return (
    <div className="modal-stepper">
      <span className="modal-stepper__label">{label}</span>
      <span className="modal-stepper__price">{price} Kč/ks</span>
      <div className="modal-stepper__controls">
        <button aria-label={`Ubrat ${label}`} className="stepper-btn" disabled={value <= 0} onClick={() => onChange(Math.max(0, value - 1))} type="button">−</button>
        <span aria-label={`Počet: ${value}`} className="stepper-count">{value}</span>
        <button aria-label={`Přidat ${label}`} className="stepper-btn" onClick={() => onChange(value + 1)} type="button">+</button>
      </div>
    </div>
  );
}
