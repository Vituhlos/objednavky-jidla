"use client";

import { useEffect, useRef } from "react";

interface AutoResizeTextareaProps {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  placeholder?: string;
}

/**
 * Název jídla roste s obsahem.
 *
 * Názvy jídel jsou často na tři řádky („Kuřecí špíz yakitori (špíz z kuřecího
 * masa v sezamu a chilli), krokety") a scrollování uvnitř dvouřádkového pole
 * se v editaci špatně kontroluje.
 *
 * Výška se přepočítává dvakrát: efektem kvůli změně `value` zvenčí a v
 * `onInput` kvůli psaní — samotný efekt se při rychlém psaní projeví až po
 * překreslení a pole by poskakovalo.
 */
export function AutoResizeTextarea({ value, onChange, disabled, placeholder }: AutoResizeTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      className="modal-input w-full resize-none overflow-hidden leading-snug"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onInput={(event) => {
        const element = event.currentTarget;
        element.style.height = "auto";
        element.style.height = `${element.scrollHeight}px`;
      }}
      disabled={disabled}
      placeholder={placeholder}
      rows={2}
    />
  );
}
