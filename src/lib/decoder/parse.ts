import { CODE_FIELDS, type CodeField, type PackagingCodes, type ParsedPackaging, type SpiRef } from "./types";

// Contract labels → field. Longer labels first so "INTRMDTE CONT QTY" wins over "INTRMDTE CONT".
// Spaces are optional because extracted text sometimes drops them ("CUSH/DUNNTHKNESS").
const LABELS: [CodeField, string][] = [
  ["intrmdteQty", "INTRMDTE\\s*CONT\\s*QTY"],
  ["intrmdteCont", "INTRMDTE\\s*CONT"],
  ["unitCont", "(?<!INTRMDTE\\s{0,2})UNIT\\s*CONT"],
  ["cushDunnThk", "CUSH/DUNN\\s*THKNESS"],
  ["cushDunnMat", "CUSH/DUNN\\s*MAT"],
  ["presMthd", "PRES\\s*MTHD"],
  ["clngDry", "CLNG/DRY"],
  ["presvMat", "PRESV\\s*MAT"],
  ["wrapMat", "WRAP\\s*MAT"],
  ["packingLevel", "PACKING\\s*LEVEL"],
  ["packCode", "PACK\\s*CODE"],
  ["specialMarking", "SPECIAL\\s*MARKING\\s*CODE"],
  ["opi", "OPI"],
  ["qup", "QUP"],
];

// Where a packaging block ends and shipping/admin text begins.
const STOP_MARKERS =
  /\b(PARCEL POST ADDRESS|DELIVER FOB|FREIGHT FORWARDER|FREIGHT SHIPPING ADDRESS|PLACE of INSPECTION|GOVT USE|FOR TRANSPORTATION SEE|Administration Office|BULK BREAK POINT|CONTINUED ON NEXT PAGE|CONTINUATION SHEET)\b/i;

// Sentences that appear on nearly every block and carry no item-specific instruction.
const BOILERPLATE: RegExp[] = [
  /PREP FOR DELIVERY:/gi,
  /PKGING DATA\s*-?\s*(MIL-STD-2073-1\w*(,\s*\d{1,2} \w{3} \d{4})?)?/gi,
  /MARKING SHALL BE IN ACCORDANCE WITH\s*MIL-STD-129\.?/gi,
  /Mark and label all packaging and packing in accordance with MIL-STD-129\.?/gi,
  /All DLA Master List of Technical and Quality Requirements take precedence over ASTM D3951\.?/gi,
  /The Unit of Issue \(U\/I\) and Quantity per Unit Pack \(QUP\) will be as specified in the contract\/purchase order\.?/gi,
  /IF MATERIAL IS CONSIDERED HAZARDOUS IAW FED-STD-313,?( PACKAGE IN ACCORDANCE WITH TQ REQUIREMENT IP025\.?)?/gi,
  /IF THE MATERIAL IS NOT CONSIDERED HAZARDOUS,? IN ACCORDANCE WITH FED-STD-313,? THE MATERIAL SHALL BE COMMERCIALLY PACKAGED IN ACCORDANCE WITH ASTM D3951\.?/gi,
  /WILL BE PACKAGED IN ACCORDANCE WITH ASTM D3951\.?/gi,
  /IP025: PACKAGING, MARKING, AND SHIPPING OF HAZARDOUS MATERIALS/gi,
  /REFERENCE NUMBER:\s*IP025/gi,
  /(PRESERVATION AND )?PACKAGING SHALL BE IAW (MIL-[A-Z]+-\d+[A-Z]?)\.?/gi,
  /MARKING\/LABELING\/\s*BAR CODING AND SHELF LIFE \(IF APPLICABLE\) SHALL BE IAW MIL-STD-129\.?/gi,
  /PALLETIZATION SHALL BE IN ACCORDANCE WITH (RP001(: DLA PACKAGING( REQUIREMENTS FOR PROCUREMENT)?)?|MD\d+( REV \w+)?( DATED [A-Z]+ \d+, \d{4})?)/gi,
  /\bREQUIREMENTS FOR PROCUREMENT\b/gi,
  /SPECIAL PACKAGING INSTRUCTION:\s*\S+(\s*REVISION:\s*\S+)?(\s*DATED:\s*\S+)?/gi,
  /(\d\.\s*)?PACKAGING SHALL BE IAW (DWG \S+ (AND )?)?SPI#?\s*[^\s,]+,?( REV(ISION)? \w+)?( DTD [\w/]+)?\.?/gi,
  /SUPPLEMENTAL (INSTRUCTIONS|DATA)( FOR NSN [\d-]+)?:?/gi,
  /\b(-\s*)?(No special marking|Special Requirements|Fragile|Type I shelf life|Type II shelf life)\b/gi,
];

/** Treat slashed/struck zeros as zero (the standard prints zero as Ø or 0/). */
export function normalizeText(text: string): string {
  return text.replace(/Ø|0\//g, "0").replace(/\s+/g, " ").trim();
}

function cutAtStop(text: string): string {
  const m = STOP_MARKERS.exec(text);
  return m ? text.slice(0, m.index) : text;
}

export function parseCodes(text: string): PackagingCodes {
  const codes: PackagingCodes = {};
  for (const [field, label] of LABELS) {
    const m = new RegExp(`${label}\\s*:\\s*([A-Z0-9]+)`, "i").exec(text);
    if (m?.[1]) codes[field] = m[1].toUpperCase();
  }
  return codes;
}

function parseSpi(text: string): SpiRef | undefined {
  const long = /SPECIAL PACKAGING INSTRUCTION:\s*(\S+)(?:\s*REVISION:\s*(\S+))?(?:\s*DATED:\s*(\S+))?/i.exec(text);
  if (long?.[1]) return { number: long[1], revision: long[2], date: long[3] };
  // "SPI# AM10895489 REV C DTD 11/25/2024", "SPI AG00000600 REV C DTD 06/02/1992", "SPI 9384854, DTD 02/01/1989"
  const short = /\bSPI#?\s*([A-Z]{0,2}\d{5,}),?(?:\s+REV(?:ISION)?\s+(\w+))?(?:\s+DTD\s+([\w/]+))?/i.exec(text);
  if (short?.[1]) return { number: short[1], revision: short[2], date: short[3]?.replace(/\.$/, "") };
  return undefined;
}

function unique(xs: string[]): string[] {
  return [...new Set(xs)];
}

/** Parse a pasted packaging block (one CLIN's "PKGING DATA" section, or the whole PREP FOR DELIVERY area). */
export function parsePackagingText(input: string): ParsedPackaging {
  const raw = input;
  const text = cutAtStop(normalizeText(input));

  const codes = parseCodes(text);
  const std = /MIL-STD-2073-1([A-E])\b/i.exec(text);
  const drawings = unique([...text.matchAll(/PACKAGING SHALL BE IAW DWG\s+([A-Z0-9-]+)/gi)].map((m) => m[1]!));
  const procedureSpecs = unique(
    [...text.matchAll(/(?:PRESERVATION AND )?PACKAGING SHALL BE IAW (MIL-[A-Z]+-\d+[A-Z]?)/gi)].map((m) => m[1]!.toUpperCase()),
  );
  const tqRefs = unique([...text.matchAll(/\b((?:RP|IP|IQ|RQ)\d{3})\b/gi)].map((m) => m[1]!.toUpperCase()));
  const pallet = /PALLETIZATION SHALL BE IN ACCORDANCE WITH (RP001|MD\d+(?: REV \w+)?(?: DATED [A-Z]+ \d+, \d{4})?)/i.exec(text);

  // Packaging notes come as lettered steps: "PACKAGING NOTES: A. ... B. ..."
  let packagingNotes: string[] = [];
  let rest = text;
  const notesAt = rest.search(/PACKAGING NOTES:/i);
  if (notesAt >= 0) {
    const notes = rest.slice(notesAt).replace(/PACKAGING NOTES:\s*/i, "");
    packagingNotes = notes
      .split(/\s(?=[A-Z]\.\s)/)
      .map((s) => s.trim())
      .filter((s) => s.length > 2);
    rest = rest.slice(0, notesAt);
  }

  // Whatever is left after removing codes and boilerplate is item-specific free text.
  for (const [, label] of LABELS) rest = rest.replace(new RegExp(`${label}\\s*:\\s*[A-Z0-9]+(\\s*-\\s*[A-Z0-9]{2}\\b)?`, "gi"), " ");
  for (const re of BOILERPLATE) rest = rest.replace(re, " ");
  rest = rest
    .replace(/\b\d{1,3}(,\d{3})*\.\d{2}\b/g, " ") // stray prices from the CLIN table
    .replace(/\s+/g, " ")
    .replace(/^[\s.,:;-]+|[\s,:;-]+$/g, "")
    .trim();
  const supplemental = /[A-Z]{3,}/i.test(rest) ? [rest] : [];

  return {
    codes,
    stdVersion: std ? `MIL-STD-2073-1${std[1]!.toUpperCase()}` : undefined,
    spi: parseSpi(text),
    drawings,
    procedureSpecs,
    commercial: /ASTM[- ]?D\s?3951/i.test(text) && !codes.presMthd,
    hazmatConditional: /IF MATERIAL IS CONSIDERED HAZARDOUS/i.test(text),
    supplemental,
    packagingNotes,
    tqRefs,
    palletization: pallet?.[1],
    raw,
  };
}

/** Build a ParsedPackaging from codes typed into the form (no free text). */
export function fromCodes(codes: PackagingCodes, extraText = ""): ParsedPackaging {
  const clean: PackagingCodes = {};
  for (const f of CODE_FIELDS) {
    const v = codes[f]?.trim().toUpperCase().replace(/Ø/g, "0");
    if (v) clean[f] = v;
  }
  const fromText = extraText.trim() ? parsePackagingText(extraText) : undefined;
  return {
    ...(fromText ?? {
      drawings: [],
      procedureSpecs: [],
      commercial: false,
      hazmatConditional: false,
      supplemental: [],
      packagingNotes: [],
      tqRefs: [],
      raw: "",
    }),
    codes: { ...fromText?.codes, ...clean },
  };
}

/** Container codes named inside free text, e.g. "BAG BL WITHIN BOX ED", "UC=BAG BL INTO ED BOX", "BOX EC IN BAG BL". */
export function mentionedContainers(p: ParsedPackaging): string[] {
  const text = [...p.supplemental, ...p.packagingNotes].join(" ");
  const found = [
    ...[...text.matchAll(/\b(?:BAG|BOX)\s+([A-Z][A-Z0-9])\b/g)].map((m) => m[1]!),
    ...[...text.matchAll(/\b([A-Z][A-Z0-9])\s+(?:BOX|BAG)\b/g)].map((m) => m[1]!),
  ];
  return unique(found.filter((c) => !["IN", "AS", "TO", "OF", "OR", "ON", "UC", "BY"].includes(c)));
}

/** An exact intermediate quantity stated in free text ("ICQ = 064", "ICQ - 008"), which overrides AAA/ZZZ. */
export function icqFromText(p: ParsedPackaging): string | undefined {
  const m = /\bICQ\s*[=:-]\s*(\d{1,3})\b/i.exec([...p.supplemental, ...p.packagingNotes].join(" "));
  return m?.[1]?.padStart(3, "0");
}
