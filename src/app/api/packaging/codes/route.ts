import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireAccess } from "@/lib/auth/access";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET ?dictionary=method_of_preservation&q=bag&all=1 → code entries (current codes only unless all=1)
export const GET = handle((req: Request) => {
  requireAccess("view");
  const p = new URL(req.url).searchParams;
  const dictionary = p.get("dictionary") ?? "";
  const q = `%${p.get("q")?.trim() ?? ""}%`;
  const all = p.get("all") === "1";
  const rows = getDb()
    .prepare(
      `SELECT dictionary, code, status, title, plain_english, description, notes, milstd_table, chg4_page FROM code_entry
       WHERE (? = '' OR dictionary = ?) AND (? = 1 OR status = 'current')
         AND (code LIKE ? OR title LIKE ? OR plain_english LIKE ? OR description LIKE ?)
       ORDER BY dictionary, CASE status WHEN 'current' THEN 0 ELSE 1 END, code LIMIT 1000`,
    )
    .all(dictionary, dictionary, all ? 1 : 0, q, q, q, q);
  return NextResponse.json({ rows });
});
