"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ThemeProvider, configure, type RealTheme } from "@gravity-ui/uikit";

configure({ lang: "en" });

type Props = {
  children: ReactNode;
  theme?: RealTheme;
};

export function GravityRoot({ children, theme = "light" }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}
