import type Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type { ReferenceBundle } from "@/lib/decoder";

const SEED_DIR = path.join(process.cwd(), "seed");

interface HistorySeed {
  version: string;
  records: { sourceFile: string; docNumber: string; nsn: string | null; partNumber: string | null; rawBlock: string }[];
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(SEED_DIR, file), "utf8")) as T;
}

function getMeta(db: Database.Database, key: string): string | undefined {
  return (db.prepare("SELECT value FROM app_meta WHERE key = ?").get(key) as { value: string } | undefined)?.value;
}

function setMeta(db: Database.Database, key: string, value: string): void {
  db.prepare("INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}

/** Load reference data and history into the DB when the shipped seed files change. Cheap no-op otherwise. */
export function syncSeeds(db: Database.Database): void {
  const ref = readJson<ReferenceBundle>("reference.json");
  if (getMeta(db, "reference_version") !== ref.version) {
    db.transaction(() => {
      db.prepare("DELETE FROM code_entry").run();
      const ins = db.prepare(
        `INSERT INTO code_entry (dictionary, code, status, title, description, plain_english, short_label, spec_refs, notes, milstd_table, chg4_page)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const [dictionary, d] of Object.entries(ref.dictionaries)) {
        for (const c of d.codes) {
          ins.run(
            dictionary,
            c.code,
            c.status,
            c.title,
            c.description,
            c.plain_english,
            c.short_label ?? null,
            JSON.stringify(c.spec_refs ?? []),
            c.notes,
            c.milstd_table,
            c.chg4_page,
          );
        }
      }
      setMeta(db, "field_files", JSON.stringify(ref.fieldFiles));
      // Shipped rules only replace the DB copy if nobody has edited them in-app.
      const edited = db.prepare("SELECT updated_by FROM flag_rules WHERE id = 1").get() as { updated_by: string } | undefined;
      if (!edited || edited.updated_by === "seed") {
        db.prepare(
          `INSERT INTO flag_rules (id, rules_json, updated_at, updated_by) VALUES (1, ?, ?, 'seed')
           ON CONFLICT(id) DO UPDATE SET rules_json = excluded.rules_json, updated_at = excluded.updated_at, updated_by = 'seed'`,
        ).run(JSON.stringify(ref.flagRules), new Date().toISOString());
      }
      setMeta(db, "reference_version", ref.version);
    })();
  }

  const hist = readJson<HistorySeed>("history.json");
  if (getMeta(db, "history_version") !== hist.version) {
    db.transaction(() => {
      db.prepare("DELETE FROM packaging_record WHERE source = 'history'").run();
      const ins = db.prepare(
        `INSERT INTO packaging_record (source, source_file, doc_number, nsn, part_number, raw_block, created_at, created_by)
         VALUES ('history', ?, ?, ?, ?, ?, ?, 'seed')`,
      );
      const now = new Date().toISOString();
      for (const r of hist.records) ins.run(r.sourceFile, r.docNumber, r.nsn, r.partNumber, r.rawBlock, now);
      setMeta(db, "history_version", hist.version);
    })();
  }
}
