import type Database from "better-sqlite3";

// Schema changes ship as numbered upgrade steps, applied in order at server start.
// Never edit a released step — add a new one. Every release must boot on the prior production schema.
export interface UpgradeStep {
  version: number;
  description: string;
  up: (db: Database.Database) => void;
}

export const UPGRADE_STEPS: UpgradeStep[] = [
  {
    version: 1,
    description: "Initial packaging schema",
    up: (db) => {
      db.exec(`
        CREATE TABLE app_meta (
          key   TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        -- MIL-STD-2073-1 code dictionaries (re-seeded from seed/reference.json when its version changes)
        CREATE TABLE code_entry (
          dictionary     TEXT NOT NULL,      -- e.g. 'method_of_preservation'
          code           TEXT NOT NULL,      -- exact string: '00', '0', 'ZZ', 'NA'
          status         TEXT NOT NULL,      -- current | deleted_chg4 | not_in_chg4 | legacy_1D | legacy_1B_2C
          title          TEXT,
          description    TEXT,
          plain_english  TEXT,
          spec_refs      TEXT,               -- JSON array
          notes          TEXT,
          milstd_table   TEXT,
          chg4_page      INTEGER,
          PRIMARY KEY (dictionary, code, status)
        );

        -- Owner-tunable red/yellow/green rules (JSON document, one row)
        CREATE TABLE flag_rules (
          id          INTEGER PRIMARY KEY CHECK (id = 1),
          rules_json  TEXT NOT NULL,
          updated_at  TEXT NOT NULL,
          updated_by  TEXT NOT NULL
        );

        -- Packaging blocks: historical contracts (source='history') and blocks people decode and save
        CREATE TABLE packaging_record (
          id            INTEGER PRIMARY KEY,
          source        TEXT NOT NULL,       -- 'history' | 'manual'
          source_file   TEXT,
          doc_number    TEXT,                -- contract / PO number as Global has it
          nsn           TEXT,
          part_number   TEXT,
          raw_block     TEXT NOT NULL,
          created_at    TEXT NOT NULL,
          created_by    TEXT
        );
        CREATE INDEX packaging_record_nsn ON packaging_record(nsn);
        CREATE INDEX packaging_record_doc ON packaging_record(doc_number);

        -- Mirrors the Production Assistant Activity Log until this module moves in-app
        CREATE TABLE activity_log (
          id         INTEGER PRIMARY KEY,
          at         TEXT NOT NULL,
          user_name  TEXT NOT NULL,
          module     TEXT NOT NULL,
          action     TEXT NOT NULL,
          detail     TEXT
        );
      `);
    },
  },
  {
    version: 2,
    description: "Expert review feedback",
    up: (db) => {
      db.exec(`
        -- Feedback from the packaging expert on codes, flag rules and wording. Append-only: the latest row per item wins.
        CREATE TABLE review_feedback (
          id              INTEGER PRIMARY KEY,
          item_type       TEXT NOT NULL,      -- 'question' (seed/review_questions.json) | 'code'
          item_key        TEXT NOT NULL,      -- question id, or 'dictionary:code'
          verdict         TEXT NOT NULL,      -- 'ok' | 'change' | 'unsure' | 'answered'
          choice          TEXT,               -- picked option, for multiple-choice questions
          stock           TEXT,               -- codes only: 'stock' | 'buy' | 'star' | 'unknown'
          suggested_text  TEXT,               -- the wording it should be / the answer
          comment         TEXT,
          reviewer        TEXT NOT NULL,      -- name typed on the review page
          created_at      TEXT NOT NULL,
          created_by      TEXT NOT NULL       -- login user
        );
        CREATE INDEX review_feedback_item ON review_feedback(item_type, item_key);
      `);
    },
  },
  {
    version: 3,
    description: "Short shop-floor label per code",
    up: (db) => {
      db.exec(`
        ALTER TABLE code_entry ADD COLUMN short_label TEXT;
        DELETE FROM app_meta WHERE key = 'reference_version'; -- force a re-seed so the labels load
      `);
    },
  },
  {
    version: 4,
    description: "Per-line answers for multi-part review questions",
    up: (db) => {
      db.exec(`
        ALTER TABLE review_feedback ADD COLUMN part_answers TEXT; -- JSON {partId: chosen option}
      `);
    },
  },
  {
    version: 5,
    description: "Photos attached to review questions and codes",
    up: (db) => {
      db.exec(`
        -- The image files live in the uploads folder next to the database (see src/lib/photos.ts); this table indexes them.
        CREATE TABLE review_photo (
          id             INTEGER PRIMARY KEY,
          item_type      TEXT NOT NULL,      -- 'question' | 'code'
          item_key       TEXT NOT NULL,
          file_name      TEXT NOT NULL,      -- stored name in the uploads folder
          original_name  TEXT,
          mime_type      TEXT NOT NULL,
          size_bytes     INTEGER NOT NULL,
          caption        TEXT,
          uploaded_by    TEXT NOT NULL,      -- name typed on the review page
          created_at     TEXT NOT NULL,
          created_by     TEXT NOT NULL       -- login user
        );
        CREATE INDEX review_photo_item ON review_photo(item_type, item_key);
      `);
    },
  },
  {
    version: 6,
    description: "Review photos stored inside the database",
    up: (db) => {
      // The fleet backup copies database files only, so a folder of images would never be backed up.
      // No photos existed when this shipped (Rev 0.1), so there are no files to import.
      db.exec(`
        DELETE FROM review_photo;
        ALTER TABLE review_photo DROP COLUMN file_name;
        CREATE TABLE review_photo_data (
          photo_id  INTEGER PRIMARY KEY REFERENCES review_photo(id) ON DELETE CASCADE,
          data      BLOB NOT NULL          -- the downscaled image
        );
      `);
    },
  },
];

export function applyUpgrades(db: Database.Database): void {
  db.exec("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL, description TEXT)");
  const current = (db.prepare("SELECT MAX(version) AS v FROM schema_version").get() as { v: number | null }).v ?? 0;
  for (const step of UPGRADE_STEPS) {
    if (step.version <= current) continue;
    db.transaction(() => {
      step.up(db);
      db.prepare("INSERT INTO schema_version (version, applied_at, description) VALUES (?, ?, ?)").run(
        step.version,
        new Date().toISOString(),
        step.description,
      );
    })();
  }
}
