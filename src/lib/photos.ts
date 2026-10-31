import { getDb } from "@/lib/db";
import type { ItemType } from "@/lib/review";

// Example photos (taken by us or AI-generated) attached to review questions and codes.
// The image bytes live in the database (review_photo_data) so the fleet's database backup covers them.
// The review page shrinks each photo in the browser first (longest side 1600 px, JPEG ~80%), so a photo is a few hundred KB.

export interface Photo {
  id: number;
  itemType: ItemType;
  itemKey: string;
  originalName: string | null;
  mimeType: string;
  sizeBytes: number;
  caption: string | null;
  uploadedBy: string;
  createdAt: string;
}

interface PhotoRow {
  id: number;
  item_type: ItemType;
  item_key: string;
  original_name: string | null;
  mime_type: string;
  size_bytes: number;
  caption: string | null;
  uploaded_by: string;
  created_at: string;
}

/** Already downscaled in the browser, so anything near this is a full-size original that slipped through. */
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

/** The image type, read from the file's first bytes (never trust the name or the browser's label). */
export function sniffImageType(b: Uint8Array): string | undefined {
  const starts = (sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);
  if (starts([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  if (starts([0x47, 0x49, 0x46, 0x38])) return "image/gif";
  return undefined;
}

const toPhoto = (r: PhotoRow): Photo => ({
  id: r.id,
  itemType: r.item_type,
  itemKey: r.item_key,
  originalName: r.original_name,
  mimeType: r.mime_type,
  sizeBytes: r.size_bytes,
  caption: r.caption,
  uploadedBy: r.uploaded_by,
  createdAt: r.created_at,
});

export function listPhotos(): Photo[] {
  return (getDb().prepare("SELECT * FROM review_photo ORDER BY id").all() as PhotoRow[]).map(toPhoto);
}

export async function savePhoto(
  input: { itemType: string; itemKey: string; file: File; caption?: string | null; uploadedBy: string },
  loginUser: string,
): Promise<Photo> {
  if (input.itemType !== "question" && input.itemType !== "code") throw new Error("Unknown item type");
  if (!input.itemKey.trim()) throw new Error("Missing item");
  if (!input.uploadedBy.trim()) throw new Error("Please type your name at the top of the page first.");
  if (input.file.size > MAX_PHOTO_BYTES) throw new Error("That photo is too big — the limit is 4 MB.");
  const data = Buffer.from(await input.file.arrayBuffer());
  const mimeType = sniffImageType(data);
  if (!mimeType) throw new Error("Please pick a photo (JPG, PNG, WEBP or GIF).");

  const db = getDb();
  const id = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO review_photo (item_type, item_key, original_name, mime_type, size_bytes, caption, uploaded_by, created_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.itemType,
        input.itemKey.trim(),
        input.file.name || null,
        mimeType,
        data.length,
        input.caption?.trim() || null,
        input.uploadedBy.trim(),
        new Date().toISOString(),
        loginUser,
      );
    db.prepare("INSERT INTO review_photo_data (photo_id, data) VALUES (?, ?)").run(info.lastInsertRowid, data);
    return info.lastInsertRowid;
  })();
  return toPhoto(db.prepare("SELECT * FROM review_photo WHERE id = ?").get(id) as PhotoRow);
}

/** The photo's metadata and image bytes, or undefined if it's gone. */
export function readPhoto(id: number): { photo: Photo; data: Buffer } | undefined {
  const row = getDb()
    .prepare("SELECT p.*, d.data FROM review_photo p JOIN review_photo_data d ON d.photo_id = p.id WHERE p.id = ?")
    .get(id) as (PhotoRow & { data: Buffer }) | undefined;
  if (!row) return undefined;
  return { photo: toPhoto(row), data: row.data };
}

/** Remove a photo the reviewer added by mistake (its bytes go with it via ON DELETE CASCADE). */
export function deletePhoto(id: number): Photo | undefined {
  const row = getDb().prepare("SELECT * FROM review_photo WHERE id = ?").get(id) as PhotoRow | undefined;
  if (!row) return undefined;
  getDb().prepare("DELETE FROM review_photo WHERE id = ?").run(id);
  return toPhoto(row);
}
