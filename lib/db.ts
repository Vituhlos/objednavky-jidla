import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { runMigrations } from "./migrations";
import { TENANT_MIGRATIONS, getTenantDb } from "./tenant-db";
import { getTenantSlugForRequest } from "./tenant-context";

const DB_PATH =
  process.env.DB_PATH ?? path.join(process.cwd(), "data", "stros.db");

let instance: Database.Database | null = null;

function getLegacyDb(): Database.Database {
  if (!instance) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    instance = new Database(DB_PATH);
    instance.pragma("journal_mode = WAL");
    instance.pragma("foreign_keys = ON");
    runMigrations(instance, TENANT_MIGRATIONS);
  }
  return instance;
}

export function getDb(): Database.Database {
  const slug = getTenantSlugForRequest();
  return slug ? getTenantDb(slug) : getLegacyDb();
}
