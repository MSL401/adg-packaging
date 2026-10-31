import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type { CodeEntry, ReferenceBundle } from "@/lib/decoder";
import type { FlagRuleSet } from "@/lib/decoder/dictionary";
import { syncSeeds } from "./seed";
import { applyUpgrades } from "./upgrades";

// One connection per server process; survives Next.js dev hot reloads.
const globalForDb = globalThis as unknown as { packagingDb?: Database.Database; packagingRef?: { version: string; bundle: ReferenceBundle } };

/** The SQLite file (review photos included). Default: the gitignored data/ folder inside the app, like the other fleet apps. */
export const dbPath = (): string => process.env.PACKAGING_DB_PATH ?? path.join(process.cwd(), "data", "packaging.db");

export function getDb(): Database.Database {
  if (!globalForDb.packagingDb) {
    const file = dbPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const db = new Database(file);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    applyUpgrades(db);
    syncSeeds(db);
    globalForDb.packagingDb = db;
  }
  return globalForDb.packagingDb;
}

/** Reference bundle for the decoder, rebuilt from the DB (cached until the dictionaries or rules change). */
export function getReference(): ReferenceBundle {
  const db = getDb();
  const meta = db.prepare("SELECT key, value FROM app_meta WHERE key IN ('reference_version', 'field_files')").all() as { key: string; value: string }[];
  const rules = db.prepare("SELECT rules_json, updated_at FROM flag_rules WHERE id = 1").get() as { rules_json: string; updated_at: string };
  const version = `${meta.find((m) => m.key === "reference_version")?.value}:${rules.updated_at}`;
  if (globalForDb.packagingRef?.version === version) return globalForDb.packagingRef.bundle;

  const rows = db.prepare("SELECT * FROM code_entry").all() as (Omit<CodeEntry, "spec_refs"> & { dictionary: string; spec_refs: string })[];
  const dictionaries: ReferenceBundle["dictionaries"] = {};
  for (const { dictionary, spec_refs, ...c } of rows) {
    (dictionaries[dictionary] ??= { field: dictionary, contract_label: null, codes: [] }).codes.push({ ...c, spec_refs: JSON.parse(spec_refs) as string[] });
  }
  const bundle: ReferenceBundle = {
    version,
    fieldFiles: JSON.parse(meta.find((m) => m.key === "field_files")?.value ?? "{}") as Record<string, string>,
    dictionaries,
    flagRules: JSON.parse(rules.rules_json) as FlagRuleSet,
  };
  globalForDb.packagingRef = { version, bundle };
  return bundle;
}
