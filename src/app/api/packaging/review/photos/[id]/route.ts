import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { logActivity, requireAccess } from "@/lib/auth/access";
import { deletePhoto, readPhoto } from "@/lib/photos";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

// GET → the image itself
export const GET = handle((_req: Request, { params }: Ctx) => {
  requireAccess("view");
  const found = readPhoto(Number(params.id));
  if (!found) return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  return new Response(new Uint8Array(found.data), {
    headers: { "Content-Type": found.photo.mimeType, "Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff" },
  });
});

// DELETE → remove a photo added by mistake
export const DELETE = handle((_req: Request, { params }: Ctx) => {
  const access = requireAccess("edit");
  const removed = deletePhoto(Number(params.id));
  if (!removed) return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  logActivity(access.user, "review_photo_removed", { id: removed.id, itemType: removed.itemType, itemKey: removed.itemKey });
  return NextResponse.json({ ok: true });
});
