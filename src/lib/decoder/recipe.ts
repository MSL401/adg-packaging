import { icqFromText, mentionedContainers } from "./parse";
import {
  CODE_FIELDS,
  FIELD_INFO,
  type CodeField,
  type CodeRow,
  type Dictionary,
  type Layer,
  type Material,
  type ParsedPackaging,
  type Recipe,
  type RecipeStep,
} from "./types";

// Short shop-floor names for the codes we see most. Anything else falls back to the dictionary.
const FRIENDLY: Partial<Record<CodeField | "container", Record<string, string>>> = {
  container: {
    BL: "MIL-spec clear poly bag (MIL-DTL-117, heat-sealed — not a regular commercial bag)",
    BV: "opaque waterproof greaseproof bag",
    BE: "opaque greaseproof-waterproof bag",
    SD: "clear greaseproof-waterproof bag",
    B2: "half-clear greaseproof-waterproof bag",
    BS: "foil moisture-barrier bag",
    SE: "clear moisture-barrier bag",
    B3: "foil/clear moisture-barrier bag",
    B9: "static-shielding moisture-barrier bag",
    SF: "foil moisture-barrier bag (medium duty)",
    SK: "foil moisture-barrier bag (extra heavy duty)",
    A1: "MIL-spec bag (MIL-P-130 or any MIL-DTL-117 bag), closed with tape or staples",
    A2: "any bag — a regular commercial bag is OK",
    ED: "weather-resistant corrugated box",
    E5: "corrugated fiberboard box",
    D3: "folding, set-up or fiberboard box",
    D1: "folding or set-up box",
    D4: "vendor's own folding or set-up box",
    DO: "any suitable fiber box",
    "10": "any suitable container",
    NR: "STAR PACKAGING — reusable box with vertical star foam (PPP-B-1672 Type I)",
    NW: "STAR PACKAGING — reusable box with horizontal star foam (PPP-B-1672 Type IV)",
    NS: "reusable cushioned box, folding foam (PPP-B-1672 Type II)",
    NV: "reusable cushioned box, telescoping foam (PPP-B-1672 Type III)",
  },
  wrapMat: {
    EA: "neutral wrapping paper",
    EC: "creped neutral wrapping paper",
    DA: "tissue paper",
    LA: "lens paper",
    FA: "laminated creped wrapping paper",
    GB: "greaseproof-waterproof barrier paper",
    GH: "light-duty greaseproof-waterproof barrier paper",
    JA: "2-mil poly sheet",
  },
  cushDunnMat: {
    NA: "bubble wrap or plastic foam",
    GT: "polypropylene foam",
    BG: "water-resistant paper cushioning",
    DA: "paperboard cushioning",
    JB: "fiberboard stiffener on both sides",
    AD: "blocking and bracing as needed",
    NB: "anti-static (pink) foam",
  },
};

// Bag/barrier methods and what the packer physically does for each.
const BAG_METHODS: Record<string, { bag: string; spec: string; innerBox?: boolean; outerBox?: boolean; desiccant?: boolean }> = {
  "31": { bag: "MIL-spec clear poly bag", spec: "MIL-DTL-117 Type III, Class B, Style 2 (code BL)" },
  "32": { bag: "MIL-spec clear poly bag", spec: "MIL-DTL-117 Type III, Class B, Style 2 (code BL)", innerBox: true },
  "33": { bag: "greaseproof-waterproof bag", spec: "MIL-DTL-117 Type II, Class C (codes BE, SD or B2)" },
  "41": { bag: "foil moisture-barrier (watervaporproof) bag", spec: "MIL-DTL-117 Type I, Class E (codes BS, SE, B3, SF or SK)" },
  "42": { bag: "foil moisture-barrier (watervaporproof) bag", spec: "MIL-DTL-117 Type I/II/IV, Class E (BS, SF or SK)", innerBox: true, outerBox: true },
  "43": { bag: "large floating moisture-barrier bag", spec: "MIL-DTL-6060" },
  "51": { bag: "foil moisture-barrier bag with desiccant", spec: "MIL-DTL-117 Type I/II/IV, Class E", desiccant: true },
  "52": { bag: "foil moisture-barrier bag with desiccant", spec: "MIL-DTL-117 Type I/II/IV, Class E", innerBox: true, outerBox: true, desiccant: true },
  "53": { bag: "large floating moisture-barrier bag with desiccant", spec: "MIL-DTL-6060", desiccant: true },
  GX: { bag: "static-shielding moisture-barrier bag", spec: "MIL-DTL-117 Type I, Class F (code B9) over MIL-PRF-81705 Type III wrap" },
};
const HEAT_SEAL = new Set(["31", "32", "33", "41", "42", "43", "51", "52", "53", "GX"]);
// MIL-spec (MIL-DTL-117 family) bags must be bought as such; A2 ("any bag or sack used by the vendor") is the one where a regular commercial bag is fine.
const MILSPEC_BAG_CODES = ["BL", "BV", "BE", "SD", "B2", "BS", "SE", "B3", "B9", "SF", "SK", "A1"];
const BAG_CODES = new Set([...MILSPEC_BAG_CODES, "A2"]);
const STAR_CODES = new Set(["NR", "NW", "NS", "NV"]);
// Codes the owner keeps on the shelf vs. buys per job (see data/reference/flag_rules.json).
const PURCHASE_CONTAINERS = new Set([...MILSPEC_BAG_CODES, "ED", "DQ", "DR", "E9", "EE", "EF", "EG", "EP", "NO", "SD", "SE", "SF", "SK", ...STAR_CODES]);
// Wraps and cushioning the expert says we buy per job (review 2026-11-04); EC, DA, LA paper and NA bubble/foam are on the shelf.
const PURCHASE_WRAPS = new Set(["EA", "FA", "GB", "GH", "JA"]);
const PURCHASE_CUSHIONS = new Set(["AD", "BG", "DA", "GT", "NB"]);
// Where we usually buy it (expert review 2026-11-04).
const SUPPLIER: Record<string, string> = { BL: "EDCO", BS: "EDCO", SF: "EDCO", SK: "EDCO" };

const isNone = (v?: string) => !v || v === "0" || v === "00" || v === "000";
const isZ = (v?: string) => v === "Z" || v === "ZZ" || v === "ZZZ";

function sentence(s: string | null | undefined): string {
  return (s ?? "").trim();
}

export function buildRecipe(p: ParsedPackaging, dict: Dictionary): Recipe {
  const c = p.codes;
  const look = (f: CodeField, code = c[f]) => (code ? dict.lookup(f, code) : undefined);
  const friendly = (f: CodeField, code?: string): string => {
    if (!code) return "";
    const key = f === "unitCont" || f === "intrmdteCont" ? "container" : f;
    return FRIENDLY[key]?.[code] ?? sentence(look(f, code)?.title) ?? code;
  };

  const steps: RecipeStep[] = [];
  const layers: Layer[] = [{ name: "The item" }];
  const materials: Material[] = [];
  const warnings: string[] = [];
  const addMaterial = (m: Material) => {
    if (!materials.some((x) => x.name === m.name && x.code === m.code)) materials.push(m);
  };

  const codeTable: CodeRow[] = CODE_FIELDS.filter((f) => c[f]).map((f) => {
    const e = look(f);
    // Quantities "in the clear" (001, 064) aren't dictionary codes
    const n = (f === "qup" || f === "intrmdteQty") && /^\d+$/.test(c[f]!) ? parseInt(c[f]!, 10) : undefined;
    const countText =
      n === undefined ? null : f === "qup" ? `${n} item${n === 1 ? "" : "s"} per unit pack` : n === 0 ? "No intermediate container" : `${n} unit pack${n === 1 ? "" : "s"} per intermediate box`;
    return {
      field: f,
      label: FIELD_INFO[f].label,
      name: FIELD_INFO[f].name,
      code: c[f]!,
      title: e?.title ?? (countText ? "Quantity (in the clear)" : null),
      plainEnglish: e?.plain_english ?? countText,
      shortLabel: e?.short_label ?? countText,
      status: e?.status ?? (f === "qup" || f === "intrmdteQty" || f === "packingLevel" ? null : "unknown"),
      milstdRef: e ? [e.milstd_table && `Table ${e.milstd_table}`, e.chg4_page && `p. ${e.chg4_page}`].filter(Boolean).join(", ") || null : null,
    };
  });
  for (const row of codeTable) {
    if (row.status === "unknown") warnings.push(`${row.label} code "${row.code}" is not in the MIL-STD-2073-1E code tables — double-check it against the contract.`);
    else if (row.status && row.status !== "current")
      warnings.push(`${row.label} code "${row.code}" is ${row.status === "deleted_chg4" ? "deleted by Change 4" : `an older code (${row.status})`} — confirm with the contracting officer.`);
  }

  // ---- Special modes: the codes don't tell the whole story ----
  if (p.spi || (c.presMthd === "ZZ" && c.opi === "A")) {
    const spi = p.spi ? `${p.spi.number}${p.spi.revision ? ` Rev ${p.spi.revision}` : ""}${p.spi.date ? ` dated ${p.spi.date}` : ""}` : "named in the contract";
    steps.push({
      title: "Follow the Special Packaging Instruction (SPI)",
      detail: `This item is packed exactly per SPI ${spi}${p.drawings.length ? ` and drawing ${p.drawings.join(", ")}` : ""}. The codes are all "special" (ZZ), so there are no generic steps — the SPI (DD Form 2169) is the instruction. If you don't have it, request it from the contracting officer right away.`,
      warnings: ["Do not substitute materials unless the SPI or OPI code allows it."],
    });
    addMaterial({ name: "Materials listed on the SPI (often a custom/star foam box)", purchase: true });
    layers.push({ name: "Packed per SPI", detail: spi });
    appendCommon();
    return { mode: "spi", headline: `Special Packaging Instruction ${spi}`, steps, layers, materials, warnings, codeTable };
  }

  if (p.procedureSpecs.length) {
    const spec = p.procedureSpecs.join(", ");
    steps.push({
      title: `Follow ${spec}`,
      detail: `The contract says preservation and packaging are per ${spec}, so the codes (mostly ZZ) defer to that document. Pack to its full procedure.`,
    });
    if (p.procedureSpecs.some((s) => s.startsWith("MIL-PRF-23199"))) {
      steps.push(
        { title: "Clean and cap", detail: "Clean and dry the part. Cap or plug every opening with brightly colored caps. Pack each item separately." },
        {
          title: "Green poly envelope",
          detail: "Seal each item in a green 0.006\" polyethylene envelope (MIL-P-24466 film acceptable), heat-sealed, with the ID label inside the envelope and an NSN bar code label outside.",
        },
        {
          title: "Box and paperwork",
          detail: "Box it, put one packing list inside and two outside. Keep our written packaging procedure on file for the Government (MIL-PRF-23199 3.7).",
        },
      );
      addMaterial({ name: "Green 0.006\" polyethylene envelopes", spec: "MIL-PRF-23199 / MIL-P-24466", purchase: true });
      addMaterial({ name: "Brightly colored protective caps/plugs", purchase: true });
    }
    layers.push({ name: `Packed per ${spec}` });
    appendCommon();
    return { mode: "procedure_spec", headline: `Pack per ${spec}`, steps, layers, materials, warnings, codeTable };
  }

  if (p.commercial && !c.presMthd) {
    steps.push({
      title: "Commercial packaging (ASTM D3951)",
      detail:
        "Pack it the way a good commercial supplier would: protect the item, use a sturdy box the carrier will accept, and make sure it arrives undamaged. DLA's Master List rules still apply on top (see below).",
    });
    if (p.hazmatConditional)
      steps.push({
        title: "If the item is hazardous",
        detail: "If the material is hazardous under FED-STD-313, it must instead be packed per DLA requirement IP025 (hazardous materials). Check the SDS before packing.",
      });
    layers.push({ name: "Commercial box (carrier-acceptable)" });
    addMaterial({ name: "Sturdy commercial shipping box", purchase: false });
    appendCommon();
    return { mode: "commercial", headline: "Commercial packaging per ASTM D3951", steps, layers, materials, warnings, codeTable };
  }

  if (!c.presMthd && !c.unitCont) {
    warnings.push("No packaging codes found. Paste the full PKGING DATA block or fill in the codes.");
    return { mode: "empty", headline: "Nothing to decode yet", steps, layers: [], materials, warnings, codeTable };
  }

  // ---- Coded packaging: build the pack from the item outward ----
  const qup = c.qup && /^\d+$/.test(c.qup) ? parseInt(c.qup, 10) : undefined;
  const method = c.presMthd ?? "";
  const bm = BAG_METHODS[method];
  const zzNote = "This field is special (Z/ZZ) — the real requirement is in the special instructions below.";

  // 1. Clean & dry
  if (!isNone(c.clngDry)) {
    steps.push({
      title: "Clean and dry the item",
      detail: isZ(c.clngDry) ? zzNote : sentence(look("clngDry")?.plain_english),
      codes: [{ field: "clngDry", code: c.clngDry! }],
    });
  }

  // 2. Preservative
  if (!isNone(c.presvMat)) {
    steps.push({
      title: "Apply preservative",
      detail: isZ(c.presvMat) ? zzNote : sentence(look("presvMat")?.plain_english),
      codes: [{ field: "presvMat", code: c.presvMat! }],
      warnings: ["Anything touching a preservative-coated surface must be greaseproof (MIL-PRF-121 or foil)."],
    });
    if (!isZ(c.presvMat)) layers.push({ name: "Preservative coating", detail: friendly("presvMat", c.presvMat) });
  }

  // 3. Wrap
  if (!isNone(c.wrapMat)) {
    const name = isZ(c.wrapMat) ? "Special wrap (see instructions)" : friendly("wrapMat", c.wrapMat);
    steps.push({
      title: "Wrap the item",
      detail: isZ(c.wrapMat) ? zzNote : `Wrap it in ${name} (${look("wrapMat")?.title ?? c.wrapMat}).`,
      codes: [{ field: "wrapMat", code: c.wrapMat! }],
    });
    layers.push({ name: "Wrap", detail: name });
    if (!isZ(c.wrapMat)) addMaterial({ name: capitalize(name), spec: look("wrapMat")?.title ?? undefined, code: c.wrapMat, purchase: PURCHASE_WRAPS.has(c.wrapMat!) });
  }

  // 4. Cushion
  if (!isNone(c.cushDunnMat)) {
    const name = isZ(c.cushDunnMat) ? "Special cushioning (see instructions)" : friendly("cushDunnMat", c.cushDunnMat);
    const thk = c.cushDunnThk && !isNone(c.cushDunnThk) && !isZ(c.cushDunnThk) ? look("cushDunnThk")?.title : undefined;
    steps.push({
      title: "Cushion it",
      detail: isZ(c.cushDunnMat)
        ? zzNote
        : `Cushion with ${name}${thk ? `, at least ${thk.replace(/ thick$/, "")} thick on all six sides of the item` : ""}. Cover every sharp edge and projection so nothing can punch through the bag or box.`,
      codes: [{ field: "cushDunnMat", code: c.cushDunnMat! }, ...(c.cushDunnThk ? [{ field: "cushDunnThk" as const, code: c.cushDunnThk }] : [])],
      warnings: ["Never use loose fill (packing peanuts, shredded paper)."],
    });
    layers.push({ name: "Cushioning", detail: `${name}${thk ? ` (${thk})` : ""}` });
    if (!isZ(c.cushDunnMat)) addMaterial({ name: capitalize(name), spec: look("cushDunnMat")?.title ?? undefined, code: c.cushDunnMat, purchase: PURCHASE_CUSHIONS.has(c.cushDunnMat!) });
  }

  // 5. Method of preservation (the barrier)
  if (method === "10") {
    steps.push({
      title: "No barrier bag needed (Method 10)",
      detail: "Method 10 is physical protection only: block and brace the item so it can't move or get damaged inside its container.",
      codes: [{ field: "presMthd", code: method }],
    });
  } else if (method === "20") {
    steps.push({
      title: "Preservative coating + greaseproof wrap (Method 20)",
      detail: "Coat the required surfaces with preservative, then wrap snugly in greaseproof barrier (MIL-PRF-121) or foil so it can't unwrap.",
      codes: [{ field: "presMthd", code: method }],
    });
    addMaterial({ name: "Greaseproof barrier wrap", spec: "MIL-PRF-121 or QQ-A-1876 foil", purchase: false });
  } else if (bm) {
    if (bm.innerBox) {
      steps.push({
        title: "Put it in a close-fitting inner box",
        detail: "Put the item in a snug inner box (Table C-I). Blunt the box corners so they can't puncture the bag.",
      });
      layers.push({ name: "Inner box", detail: "close-fitting, corners blunted" });
      addMaterial({ name: "Close-fitting inner box", spec: "MIL-STD-2073-1 Table C-I", purchase: false });
    }
    const bagCode = c.unitCont && BAG_CODES.has(c.unitCont) ? c.unitCont : undefined;
    const bagName = bagCode ? friendly("unitCont", bagCode) : bm.bag;
    steps.push({
      title: `Bag it and heat-seal (Method ${method})`,
      detail:
        `Put it in a ${bagName}${bagCode ? "" : ` (${bm.spec})`}. ` +
        (bm.desiccant
          ? "Add an MS20003 humidity indicator card where it can be read, then — as the very last step before sealing — add MIL-D-3464 desiccant (don't let it touch the item or bear any load). "
          : "") +
        "Squeeze out the extra air and heat-seal it shut.",
      codes: [{ field: "presMthd", code: method }],
      warnings: [
        ...(HEAT_SEAL.has(method) ? ["The heat seal must be continuous — the bag gets leak-tested and seal-tested."] : []),
        ...(bagCode && MILSPEC_BAG_CODES.includes(bagCode)
          ? [`Common mistake: a regular commercial bag used here. It must be the ${bagCode} MIL-spec bag — exactly the bag the contract names.`]
          : []),
        ...(bm.desiccant ? ["Method 50 packs hold one item each (QUP must be 1). Leave extra bag material for two reseals."] : []),
        ...(method === "GX" ? ["ESD item: requires an approved ESD control program (ANSI/ESD S20.20 or MIL-STD-1686), static-safe wrap AND cushion."] : []),
      ],
    });
    layers.push({ name: "Sealed bag", detail: `${bagName}${bagCode ? ` (${bagCode})` : ""}` });
    addMaterial({ name: capitalize(bagName), spec: bm.spec, code: bagCode, purchase: true, supplier: bagCode && SUPPLIER[bagCode] });
    if (bm.desiccant) {
      addMaterial({ name: "Desiccant bags", spec: "MIL-D-3464 Type I", purchase: true });
      addMaterial({ name: "Humidity indicator card", spec: "MS20003", purchase: true });
      if (qup && qup > 1) warnings.push(`QUP is ${qup}, but Method 50 packs must hold 1 item. The contract governs — confirm with the contracting officer.`);
    }
  } else if (isZ(method)) {
    steps.push({ title: "Special preservation method", detail: zzNote, codes: [{ field: "presMthd", code: method }] });
  } else if (method) {
    steps.push({
      title: `Preservation method ${method}`,
      detail: sentence(look("presMthd")?.plain_english) || `Method ${method}: see the code table below.`,
      codes: [{ field: "presMthd", code: method }],
    });
  }

  // 6. Unit container
  const unit = c.unitCont;
  if (unit) {
    const unitName = friendly("unitCont", unit);
    if (isZ(unit)) {
      const named = mentionedContainers(p);
      steps.push({
        title: "Unit container: special",
        detail:
          zzNote +
          (named.length
            ? ` The instructions name: ${named.map((n) => `${n} = ${friendly("unitCont", n)}`).join("; ")}.`
            : ""),
        codes: [{ field: "unitCont", code: unit }],
      });
      for (const n of named) {
        if (n === unit) continue;
        layers.push({ name: BAG_CODES.has(n) ? "Bag (from instructions)" : "Box (from instructions)", detail: `${friendly("unitCont", n)} (${n})` });
        addMaterial({ name: capitalize(friendly("unitCont", n)), spec: look("unitCont", n)?.title ?? undefined, code: n, purchase: PURCHASE_CONTAINERS.has(n), supplier: SUPPLIER[n] });
      }
    } else if (BAG_CODES.has(unit)) {
      if (!bm) {
        // Bag unit container without a bag method (e.g. Method 10 + A1)
        steps.push({
          title: "Put it in the bag",
          detail: `Put the item in a ${unitName}.`,
          codes: [{ field: "unitCont", code: unit }],
          warnings: MILSPEC_BAG_CODES.includes(unit)
            ? [`Common mistake: a regular commercial bag used here. It must be the ${unit} MIL-spec bag — exactly the bag the contract names.`]
            : undefined,
        });
        layers.push({ name: "Bag", detail: `${unitName} (${unit})` });
        addMaterial({ name: capitalize(unitName), spec: look("unitCont", unit)?.title ?? undefined, code: unit, purchase: PURCHASE_CONTAINERS.has(unit), supplier: SUPPLIER[unit] });
      }
      // otherwise the bag was covered in step 5
    } else {
      const star = STAR_CODES.has(unit);
      steps.push({
        title: star ? "STAR PACKAGING box" : "Put it in the unit box",
        detail:
          `${bm ? "Put the sealed bag" : "Put the item"} in a ${unitName}.` +
          (bm ? " Any cushioning goes between the bag and the box. Mark both the bag and the box as unit packs." : "") +
          ` ${sentence(look("unitCont", unit)?.plain_english)}`,
        codes: [{ field: "unitCont", code: unit }],
        warnings: star ? ["Star packaging is 5–7 weeks lead time and very expensive — order at award."] : undefined,
      });
      layers.push({ name: star ? "Star foam box" : "Unit box", detail: `${unitName} (${unit})` });
      addMaterial({ name: capitalize(unitName), spec: look("unitCont", unit)?.title ?? undefined, code: unit, purchase: PURCHASE_CONTAINERS.has(unit) });
    }
  }
  if (bm?.outerBox && (!unit || BAG_CODES.has(unit))) {
    steps.push({
      title: "Put the sealed bag in an outer box",
      detail: `Method ${method} is box–bag–box: put the sealed bag in an outer container from Table C-II (weather-resistant fiberboard). Mark both the bag and the outer box as unit packs.`,
    });
    layers.push({ name: "Outer box", detail: "Table C-II weather-resistant fiberboard" });
    addMaterial({ name: "Weather-resistant outer box", spec: "ASTM D5118 weather-resistant (Table C-II)", purchase: true });
  }
  if (qup) layers.push({ name: `= 1 unit pack`, detail: `${qup} item${qup === 1 ? "" : "s"} per unit pack (QUP ${c.qup})` });

  // 7. Intermediate container
  // An exact count in the special instructions beats AAA/ZZZ in the code field.
  const icqText = icqFromText(p);
  const icq = icqText && (!c.intrmdteQty || !/^\d+$/.test(c.intrmdteQty) || c.intrmdteQty === "000") ? icqText : c.intrmdteQty;
  if (icqText && icq === icqText && c.intrmdteQty !== icqText)
    warnings.push(`The special instructions set the intermediate quantity to ${parseInt(icqText, 10)} (the code said ${c.intrmdteQty ?? "nothing"}).`);
  const inter = c.intrmdteCont;
  if (inter || icq) {
    const interName = inter && !isZ(inter) ? friendly("intrmdteCont", inter) : undefined;
    let howMany: string;
    if (!icq) howMany = "Quantity per box is not stated.";
    else if (icq === "000") howMany = "No intermediate box is required — unit packs go straight into the shipping container.";
    else if (icq === "AAA")
      howMany =
        "You choose how many unit packs per box, within these limits: no more than 100 packs, 40 lb, or 1.5 cu ft, with two sides 16\" or less. Odd/short quantities go in the smallest box that fits. Unit packs over 10 lb or 0.375 cu ft get no intermediate box.";
    else if (isZ(icq)) howMany = "The quantity per box is special — see the instructions below.";
    else if (icq === "XXX") howMany = "XXX ('see method of preservation') was deleted in Change 4 — confirm the quantity with the contracting officer.";
    else if (/^\d+$/.test(icq)) howMany = `Put exactly ${parseInt(icq, 10)} unit pack${parseInt(icq, 10) === 1 ? "" : "s"} in each box.`;
    else {
      howMany = `Quantity "${icq}" is not a valid code — check the contract.`;
      warnings.push(`INTRMDTE CONT QTY "${icq}" is malformed.`);
    }

    if (icq !== "000") {
      steps.push({
        title: "Group unit packs in an intermediate box",
        detail: `${interName ? `Box to use: ${interName}. ` : inter && isZ(inter) ? zzNote + " " : ""}${howMany}`,
        codes: [...(inter ? [{ field: "intrmdteCont" as const, code: inter }] : []), ...(icq ? [{ field: "intrmdteQty" as const, code: icq }] : [])],
      });
      layers.push({ name: "Intermediate box", detail: `${interName ?? "special"}${inter ? ` (${inter})` : ""} — ${icq === "AAA" ? "you choose qty (≤100 / 40 lb / 1.5 cu ft)" : `qty ${icq}`}` });
      if (interName) addMaterial({ name: capitalize(interName), spec: look("intrmdteCont")?.title ?? undefined, code: inter, purchase: PURCHASE_CONTAINERS.has(inter!) });
    } else if (inter && !isNone(inter)) {
      warnings.push(`The contract names an intermediate container (${inter}) but the quantity is 000 (none). Ask which is right.`);
    }
  }
  const unitIsBag = (unit && BAG_CODES.has(unit)) || (bm && (!unit || BAG_CODES.has(unit)));
  if (unitIsBag && (!icq || icq === "000"))
    warnings.push(
      "The unit pack is a bag and no intermediate box is named. Our practice: box the sealed bag first only if the part is fragile; otherwise it can go straight into the shipping box. The contract governs.",
    );

  // 8. Packing (outer shipping container)
  if (c.packCode) {
    const pk = look("packCode");
    const level = c.packingLevel ? ` at Level ${c.packingLevel}` : "";
    steps.push({
      title: "Pack for shipment",
      detail:
        c.packCode === "U"
          ? "Use a normal commercial shipping box the carrier (UPS, FedEx, USPS, freight) will accept that gets it there undamaged at the lowest rate. If more than 25 small packs go to one place, palletize them."
          : `${sentence(pk?.plain_english) || `Pack code ${c.packCode}.`}${level}`,
      codes: [{ field: "packCode", code: c.packCode }],
      warnings: c.packCode === "Q" && !c.packingLevel ? ["Pack code Q needs a packing level (A or B) — find it in the contract."] : undefined,
    });
    layers.push({ name: "Shipping container", detail: c.packCode === "U" ? "carrier-acceptable commercial box" : `${pk?.title ?? c.packCode}${level}` });
    if (c.packCode === "Q" && c.packingLevel === "B") addMaterial({ name: "Weather-resistant shipping box (Level B, Table C-II)", spec: "ASTM D5118 weather-resistant", purchase: true });
    else if (c.packCode === "U") addMaterial({ name: "Commercial shipping box", purchase: false });
  }

  // OPI
  if (c.opi === "M") warnings.push("OPI M: pack exactly as coded — no substitutions of methods, materials or containers.");
  if (c.opi === "O") warnings.push("OPI O: you may substitute equal-or-better DoD-approved materials, keeping the same preservation method.");

  appendCommon();

  const headline = [
    bm ? `${capitalize(bm.bag)}, heat-sealed` : method === "10" ? "No barrier bag (physical protection)" : null,
    unit && !isZ(unit) && !BAG_CODES.has(unit) ? `in a ${friendly("unitCont", unit)}` : null,
    icq && icq !== "000" && inter && inter !== unit ? `then ${icq === "AAA" ? "grouped into" : `${parseInt(icq, 10) || icq} per`} ${friendly("intrmdteCont", inter) || "intermediate box"}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return { mode: "codes", headline: headline || "Coded MIL-STD-2073-1 packaging", steps, layers, materials, warnings, codeTable };

  // Supplemental text, packaging notes, marking and DLA-wide rules apply in every mode.
  function appendCommon() {
    if (p.packagingNotes.length)
      steps.push({ title: "Contract packaging notes (follow exactly)", detail: p.packagingNotes.join("\n") });
    if (p.supplemental.length) steps.push({ title: "Special instructions from the contract", detail: p.supplemental.join("\n") });

    const sm = c.specialMarking;
    const smEntry = sm ? dict.lookup("specialMarking", sm) : undefined;
    steps.push({
      title: "Mark it",
      detail:
        "Mark and label every unit pack, intermediate box and shipping container per MIL-STD-129 (military shipping label with bar codes on every shipment). Common mistake: a missing or wrong label on a bag or box — check every one before it ships." +
        (sm && !isNone(sm) ? ` Special marking: ${isZ(sm) ? "special — see instructions" : `${smEntry?.title ?? sm}. ${sentence(smEntry?.plain_english)}`}` : ""),
      codes: sm ? [{ field: "specialMarking", code: sm }] : undefined,
    });
    steps.push({
      title: "DLA rules that always apply",
      detail:
        "No loose fill (peanuts, newspaper, shredded paper) and no yellow packaging material. Any wood (pallets, boxes, reels) must be heat-treated and stamped (ISPM-15). " +
        `Palletize per ${p.palletization ?? "RP001"} when palletizing.`,
    });
  }
}

function capitalize(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}
