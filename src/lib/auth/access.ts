import { getDb } from "@/lib/db";

// Module key this tool will use in Production Assistant's per-person access (Off / View / Edit).
export const MODULE_KEY = "packaging";

export type AccessLevel = "off" | "view" | "edit";

export interface Access {
  user: string;
  level: AccessLevel;
}

/**
 * STANDALONE PLACEHOLDER. Production Assistant runs one shared login across apps (personal logins switch currently OFF).
 * When this module moves to /packaging, replace this with PA's server-side session + module-access check
 * (same signature), so every route keeps calling requireAccess() unchanged.
 */
export function getAccess(): Access {
  return { user: "shared", level: "edit" };
}

export class AccessError extends Error {
  constructor(public readonly needed: AccessLevel | "admin") {
    super(`Needs ${needed} access to ${MODULE_KEY}`);
  }
}

export function requireAccess(needed: Exclude<AccessLevel, "off">): Access {
  const a = getAccess();
  const ok = a.level === "edit" || (a.level === "view" && needed === "view");
  if (!ok) throw new AccessError(needed);
  return a;
}

export function logActivity(user: string, action: string, detail?: unknown): void {
  getDb()
    .prepare("INSERT INTO activity_log (at, user_name, module, action, detail) VALUES (?, ?, ?, ?, ?)")
    .run(new Date().toISOString(), user, MODULE_KEY, action, detail === undefined ? null : JSON.stringify(detail));
}
