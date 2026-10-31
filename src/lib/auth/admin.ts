import crypto from "node:crypto";
import { AccessError } from "./access";

/**
 * Admin password for anything beyond review answers (flag rules, reference data, settings, deletes),
 * until this app joins Production Assistant's login. Set ADMIN_PASSWORD in .env.local.
 * There is no default: with it unset (or set to "admin"), every admin action is refused.
 * Review answers and the reviewer removing his own photos do not need it.
 */
export const ADMIN_HEADER = "x-admin-password";

export function adminConfigured(): boolean {
  const pw = process.env.ADMIN_PASSWORD ?? "";
  return pw.length > 0 && pw.toLowerCase() !== "admin";
}

export function isAdmin(req: Request): boolean {
  if (!adminConfigured()) return false;
  const given = Buffer.from(req.headers.get(ADMIN_HEADER) ?? "");
  const expected = Buffer.from(process.env.ADMIN_PASSWORD!);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

/** Call at the top of an admin-only route handler; a wrong or missing password becomes a 403 via handle(). */
export function requireAdmin(req: Request): void {
  if (!isAdmin(req)) throw new AccessError("admin");
}
