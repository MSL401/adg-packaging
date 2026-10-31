import { afterEach, describe, expect, it } from "vitest";
import { ADMIN_HEADER, isAdmin } from "./admin";

const req = (pw?: string) => new Request("http://x/", { headers: pw === undefined ? {} : { [ADMIN_HEADER]: pw } });

describe("admin password", () => {
  const saved = process.env.ADMIN_PASSWORD;
  afterEach(() => {
    if (saved === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = saved;
  });

  it("refuses everything when no password is set", () => {
    delete process.env.ADMIN_PASSWORD;
    expect(isAdmin(req(""))).toBe(false);
    expect(isAdmin(req("anything"))).toBe(false);
  });

  it("never accepts 'admin' as the password", () => {
    process.env.ADMIN_PASSWORD = "Admin";
    expect(isAdmin(req("Admin"))).toBe(false);
  });

  it("accepts only the exact password", () => {
    process.env.ADMIN_PASSWORD = "crate-and-dunnage-42";
    expect(isAdmin(req("crate-and-dunnage-42"))).toBe(true);
    expect(isAdmin(req("crate-and-dunnage-4"))).toBe(false);
    expect(isAdmin(req())).toBe(false);
  });
});
