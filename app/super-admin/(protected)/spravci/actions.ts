"use server";

import { revalidatePath } from "next/cache";
import { getGlobalDb } from "@/lib/global-db";
import { requireSuperAdmin } from "@/lib/tenant-auth";
import { hashPassword } from "@/lib/auth";

export async function saAddSuperAdmin(
  formData: FormData
): Promise<{ error?: string }> {
  const actor = await requireSuperAdmin();
  const email = (formData.get("email") as string ?? "").trim().toLowerCase();
  const password = (formData.get("password") as string ?? "");

  if (!email || !password) return { error: "Vyplňte e-mail a heslo." };
  if (password.length < 8) return { error: "Heslo musí mít aspoň 8 znaků." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Neplatná e-mailová adresa." };

  const db = getGlobalDb();
  if (db.prepare("SELECT id FROM super_admins WHERE email = ?").get(email)) {
    return { error: "Tento e-mail je již registrován jako správce." };
  }

  db.prepare("INSERT INTO super_admins (email, password_hash) VALUES (?, ?)").run(email, hashPassword(password));
  db.prepare(
    "INSERT INTO platform_audit (action, actor_email, details) VALUES (?, ?, ?)"
  ).run("sa_created", actor.email, `email=${email}`);

  revalidatePath("/super-admin/spravci");
  return {};
}

export async function saRemoveSuperAdmin(
  targetId: number
): Promise<{ error?: string }> {
  const actor = await requireSuperAdmin();

  if (actor.id === targetId) return { error: "Nelze odebrat vlastní účet." };

  const db = getGlobalDb();
  const { count } = db.prepare("SELECT COUNT(*) as count FROM super_admins").get() as { count: number };
  if (count <= 1) return { error: "Platforma musí mít aspoň jednoho správce." };

  const target = db.prepare("SELECT email FROM super_admins WHERE id = ?").get(targetId) as { email: string } | undefined;
  if (!target) return { error: "Správce nenalezen." };

  db.prepare("DELETE FROM super_admins WHERE id = ?").run(targetId);
  db.prepare(
    "INSERT INTO platform_audit (action, actor_email, details) VALUES (?, ?, ?)"
  ).run("sa_removed", actor.email, `email=${target.email}`);

  revalidatePath("/super-admin/spravci");
  return {};
}
