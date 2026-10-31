import { describe, expect, it } from "vitest";
import { sniffImageType } from "./photos";

// No database here: only the byte check that runs before anything is saved.
describe("photo type check", () => {
  const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);

  it("reads the real type from the first bytes", () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(sniffImageType(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50))).toBe("image/webp");
    expect(sniffImageType(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))).toBe("image/gif");
  });

  it("rejects anything else, whatever it is named", () => {
    expect(sniffImageType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeUndefined();
    expect(sniffImageType(new TextEncoder().encode("%PDF-1.7"))).toBeUndefined();
    expect(sniffImageType(new Uint8Array())).toBeUndefined();
  });
});
