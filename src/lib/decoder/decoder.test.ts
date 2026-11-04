import { describe, expect, it } from "vitest";
import reference from "../../../seed/reference.json";
import history from "../../../seed/history.json";
import { decode, parsePackagingText, type ReferenceBundle } from "./index";

const ref = reference as unknown as ReferenceBundle;
const records = (history as { records: { sourceFile: string; nsn: string | null; rawBlock: string }[] }).records;

const block = (lines: string) => lines.trim();

describe("parsePackagingText", () => {
  it("reads every labeled field of a standard block", () => {
    const p = parsePackagingText(
      block(`
PKGING DATA - MIL-STD-2073-1E
QUP:001  PRES MTHD:31  CLNG/DRY:1  PRESV MAT:00
WRAP MAT:00  CUSH/DUNN MAT:NA  CUSH/DUNN THKNESS:A
UNIT CONT:ZZ  OPI:M
INTRMDTE CONT:ED  INTRMDTE CONT QTY:AAA
PACK CODE:U
MARKING SHALL BE IN ACCORDANCE WITH MIL-STD-129.
SPECIAL MARKING CODE:00 -00 No special marking
PALLETIZATION SHALL BE IN ACCORDANCE WITH RP001: DLA PACKAGING
 REQUIREMENTS FOR PROCUREMENT
SUPPLEMENTAL INSTRUCTIONS: UNIT CONT = BAG BL IN BOX ED.
PARCEL POST ADDRESS: W25G1U DLA DISTRIBUTION`),
    );
    expect(p.codes).toEqual({
      qup: "001", presMthd: "31", clngDry: "1", presvMat: "00", wrapMat: "00", cushDunnMat: "NA", cushDunnThk: "A",
      unitCont: "ZZ", opi: "M", intrmdteCont: "ED", intrmdteQty: "AAA", packCode: "U", specialMarking: "00",
    });
    expect(p.stdVersion).toBe("MIL-STD-2073-1E");
    expect(p.palletization).toBe("RP001");
    expect(p.supplemental).toEqual(["UNIT CONT = BAG BL IN BOX ED."]);
  });

  it("does not confuse UNIT CONT with INTRMDTE CONT", () => {
    const p = parsePackagingText("INTRMDTE CONT:E5 INTRMDTE CONT QTY:012");
    expect(p.codes.unitCont).toBeUndefined();
    expect(p.codes.intrmdteCont).toBe("E5");
    expect(p.codes.intrmdteQty).toBe("012");
  });

  it("captures SPI references in both contract styles", () => {
    expect(parsePackagingText("SPECIAL PACKAGING INSTRUCTION: AK10737994 REVISION: B DATED: 12/18/2023").spi).toEqual({
      number: "AK10737994", revision: "B", date: "12/18/2023",
    });
    expect(parsePackagingText("PACKAGING SHALL BE IAW DWG 10895489 AND SPI# AM10895489 REV C DTD 11/25/2024.").spi?.number).toBe("AM10895489");
    expect(parsePackagingText("PACKAGING SHALL BE IAW SPI AG00000600 REV C DTD 06/02/1992.").spi).toEqual({ number: "AG00000600", revision: "C", date: "06/02/1992" });
    expect(parsePackagingText("1.PACKAGING SHALL BE IAW DWG 9384854 SPI 9384854, DTD 02/01/1989").spi).toEqual({ number: "9384854", revision: undefined, date: "02/01/1989" });
  });

  it("keeps a block that continues across a page break (history seed)", () => {
    const rec = records.find((r) => r.sourceFile === "SPE4A624R0125");
    expect(rec && parsePackagingText(rec.rawBlock).spi?.number).toBe("AG00000600");
  });
});

describe("decode — known contracts", () => {
  it("SPE8E7-26-P-0179: NR container is star packaging (red)", () => {
    const r = decode(
      {
        text: `PKGING DATA - MIL-STD-2073-1E QUP:001 PRES MTHD:31 CLNG/DRY:1 PRESV MAT:ZZ WRAP MAT:EC CUSH/DUNN MAT:ZZ CUSH/DUNN THKNESS:C
UNIT CONT:NR OPI:O INTRMDTE CONT:NR INTRMDTE CONT QTY:1 PACK CODE:U SPECIAL MARKING CODE:00 -00 No special marking
PACKAGING NOTES: A. PLACE CAP ON CONNECTOR. B. PLACE LENS TISSUE OVER LENS AND SECURE WITH TAPE. D. CLOSE BAG BY HEAT SEALING.`,
      },
      ref,
    );
    expect(r.flags.tier).toBe("red");
    expect(r.recipe.steps.some((s) => s.title === "STAR PACKAGING box")).toBe(true);
    expect(r.parsed.packagingNotes).toHaveLength(3);
  });

  it("SPE4A6-26-P-5876: all-ZZ + SPI is SPI mode, red", () => {
    const r = decode(
      {
        text: `QUP:001 PRES MTHD:ZZ CLNG/DRY:Z PRESV MAT:ZZ WRAP MAT:ZZ CUSH/DUNN MAT:ZZ CUSH/DUNN THKNESS:Z UNIT CONT:ZZ OPI:A
INTRMDTE CONT:ZZ INTRMDTE CONT QTY:ZZZ PACK CODE:U SPECIAL MARKING CODE:ZZ -ZZ Special Requirements
SPECIAL PACKAGING INSTRUCTION: AK10737994 REVISION: B DATED: 12/18/2023`,
      },
      ref,
    );
    expect(r.flags.tier).toBe("red");
    expect(r.recipe.mode).toBe("spi");
    expect(r.recipe.headline).toContain("AK10737994 Rev B");
  });

  it("Method 10 in a fiberboard box is green", () => {
    const r = decode({ codes: { qup: "001", presMthd: "10", clngDry: "1", presvMat: "00", wrapMat: "00", cushDunnMat: "NA", cushDunnThk: "C", unitCont: "E5", opi: "M", intrmdteCont: "E5", intrmdteQty: "AAA", packCode: "U", specialMarking: "00" } }, ref);
    expect(r.flags.tier).toBe("green");
    expect(r.recipe.steps.map((s) => s.title)).toContain("No barrier bag needed (Method 10)");
  });

  it("Method 31 bag in a weather-resistant box is yellow, with heat seal and both materials", () => {
    const r = decode({ codes: { presMthd: "31", unitCont: "BL", intrmdteCont: "ED", intrmdteQty: "004", packCode: "U" } }, ref);
    expect(r.flags.tier).toBe("yellow");
    expect(r.recipe.materials.filter((m) => m.purchase).map((m) => m.code)).toEqual(expect.arrayContaining(["BL", "ED"]));
    expect(r.recipe.steps.find((s) => s.title.startsWith("Group"))?.detail).toContain("exactly 4 unit packs");
  });

  it("BL is a MIL-spec bag to buy; A2 is any bag, nothing to buy", () => {
    const bl = decode({ codes: { presMthd: "31", unitCont: "BL", packCode: "U" } }, ref);
    expect(bl.recipe.materials.find((m) => m.code === "BL")).toMatchObject({ purchase: true });
    expect(bl.recipe.headline).toContain("MIL-spec");
    const a2 = decode({ codes: { presMthd: "10", unitCont: "A2", packCode: "U" } }, ref);
    expect(a2.flags.tier).toBe("green");
    expect(a2.recipe.materials.find((m) => m.code === "A2")).toMatchObject({ purchase: false });
  });

  it("ZZ unit container reads the containers named in the supplemental text", () => {
    const r = decode({ text: "PRES MTHD:10 UNIT CONT:ZZ INTRMDTE CONT:E5 INTRMDTE CONT QTY:AAA PACK CODE:U SUPPLEMENTAL INSTRUCTIONS: USE BOX EC IN BAG BL AS UNIT CONTAINER" }, ref);
    expect(r.flags.tier).toBe("yellow"); // BL bag named in the text
    expect(r.flags.needsReview).toBe(true);
    expect(r.recipe.steps.find((s) => s.title === "Unit container: special")?.detail).toContain("BL =");
  });

  it("commercial D3951 blocks decode in commercial mode", () => {
    const r = decode({ text: "PKGING DATA-QUP:001 IF MATERIAL IS CONSIDERED HAZARDOUS IAW FED-STD-313, PACKAGE IN ACCORDANCE WITH TQ REQUIREMENT IP025. IF THE MATERIAL IS NOT CONSIDERED HAZARDOUS, IN ACCORDANCE WITH FED-STD-313, THE MATERIAL SHALL BE COMMERCIALLY PACKAGED IN ACCORDANCE WITH ASTM D3951." }, ref);
    expect(r.recipe.mode).toBe("commercial");
    expect(r.parsed.hazmatConditional).toBe(true);
    expect(r.parsed.supplemental).toEqual([]);
  });
});

describe("decode — what the expert review taught us (2026-11-04)", () => {
  it("star packaging is 5–7 weeks, not 8–10", () => {
    const r = decode({ codes: { presMthd: "10", unitCont: "NR", packCode: "U" } }, ref);
    expect(r.flags.leadTimeWeeks).toBe("5-7");
    expect(r.recipe.steps.find((s) => s.title === "STAR PACKAGING box")?.warnings?.[0]).toContain("5–7 weeks");
  });

  it("wraps and cushioning he says we buy make the job yellow; shelf ones stay green", () => {
    const bought = decode({ codes: { presMthd: "10", wrapMat: "GH", cushDunnMat: "GT", cushDunnThk: "C", unitCont: "E5", packCode: "U" } }, ref);
    expect(bought.flags.tier).toBe("yellow");
    expect(bought.recipe.materials.filter((m) => m.purchase).map((m) => m.code)).toEqual(["GH", "GT"]);
    const shelf = decode({ codes: { presMthd: "10", wrapMat: "EC", cushDunnMat: "NA", cushDunnThk: "C", unitCont: "E5", packCode: "U" } }, ref);
    expect(shelf.flags.tier).toBe("green");
    expect(shelf.recipe.materials.every((m) => !m.purchase)).toBe(true);
  });

  it("cushioning thickness goes on all six sides", () => {
    const r = decode({ codes: { presMthd: "10", cushDunnMat: "NA", cushDunnThk: "C", unitCont: "E5", packCode: "U" } }, ref);
    expect(r.recipe.steps.find((s) => s.title === "Cushion it")?.detail).toContain("on all six sides of the item");
  });

  it("MIL-spec bags warn about the commercial-bag mistake and name the usual supplier", () => {
    const r = decode({ codes: { presMthd: "31", unitCont: "BL", packCode: "U" } }, ref);
    expect(r.recipe.steps.find((s) => s.title.startsWith("Bag it"))?.warnings?.join(" ")).toContain("regular commercial bag");
    expect(r.recipe.materials.find((m) => m.code === "BL")?.supplier).toBe("EDCO");
    expect(r.recipe.warnings.join(" ")).toContain("only if the part is fragile");
  });

  it("uses the code labels the expert chose", () => {
    const r = decode({ codes: { presMthd: "10", clngDry: "1", unitCont: "BS", specialMarking: "01", packCode: "U" } }, ref);
    const label = (f: string) => r.recipe.codeTable.find((row) => row.field === f)?.shortLabel;
    expect(label("presMthd")).toBe("Physical protection");
    expect(label("unitCont")).toContain("MIL-DTL-117, Type I, Class E, Style 1");
    expect(label("specialMarking")).toContain("Apply FRAGILE");
  });
});

describe("decode — every historical contract block (golden sweep)", () => {
  const results = records.map((rec) => ({ rec, r: decode({ text: rec.rawBlock }, ref) }));

  it("decodes all blocks without throwing and always produces steps", () => {
    expect(results.length).toBeGreaterThan(250);
    for (const { rec, r } of results) {
      if (r.recipe.mode !== "empty") expect(r.recipe.steps.length, rec.sourceFile).toBeGreaterThan(0);
    }
  });

  it("every coded block resolves every code to a dictionary entry", () => {
    const unknown = results.flatMap(({ rec, r }) =>
      r.recipe.codeTable.filter((row) => row.status === "unknown").map((row) => `${rec.sourceFile}: ${row.label}=${row.code}`),
    );
    expect(unknown).toEqual([]);
  });

  it("flags both confirmed star-packaging NSNs red on every award", () => {
    for (const nsn of ["6220-01-073-7994", "6220-01-195-6637"]) {
      const tiers = results.filter(({ rec }) => rec.nsn === nsn).map(({ r }) => r.flags.tier);
      expect(tiers.length, nsn).toBeGreaterThan(0);
      expect(new Set(tiers), nsn).toEqual(new Set(["red"]));
    }
  });

  it("supplemental text never contains leftover code labels", () => {
    const leaks = results.flatMap(({ rec, r }) =>
      r.parsed.supplemental.filter((s) => /\b(PRES MTHD|WRAP MAT|UNIT CONT|PACK CODE)\s*:/.test(s)).map((s) => `${rec.sourceFile}: ${s}`),
    );
    expect(leaks).toEqual([]);
  });
});
