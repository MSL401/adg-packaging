import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { logActivity, requireAccess } from "@/lib/auth/access";
import { listPhotos } from "@/lib/photos";
import { latestFeedback, listCodeItems, listQuestions, saveFeedback, type FeedbackInput } from "@/lib/review";

export const dynamic = "force-dynamic";

// GET → everything the review page needs: questions, codes (most-used first) and the latest feedback per item
export const GET = handle(() => {
  requireAccess("view");
  return NextResponse.json({ questions: listQuestions(), codes: listCodeItems(), feedback: latestFeedback(), photos: listPhotos() });
});

// POST { itemType, itemKey, verdict, choice?, stock?, suggestedText?, comment?, reviewer } → saved feedback row
export const POST = handle(async (req: Request) => {
  const access = requireAccess("edit");
  const input = (await req.json()) as FeedbackInput;
  let saved;
  try {
    saved = saveFeedback(input, access.user);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not save" }, { status: 400 });
  }
  logActivity(access.user, "review_feedback", { itemType: saved.itemType, itemKey: saved.itemKey, verdict: saved.verdict, reviewer: saved.reviewer });
  return NextResponse.json({ feedback: saved });
});
