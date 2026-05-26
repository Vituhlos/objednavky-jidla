"use client";

import MIcon from "./MIcon";
import type { Department } from "@/lib/types";

// Per-department icon overrides — falls back to "groups" for any other name
// (custom departments added by admin, e.g., Kanceláře).
const DEPT_ICONS: Partial<Record<Department, string>> = {
  "Konstrukce": "home_work",
  "Dílna":      "build",
};

export function getDeptIcon(name: Department | string): string {
  return DEPT_ICONS[name as Department] ?? "groups";
}

export function DeptIcon({
  name,
  color,
  size = 18,
  fill = true,
}: {
  name: Department | string;
  color: string;
  size?: number;
  fill?: boolean;
}) {
  return <MIcon name={getDeptIcon(name)} size={size} fill={fill} style={{ color }} />;
}
