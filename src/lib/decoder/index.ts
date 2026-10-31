import { createDictionary, type ReferenceBundle } from "./dictionary";
import { evaluateFlags } from "./flags";
import { fromCodes, parsePackagingText } from "./parse";
import { buildRecipe } from "./recipe";
import type { DecodeResult, PackagingCodes, ParsedPackaging } from "./types";

export * from "./types";
export { createDictionary, type ReferenceBundle } from "./dictionary";
export { parsePackagingText, fromCodes, mentionedContainers } from "./parse";

/** Decode an already-parsed block against a reference bundle. */
export function decodeParsed(parsed: ParsedPackaging, ref: ReferenceBundle): DecodeResult {
  const dict = createDictionary(ref);
  return { parsed, flags: evaluateFlags(parsed, ref.flagRules), recipe: buildRecipe(parsed, dict) };
}

/** Decode pasted contract text, or codes typed into the form (codes win over text when both are given). */
export function decode(input: { text?: string; codes?: PackagingCodes }, ref: ReferenceBundle): DecodeResult {
  const hasCodes = input.codes && Object.values(input.codes).some((v) => v && v.trim());
  const parsed = hasCodes ? fromCodes(input.codes!, input.text ?? "") : parsePackagingText(input.text ?? "");
  return decodeParsed(parsed, ref);
}
