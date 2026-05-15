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
      style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, padding: "0.3rem 0.65rem", color: "#fff", cursor: "pointer", fontSize: 13 }}
    >
      <MIcon name="logout" size={16} />
      {loading ? "…" : "Odhlásit"}
    </button>
  );
}
