// Shared types for the packaging decoder. The decoder is pure: no DB, no I/O.

/** The coded fields of a DLA packaging block, in contract-string order. */
export const CODE_FIELDS = [
  "qup",
  "presMthd",
  "clngDry",
  "presvMat",
  "wrapMat",
  "cushDunnMat",
  "cushDunnThk",
  "unitCont",
  "opi",
  "intrmdteCont",
  "intrmdteQty",
  "packCode",
  "packingLevel",
  "specialMarking",
] as const;

export type CodeField = (typeof CODE_FIELDS)[number];
export type PackagingCodes = Partial<Record<CodeField, string>>;

/** Label each field carries in contract text, and a friendly name for screens. */
export const FIELD_INFO: Record<CodeField, { label: string; name: string }> = {
  qup: { label: "QUP", name: "Quantity per unit pack" },
  presMthd: { label: "PRES MTHD", name: "Method of preservation" },
  clngDry: { label: "CLNG/DRY", name: "Cleaning & drying" },
  presvMat: { label: "PRESV MAT", name: "Preservative" },
  wrapMat: { label: "WRAP MAT", name: "Wrapping material" },
  cushDunnMat: { label: "CUSH/DUNN MAT", name: "Cushioning / dunnage" },
  cushDunnThk: { label: "CUSH/DUNN THKNESS", name: "Cushioning thickness" },
  unitCont: { label: "UNIT CONT", name: "Unit container" },
  opi: { label: "OPI", name: "Optional procedures indicator" },
  intrmdteCont: { label: "INTRMDTE CONT", name: "Intermediate container" },
  intrmdteQty: { label: "INTRMDTE CONT QTY", name: "Unit packs per intermediate container" },
  packCode: { label: "PACK CODE", name: "Packing (outer shipping container)" },
  packingLevel: { label: "PACKING LEVEL", name: "Packing level" },
  specialMarking: { label: "SPECIAL MARKING CODE", name: "Special marking" },
};

export interface SpiRef {
  number: string;
  revision?: string;
  date?: string;
}

/** Everything pulled out of one packaging block. */
export interface ParsedPackaging {
  codes: PackagingCodes;
  stdVersion?: string; // e.g. "MIL-STD-2073-1E", "MIL-STD-2073-1D"
  spi?: SpiRef;
  drawings: string[]; // "PACKAGING SHALL BE IAW DWG 12001059"
  procedureSpecs: string[]; // e.g. "MIL-PRF-23199E"
  commercial: boolean; // ASTM D3951
  hazmatConditional: boolean; // "IF MATERIAL IS CONSIDERED HAZARDOUS ... IP025"
  supplemental: string[]; // SUPPLEMENTAL INSTRUCTIONS and other free text overrides
  packagingNotes: string[]; // "PACKAGING NOTES: A. ... B. ..."
  tqRefs: string[]; // RP001, IP025, IP056 ...
  palletization?: string;
  raw: string;
}

/** One entry from a code dictionary (seeded from data/reference/codes). */
export interface CodeEntry {
  code: string;
  title: string | null;
  description: string | null;
  plain_english: string | null;
  short_label?: string | null; // 2–6 word shop-floor name, e.g. "Standard commercial box"
  spec_refs: string[] | null;
  notes: string | null;
  status: string;
  milstd_table: string | null;
  chg4_page: number | null;
}

export interface Dictionary {
  lookup(field: CodeField, code: string): CodeEntry | undefined;
}

export type Tier = "red" | "yellow" | "green";

export interface FlagReason {
  tier: Tier | "review";
  reason: string;
}

export interface FlagResult {
  tier: Tier;
  label: string;
  leadTimeWeeks: string | null;
  cost: string | null;
  action: string;
  needsReview: boolean;
  reasons: FlagReason[];
}

export interface RecipeStep {
  title: string;
  detail: string;
  codes?: { field: CodeField; code: string }[];
  warnings?: string[];
}

export interface Layer {
  name: string;
  detail?: string;
}

export interface Material {
  name: string;
  spec?: string;
  code?: string;
  purchase: boolean; // not normally stocked → buy at award
}

export interface CodeRow {
  field: CodeField;
  label: string;
  name: string;
  code: string;
  title: string | null;
  plainEnglish: string | null;
  shortLabel: string | null; // 2–6 word shop-floor name
  status: string | null;
  milstdRef: string | null;
}

export type RecipeMode = "codes" | "spi" | "procedure_spec" | "commercial" | "empty";

export interface Recipe {
  mode: RecipeMode;
  headline: string;
  steps: RecipeStep[];
  layers: Layer[]; // inside → outside
  materials: Material[];
  warnings: string[];
  codeTable: CodeRow[];
}

export interface DecodeResult {
  parsed: ParsedPackaging;
  flags: FlagResult;
  recipe: Recipe;
}
