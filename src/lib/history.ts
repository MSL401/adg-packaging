import { getDb, getReference } from "@/lib/db";
import { decode, type PackagingCodes, type Tier } from "@/lib/decoder";

export interface HistoryRow {
  id: number;
  docNumber: string | null;
  sourceFile: string | null;
  nsn: string | null;
  partNumber: string | null;
  tier: Tier;
  needsReview: boolean;
  headline: string;
  codes: PackagingCodes;
}

interface RecordRow {
  id: number;
  doc_number: string | null;
  source_file: string | null;
  nsn: string | null;
  part_number: string | null;
  raw_block: string;
}

function toRow(r: RecordRow): HistoryRow {
  const d = decode({ text: r.raw_block }, getReference());
  return {
    id: r.id,
    docNumber: r.doc_number,
    sourceFile: r.source_file,
    nsn: r.nsn,
    partNumber: r.part_number,
    tier: d.flags.tier,
    needsReview: d.flags.needsReview,
    headline: d.recipe.headline,
    codes: d.parsed.codes,
  };
}

/** Search past packaging by NSN, contract/PO number or part number (blank = everything). */
export function searchHistory(q: string, limit = 500): HistoryRow[] {
  const like = `%${q.trim().replace(/[-\s]/g, "")}%`;
  const rows = getDb()
    .prepare(
      `SELECT id, doc_number, source_file, nsn, part_number, raw_block FROM packaging_record
       WHERE ? = '%%' OR REPLACE(nsn, '-', '') LIKE ? OR REPLACE(doc_number, '-', '') LIKE ? OR REPLACE(part_number, '-', '') LIKE ?
       ORDER BY nsn, doc_number LIMIT ?`,
    )
    .all(like, like, like, like, limit) as RecordRow[];
  return rows.map(toRow);
}

export function historyForNsn(nsn: string): HistoryRow[] {
  const rows = getDb()
    .prepare("SELECT id, doc_number, source_file, nsn, part_number, raw_block FROM packaging_record WHERE nsn = ? ORDER BY doc_number DESC")
    .all(nsn) as RecordRow[];
  return rows.map(toRow);
}

export function getRecord(id: number): RecordRow | undefined {
  return getDb().prepare("SELECT id, doc_number, source_file, nsn, part_number, raw_block FROM packaging_record WHERE id = ?").get(id) as
    | RecordRow
    | undefined;
}
