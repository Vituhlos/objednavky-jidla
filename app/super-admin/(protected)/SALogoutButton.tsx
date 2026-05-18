"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import MIcon from "@/app/components/MIcon";

export default function SALogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    await fetch("/super-admin/api/auth/logout", { method: "POST" });
    router.push("/super-admin/login");
    router.refresh();
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-xl glass-soft text-slate-600 hover:text-slate-900 transition-colors"
    >
      <MIcon name="logout" size={14} />
      {loading ? "…" : "Odhlásit"}
    </button>
  );
}
