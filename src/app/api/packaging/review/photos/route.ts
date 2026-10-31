import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { logActivity, requireAccess } from "@/lib/auth/access";
import { listPhotos, savePhoto } from "@/lib/photos";

export const dynamic = "force-dynamic";

// GET → every review photo (metadata only; the image is at /api/packaging/review/photos/:id)
export const GET = handle(() => {
  requireAccess("view");
  return NextResponse.json({ photos: listPhotos() });
});

// POST multipart { itemType, itemKey, reviewer, caption?, file } → the saved photo
export const POST = handle(async (req: Request) => {
  const access = requireAccess("edit");
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No photo was attached" }, { status: 400 });
  let photo;
  try {
    photo = await savePhoto(
      {
        itemType: String(form.get("itemType") ?? ""),
        itemKey: String(form.get("itemKey") ?? ""),
        file,
        caption: form.get("caption")?.toString(),
        uploadedBy: String(form.get("reviewer") ?? ""),
      },
      access.user,
    );
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not save the photo" }, { status: 400 });
  }
  logActivity(access.user, "review_photo_added", { id: photo.id, itemType: photo.itemType, itemKey: photo.itemKey, by: photo.uploadedBy });
  return NextResponse.json({ photo });
});
