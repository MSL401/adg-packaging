import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { logActivity, requireAccess } from "@/lib/auth/access";
import { getReference } from "@/lib/db";
import { decode, type PackagingCodes } from "@/lib/decoder";
import { historyForNsn } from "@/lib/history";

export const dynamic = "force-dynamic";

// POST { text?: string, codes?: PackagingCodes, nsn?: string } → decoded recipe + flags (+ past awards for the NSN)
export const POST = handle(async (req: Request) => {
  const access = requireAccess("view");
  const body = (await req.json()) as { text?: string; codes?: PackagingCodes; nsn?: string };
  if (!body.text?.trim() && !Object.values(body.codes ?? {}).some((v) => v?.trim())) {
    return NextResponse.json({ error: "Paste a packaging block or enter at least one code." }, { status: 400 });
  }
  const result = decode({ text: body.text, codes: body.codes }, getReference());
  const nsn = body.nsn?.trim() || /\b(\d{4}-\d{2}-\d{3}-\d{4})\b/.exec(body.text ?? "")?.[1];
  logActivity(access.user, "decode", { nsn, tier: result.flags.tier, codes: result.parsed.codes });
  return NextResponse.json({ ...result, history: nsn ? historyForNsn(nsn) : [] });
});
