import type { FlagRuleSet } from "./dictionary";
import { mentionedContainers } from "./parse";
import type { CodeField, FlagReason, FlagResult, ParsedPackaging, Tier } from "./types";

// The 12-character core packaging code (Figure A-1): method through unit container.
const CORE_FIELDS: CodeField[] = ["presMthd", "clngDry", "presvMat", "wrapMat", "cushDunnMat", "cushDunnThk", "unitCont"];

const RULE_FIELD: Record<string, CodeField> = {
  pres_mthd: "presMthd",
  presv_mat: "presvMat",
  unit_cont: "unitCont",
  intrmdte_cont: "intrmdteCont",
  wrap_mat: "wrapMat",
  cush_dunn_mat: "cushDunnMat",
};

const isZ = (v: string | undefined) => v === "Z" || v === "ZZ" || v === "ZZZ";

/** Apply the owner's red/yellow/green rules (data/reference/flag_rules.json). */
export function evaluateFlags(p: ParsedPackaging, rules: FlagRuleSet): FlagResult {
  const text = p.raw.toUpperCase();
  const core = CORE_FIELDS.map((f) => p.codes[f]);
  const hasCore = core.some(Boolean);
  // Containers named in supplemental text count too ("BAG BL WITHIN BOX ED" under UNIT CONT:ZZ).
  const mentioned = mentionedContainers(p);
  const reasons: FlagReason[] = [];

  for (const r of rules.rules) {
    let hit = false;
    switch (r.when) {
      case "text_contains":
        hit = !!r.value && text.includes(r.value.toUpperCase());
        break;
      case "text_matches":
        hit = !!r.value && new RegExp(r.value, "i").test(p.raw);
        break;
      case "all_core_fields_zz":
        hit = hasCore && core.every(isZ);
        break;
      case "any_core_field_zz":
        hit = core.some(isZ);
        break;
      case "code_in": {
        const fields = (Array.isArray(r.field) ? r.field : [r.field ?? ""]).map((f) => RULE_FIELD[f]).filter(Boolean) as CodeField[];
        const values = new Set(r.values ?? []);
        hit = fields.some((f) => values.has(p.codes[f] ?? ""));
        const containerRule = fields.some((f) => f === "unitCont" || f === "intrmdteCont");
        if (!hit && containerRule) hit = mentioned.some((c) => values.has(c));
        break;
      }
    }
    if (hit && !reasons.some((x) => x.reason === r.reason)) reasons.push({ tier: r.tier, reason: r.reason });
  }

  // e.g. "MIL-PRF-23199E" is already covered by a rule mentioning "MIL-PRF-23199"
  const specBase = p.procedureSpecs[0]?.replace(/[A-Z]$/, "");
  if (specBase && !reasons.some((r) => r.reason.includes(specBase))) {
    reasons.push({ tier: "review", reason: `Packaging is governed by ${p.procedureSpecs.join(", ")} — follow that document's procedure.` });
  }
  if (!hasCore && !p.commercial && !p.spi && !p.procedureSpecs.length) {
    reasons.push({ tier: "review", reason: "No packaging codes found — check that the full PKGING DATA block was entered." });
  }

  const tier: Tier = reasons.some((r) => r.tier === "red") ? "red" : reasons.some((r) => r.tier === "yellow") ? "yellow" : "green";
  const t = rules.tiers[tier];
  return {
    tier,
    label: t.label,
    leadTimeWeeks: t.lead_time_weeks,
    cost: t.cost,
    action: t.action,
    needsReview: reasons.some((r) => r.tier === "review"),
    reasons,
  };
}
