import fs from "node:fs";
import path from "node:path";
import { getDb, getReference } from "@/lib/db";
import { CODE_FIELDS, mentionedContainers, parsePackagingText, type CodeField, type PackagingCodes, type ParsedPackaging } from "@/lib/decoder";

// Expert review: the packaging veteran checks our questions, flag rules, step wording and every code translation.

export type ItemType = "question" | "code";
export type Verdict = "ok" | "change" | "unsure" | "answered";
export type Stock = "stock" | "buy" | "star" | "unknown";

export interface ReviewSection {
  id: string;
  title: string;
  short: string; // topic tag shown on each question
  intro: string;
}

export interface ReviewQuestion {
  id: string;
  section: string;
  kind: "question" | "assumption"; // assumption = answered with Right / Needs a change / Not sure
  title: string; // short topic heading, e.g. "The label on every bag and box (MIL-STD-129)"
  question: string; // the one specific thing being asked
  assumption?: string; // what the tool does or says today
  details?: string[]; // what the standard actually requires, so the reviewer judges specifics
  sample?: { heading: string; lines: string[] }; // e.g. a mock label
  answerHint?: string; // placeholder for free-text answers
  choices?: string[];
  parts?: { id: string; label: string; choices?: string[] }[]; // several lines, each answered with one option
  partChoices?: string[]; // options shared by every line (a line's own choices win)
  contracts?: string[]; // show these contracts' packaging blocks
  examples?: { field: CodeField; code: string }[]; // or: find a contract that uses this code
  textMatch?: string; // or: find a contract whose packaging text matches this regex
  highlight?: CodeField[];
  appliesTo?: "all"; // a rule that applies to every contract
  askLast?: boolean; // rare, hard ones (SPIs) go at the end whatever their count
  round?: number; // 2 = follow-up round (its own tab, numbered R1, R2…, kept in file order)
}

/** One of our past contracts, shown next to a question so the reviewer sees exactly what we mean. */
export interface ContractEvidence {
  docNumber: string;
  nsn: string | null;
  codes: PackagingCodes;
  highlight: CodeField[];
  extra: string[]; // SPI / drawing / spec references, packaging notes, special instructions
  rawBlock: string;
}

export interface NumberedQuestion extends ReviewQuestion {
  number: number;
  tag: string; // "Q12" (round 1) or "R3" (round 2)
  usedIn: number; // how many of our contracts this question affects
  evidence: ContractEvidence[];
}

export interface CodeItem {
  key: string; // 'dictionary:code'
  dictionary: string;
  dictionaryLabel: string;
  code: string;
  status: string;
  title: string | null;
  description: string | null;
  plainEnglish: string | null;
  shortLabel: string | null; // the 2–6 word name the packer sees first
  ref: string | null;
  isContainer: boolean;
  number: number;
  usedIn: number; // distinct contracts in our history
  examples: string[];
}

export interface Feedback {
  id: number;
  itemType: ItemType;
  itemKey: string;
  verdict: Verdict;
  choice: string | null;
  partAnswers: Record<string, string> | null; // multi-part questions: part id → chosen option
  stock: Stock | null;
  suggestedText: string | null;
  comment: string | null;
  reviewer: string;
  createdAt: string;
}

const DICTIONARY_LABELS: Record<string, string> = {
  method_of_preservation: "Method of preservation (PRES MTHD)",
  cleaning_drying: "Cleaning & drying (CLNG/DRY)",
  preservative_material: "Preservative (PRESV MAT)",
  wrapping_material: "Wrapping (WRAP MAT)",
  cushioning_material: "Cushioning (CUSH/DUNN MAT)",
  cushioning_thickness: "Cushioning thickness",
  unit_intermediate_container: "Unit / intermediate container",
  optional_procedures: "Optional procedures (OPI)",
  quantity_codes: "Quantity codes (QUP / ICQ)",
  packing_code: "Packing code (PACK CODE)",
  special_marking: "Special marking",
};

export function loadQuestions(): { version: string; sections: ReviewSection[]; items: ReviewQuestion[] } {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), "seed", "review_questions.json"), "utf8")) as {
    version: string;
    sections: ReviewSection[];
    items: ReviewQuestion[];
  };
}

interface HistoryRecord {
  doc: string;
  nsn: string | null;
  raw: string;
  parsed: ParsedPackaging;
}

const cache = globalThis as unknown as { packagingReviewHistory?: { version: string; records: HistoryRecord[]; usage: Map<string, Set<string>> } };

/** Our past contracts, parsed once (newest contract number first), and which codes each one uses. */
function history(): { records: HistoryRecord[]; usage: Map<string, Set<string>> } {
  const db = getDb();
  const version = (db.prepare("SELECT value FROM app_meta WHERE key = 'history_version'").get() as { value: string } | undefined)?.value ?? "";
  if (cache.packagingReviewHistory?.version === version) return cache.packagingReviewHistory;

  const rows = db.prepare("SELECT doc_number, source_file, nsn, raw_block FROM packaging_record WHERE source = 'history' ORDER BY doc_number DESC, id").all() as {
    doc_number: string | null;
    source_file: string | null;
    nsn: string | null;
    raw_block: string;
  }[];
  const records = rows.map((r) => ({ doc: r.doc_number ?? r.source_file ?? "?", nsn: r.nsn, raw: r.raw_block, parsed: parsePackagingText(r.raw_block) }));

  // Which codes appear in our past contracts, keyed 'dictionary:code' → contract numbers.
  const fieldFiles = getReference().fieldFiles;
  const usage = new Map<string, Set<string>>();
  const add = (key: string, doc: string) => {
    let s = usage.get(key);
    if (!s) usage.set(key, (s = new Set()));
    s.add(doc);
  };
  for (const r of records) {
    for (const f of CODE_FIELDS) {
      const v = r.parsed.codes[f];
      const dictionary = fieldFiles[f];
      if (!v || !dictionary) continue;
      if ((f === "qup" || f === "intrmdteQty") && /^\d+$/.test(v)) continue; // plain quantities aren't codes
      add(`${dictionary}:${v}`, r.doc);
    }
    for (const c of mentionedContainers(r.parsed)) add(`unit_intermediate_container:${c}`, r.doc);
  }
  cache.packagingReviewHistory = { version, records, usage };
  return cache.packagingReviewHistory;
}

const isContractNumber = (doc: string) => /^SP[A-Z0-9]{4}\d{2}[A-Z]/.test(doc);

function toEvidence(r: HistoryRecord, highlight: CodeField[]): ContractEvidence {
  const p = r.parsed;
  const spi = p.spi && `Special Packaging Instruction ${p.spi.number}${p.spi.revision ? ` Rev ${p.spi.revision}` : ""}${p.spi.date ? ` dated ${p.spi.date}` : ""}`;
  return {
    docNumber: r.doc,
    nsn: r.nsn,
    codes: p.codes,
    highlight,
    extra: [
      ...(spi ? [spi] : []),
      ...p.drawings.map((d) => `Drawing ${d}`),
      ...p.procedureSpecs.map((s) => `Packaging per ${s}`),
      ...(p.commercial ? ["Commercial packaging per ASTM D3951"] : []),
      ...p.packagingNotes,
      ...p.supplemental,
    ],
    rawBlock: r.raw,
  };
}

/** Up to two of our contracts that show what a question is about. */
function evidenceFor(q: ReviewQuestion, records: HistoryRecord[]): ContractEvidence[] {
  const highlight = [...new Set([...(q.highlight ?? []), ...(q.examples ?? []).map((e) => e.field)])];
  const picked: HistoryRecord[] = [];
  const take = (r: HistoryRecord | undefined) => {
    if (r && picked.length < 2 && !picked.some((x) => x.doc === r.doc)) picked.push(r);
  };
  // Auto-picked examples must carry a real contract number (not a scanned 'combinepdf' or SF18/SF30 file name).
  const candidates = records.filter((r) => isContractNumber(r.doc));
  for (const doc of q.contracts ?? []) take(records.find((r) => r.doc === doc));
  for (const e of q.examples ?? []) take(candidates.find((r) => r.parsed.codes[e.field] === e.code && !picked.some((x) => x.doc === r.doc)));
  if (q.textMatch) {
    const re = new RegExp(q.textMatch, "i");
    take(candidates.find((r) => re.test(r.raw.replace(/\s+/g, " "))));
  }
  return picked.map((r) => toEvidence(r, highlight));
}

/** Review questions numbered 1…n in file order, each with the contracts it refers to. */
export function listQuestions(): { sections: ReviewSection[]; items: NumberedQuestion[] } {
  const { sections, items } = loadQuestions();
  const { records } = history();
  const allDocs = new Set(records.map((r) => r.doc));
  // Most-common first, so the reviewer starts with what matters on the most contracts. Open questions follow, then the rare SPI ones.
  const band = (q: ReviewQuestion) => (q.askLast ? 2 : q.section === "shop" ? 1 : 0);
  const usage = (q: ReviewQuestion, i: number) => ({ q, i, usedIn: q.appliesTo === "all" ? allDocs.size : contractsAffected(q, records) });
  const ranked = items
    .filter((q) => (q.round ?? 1) === 1)
    .map(usage)
    .sort((a, b) => band(a.q) - band(b.q) || b.usedIn - a.usedIn || a.i - b.i);
  // Follow-up rounds stay in file order: each question builds on the one before.
  const round2 = items.filter((q) => q.round === 2).map(usage);
  return {
    sections,
    items: [
      ...ranked.map(({ q, usedIn }, n) => ({ ...q, number: n + 1, tag: `Q${n + 1}`, usedIn, evidence: evidenceFor(q, records) })),
      ...round2.map(({ q, usedIn }, n) => ({ ...q, number: n + 1, tag: `R${n + 1}`, usedIn, evidence: evidenceFor(q, records) })),
    ],
  };
}

/** How many of our past contracts a question is about (the listed contracts plus any matching its codes or text). */
function contractsAffected(q: ReviewQuestion, records: HistoryRecord[]): number {
  const re = q.textMatch ? new RegExp(q.textMatch, "i") : undefined;
  const docs = new Set<string>(q.contracts ?? []);
  for (const r of records) {
    if ((q.examples ?? []).some((e) => r.parsed.codes[e.field] === e.code) || (re && re.test(r.raw.replace(/\s+/g, " ")))) docs.add(r.doc);
  }
  return docs.size;
}

/** Every current code, plus any older code our contracts actually used. Most-used first. */
export function listCodeItems(): CodeItem[] {
  const { usage } = history();
  const rows = getDb()
    .prepare("SELECT dictionary, code, status, title, description, plain_english, short_label, milstd_table, chg4_page FROM code_entry")
    .all() as {
    dictionary: string;
    code: string;
    status: string;
    title: string | null;
    description: string | null;
    plain_english: string | null;
    short_label: string | null;
    milstd_table: string | null;
    chg4_page: number | null;
  }[];
  const items: CodeItem[] = [];
  const seen = new Set<string>();
  // Prefer the 'current' row when a code has several statuses.
  rows.sort((a, b) => (a.status === "current" ? 0 : 1) - (b.status === "current" ? 0 : 1));
  for (const r of rows) {
    const key = `${r.dictionary}:${r.code}`;
    const used = usage.get(key);
    if (seen.has(key) || (r.status !== "current" && !used)) continue;
    seen.add(key);
    items.push({
      key,
      dictionary: r.dictionary,
      dictionaryLabel: DICTIONARY_LABELS[r.dictionary] ?? r.dictionary,
      code: r.code,
      status: r.status,
      title: r.title,
      description: r.description,
      plainEnglish: r.plain_english,
      shortLabel: r.short_label,
      ref: [r.milstd_table && `Table ${r.milstd_table}`, r.chg4_page && `p. ${r.chg4_page}`].filter(Boolean).join(", ") || null,
      isContainer: ["unit_intermediate_container", "wrapping_material", "cushioning_material", "preservative_material"].includes(r.dictionary),
      number: 0,
      usedIn: used?.size ?? 0,
      examples: used ? [...used].filter(isContractNumber).slice(0, 3) : [],
    });
  }
  const order = Object.keys(DICTIONARY_LABELS);
  return items
    .sort((a, b) => b.usedIn - a.usedIn || order.indexOf(a.dictionary) - order.indexOf(b.dictionary) || a.code.localeCompare(b.code))
    .map((c, i) => ({ ...c, number: i + 1 }));
}

interface FeedbackRow {
  id: number;
  item_type: ItemType;
  item_key: string;
  verdict: Verdict;
  choice: string | null;
  part_answers: string | null;
  stock: Stock | null;
  suggested_text: string | null;
  comment: string | null;
  reviewer: string;
  created_at: string;
}

const toFeedback = (r: FeedbackRow): Feedback => ({
  id: r.id,
  itemType: r.item_type,
  itemKey: r.item_key,
  verdict: r.verdict,
  choice: r.choice,
  partAnswers: r.part_answers ? (JSON.parse(r.part_answers) as Record<string, string>) : null,
  stock: r.stock,
  suggestedText: r.suggested_text,
  comment: r.comment,
  reviewer: r.reviewer,
  createdAt: r.created_at,
});

/** The latest feedback per item. */
export function latestFeedback(): Feedback[] {
  const rows = getDb()
    .prepare(
      `SELECT f.* FROM review_feedback f
       JOIN (SELECT item_type, item_key, MAX(id) AS id FROM review_feedback GROUP BY item_type, item_key) last ON last.id = f.id
       ORDER BY f.id DESC`,
    )
    .all() as FeedbackRow[];
  return rows.map(toFeedback);
}

/** Every feedback row ever saved, newest first (for export). */
export function allFeedback(): Feedback[] {
  return (getDb().prepare("SELECT * FROM review_feedback ORDER BY id DESC").all() as FeedbackRow[]).map(toFeedback);
}

const VERDICTS: Verdict[] = ["ok", "change", "unsure", "answered"];
const STOCKS: Stock[] = ["stock", "buy", "star", "unknown"];

export interface FeedbackInput {
  itemType: ItemType;
  itemKey: string;
  verdict: Verdict;
  choice?: string | null;
  partAnswers?: Record<string, string> | null;
  stock?: Stock | null;
  suggestedText?: string | null;
  comment?: string | null;
  reviewer: string;
}

export function saveFeedback(input: FeedbackInput, loginUser: string): Feedback {
  if (input.itemType !== "question" && input.itemType !== "code") throw new Error("Unknown item type");
  if (!VERDICTS.includes(input.verdict)) throw new Error("Unknown verdict");
  if (input.stock && !STOCKS.includes(input.stock)) throw new Error("Unknown stock value");
  const reviewer = input.reviewer?.trim();
  if (!reviewer) throw new Error("Type your name at the top of the page first");
  if (!input.itemKey?.trim()) throw new Error("Missing item");
  const clean = (s?: string | null) => (s?.trim() ? s.trim() : null);
  const parts = input.partAnswers && typeof input.partAnswers === "object" ? Object.fromEntries(Object.entries(input.partAnswers).filter(([, v]) => typeof v === "string" && v)) : null;
  const info = getDb()
    .prepare(
      `INSERT INTO review_feedback (item_type, item_key, verdict, choice, part_answers, stock, suggested_text, comment, reviewer, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.itemType,
      input.itemKey.trim(),
      input.verdict,
      clean(input.choice),
      parts && Object.keys(parts).length ? JSON.stringify(parts) : null,
      input.stock ?? null,
      clean(input.suggestedText),
      clean(input.comment),
      reviewer,
      new Date().toISOString(),
      loginUser,
    );
  const row = getDb().prepare("SELECT * FROM review_feedback WHERE id = ?").get(info.lastInsertRowid) as FeedbackRow;
  return toFeedback(row);
}
