"use client";

import { I18nProvider } from "@heroui/react";
import type { ReactNode } from "react";

export default function ClientProviders({ children }: { children: ReactNode }) {
  return <I18nProvider locale="cs-CZ">{children}</I18nProvider>;
}
