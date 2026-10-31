import type { CodeEntry, CodeField, Dictionary } from "./types";

/** Shape of seed/reference.json (built by scripts/build_app_seed.py). */
export interface ReferenceBundle {
  version: string;
  fieldFiles: Record<string, string>;
  dictionaries: Record<string, { field: string; contract_label: string | null; codes: CodeEntry[] }>;
  flagRules: FlagRuleSet;
}

export interface FlagRule {
  tier: "red" | "yellow" | "review";
  when: "text_contains" | "text_matches" | "code_in" | "all_core_fields_zz" | "any_core_field_zz";
  value?: string;
  field?: string | string[];
  values?: string[];
  reason: string;
}

export interface FlagRuleSet {
  tiers: Record<"red" | "yellow" | "green" | "review", { label: string; lead_time_weeks: string | null; cost: string | null; action: string }>;
  rules: FlagRule[];
}

// Status preference when a code exists in several editions (current Change 4 wins).
const STATUS_RANK: Record<string, number> = { current: 0, legacy_1D: 1, legacy_1B_2C: 2, deleted_chg4: 3, not_in_chg4: 4 };

export function createDictionary(bundle: Pick<ReferenceBundle, "fieldFiles" | "dictionaries">): Dictionary {
  const byFile = new Map<string, Map<string, CodeEntry>>();
  for (const [file, dict] of Object.entries(bundle.dictionaries)) {
    const m = new Map<string, CodeEntry>();
    for (const c of dict.codes) {
      const prev = m.get(c.code);
      if (!prev || (STATUS_RANK[c.status] ?? 9) < (STATUS_RANK[prev.status] ?? 9)) m.set(c.code, c);
    }
    byFile.set(file, m);
  }
  return {
    lookup(field: CodeField, code: string) {
      const file = bundle.fieldFiles[field];
      if (!file) return undefined;
      const m = byFile.get(file);
      return m?.get(code) ?? m?.get(code.replace(/^0+(?=\d)/, "")) ?? undefined;
    },
  };
}
