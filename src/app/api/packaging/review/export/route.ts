import { handle } from "@/lib/api";
import { requireAccess } from "@/lib/auth/access";
import { allFeedback, listCodeItems, listQuestions } from "@/lib/review";

export const dynamic = "force-dynamic";

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// GET → every feedback row ever saved, as a CSV for Excel (newest first, with the item text alongside)
export const GET = handle(() => {
  requireAccess("view");
  const questions = new Map(listQuestions().items.map((q) => [q.id, { no: q.tag, text: q.question, parts: q.parts ?? [] }]));
  const codes = new Map(listCodeItems().map((c) => [c.key, { no: `C${c.number}`, text: `${c.dictionaryLabel} ${c.code}: ${c.title ?? ""}`, parts: [] }]));
  const header = ["Saved", "Reviewer", "#", "Item", "What it is", "Verdict", "Choice", "Stock/buy", "Should say / answer", "Comment"];
  // Multi-part questions get one row per line, so each answer sits in its own Excel row.
  const lines = allFeedback().flatMap((f) => {
    const item = f.itemType === "question" ? questions.get(f.itemKey) : codes.get(f.itemKey);
    const row = (what: string | undefined, choice: string | null) =>
      [f.createdAt, f.reviewer, item?.no, f.itemKey, what, f.verdict, choice, f.stock, f.suggestedText, f.comment].map(csvCell).join(",");
    if (f.partAnswers && item?.parts.length)
      return item.parts.filter((p) => f.partAnswers![p.id]).map((p) => row(`${item.text} — ${p.label}`, f.partAnswers![p.id]!));
    return [row(item?.text, f.choice)];
  });
  const body = "﻿" + [header.join(","), ...lines].join("\r\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="packaging-review-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
});
