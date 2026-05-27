"use client";

import { useState, useEffect } from "react";
import MIcon from "./MIcon";

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem("kantyna_theme");
      if (stored === "dark") {
        setDark(true);
        document.documentElement.setAttribute("data-theme", "dark");
      } else if (stored === "light") {
        setDark(false);
        document.documentElement.removeAttribute("data-theme");
      } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        setDark(true);
        document.documentElement.setAttribute("data-theme", "dark");
      }
    } catch {}
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    try {
      localStorage.setItem("kantyna_theme", next ? "dark" : "light");
    } catch {}
  };

  if (!mounted) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      className={`inline-flex items-center justify-center w-9 h-9 rounded-xl glass-btn transition ${className}`}
      aria-label={dark ? "Přepnout na světlý režim" : "Přepnout na tmavý režim"}
      title={dark ? "Světlý režim" : "Tmavý režim"}
    >
      <MIcon name={dark ? "light_mode" : "dark_mode"} size={18} />
    </button>
  );
}
