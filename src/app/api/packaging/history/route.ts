import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireAccess } from "@/lib/auth/access";
import { searchHistory } from "@/lib/history";

export const dynamic = "force-dynamic";

// GET ?q=<NSN | contract/PO # | part number>
export const GET = handle((req: Request) => {
  requireAccess("view");
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return NextResponse.json({ rows: searchHistory(q) });
});
