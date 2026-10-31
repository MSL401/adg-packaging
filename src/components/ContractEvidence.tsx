import { CODE_FIELDS, FIELD_INFO, type CodeField } from "@/lib/decoder/types";
import type { ContractEvidence } from "@/lib/review";

/**
 * A past contract's packaging block, laid out like the contract: contract number, NSN, every code (the ones being asked about highlighted).
 * `large` is the easy-reading size used on the review screen; the printed worksheet uses the compact size.
 * `collapsed` shows one line (contract, NSN, just the codes in question) that opens to the full block.
 */
export function ContractEvidenceBox({ e, printable = false, large = false, collapsed = false }: {
  e: ContractEvidence;
  printable?: boolean;
  large?: boolean;
  collapsed?: boolean;
}) {
  const fields = CODE_FIELDS.filter((f) => e.codes[f]);
  const chip = (f: CodeField) => {
    const on = e.highlight.includes(f);
    return (
      <span
        key={f}
        className={`rounded border ${large ? "border-2 px-2.5 py-1" : "px-1.5 py-0.5"} ${on ? "border-amber-500 bg-amber-100 font-bold text-amber-900" : "border-slate-200 bg-slate-50 text-slate-700"}`}
      >
        {FIELD_INFO[f].label}:<b className="ml-0.5">{e.codes[f]}</b>
      </span>
    );
  };

  const body = (
    <div className={`space-y-3 ${large ? "p-4" : "p-3"}`}>
      {fields.length > 0 ? (
        <div className={`flex flex-wrap font-mono ${large ? "gap-2 text-base" : "gap-1.5 text-xs"}`}>{fields.map(chip)}</div>
      ) : (
        <p className={`italic text-slate-500 ${large ? "text-base" : "text-xs"}`}>No MIL-STD-2073 codes on this contract.</p>
      )}
      {e.extra.length > 0 && (
        <ul className={`list-disc space-y-1 text-slate-800 ${large ? "pl-6 text-lg" : "pl-5 text-sm"}`}>
          {e.extra.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      )}
      {!printable && (
        <details className={large ? "text-base text-slate-600" : "text-xs text-slate-500"}>
          <summary className="cursor-pointer select-none py-1 underline">Show the full packaging text from the contract</summary>
          <pre className={`mt-1 whitespace-pre-wrap rounded bg-slate-50 p-3 font-mono text-slate-700 ${large ? "text-sm" : "text-[11px]"}`}>{e.rawBlock}</pre>
        </details>
      )}
    </div>
  );

  if (collapsed) {
    const asked = fields.filter((f) => e.highlight.includes(f));
    // With no codes in question, the first special instruction (e.g. the SPI number) is the most telling thing to show.
    const teaser = asked.length === 0 ? e.extra[0] : undefined;
    return (
      <details className="group rounded-xl border-2 border-slate-300 bg-white">
        <summary className="flex cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-base">
          <span className="inline-block text-slate-500 transition-transform group-open:rotate-90">▶</span>
          <span className="font-extrabold">Contract {e.docNumber}</span>
          {e.nsn && <span className="text-slate-600">NSN {e.nsn}</span>}
          {asked.length > 0 && <span className="flex flex-wrap gap-2 font-mono text-base">{asked.map(chip)}</span>}
          {teaser && <span className="text-slate-700">{teaser}</span>}
          <span className="ml-auto text-base text-blue-800 underline group-open:hidden">show all codes</span>
        </summary>
        <div className="border-t border-slate-200">{body}</div>
      </details>
    );
  }

  return (
    <div className={`print-break-avoid rounded-md border bg-white ${large ? "border-2 border-slate-400" : "border-slate-300"}`}>
      <div className={`flex flex-wrap items-baseline gap-x-4 border-b border-slate-200 bg-slate-100 ${large ? "px-4 py-3" : "px-3 py-1.5"}`}>
        <span className={`font-extrabold tracking-wide ${large ? "text-2xl" : "text-base"}`}>Contract {e.docNumber}</span>
        {e.nsn && <span className={large ? "text-lg text-slate-700" : "text-sm text-slate-600"}>NSN {e.nsn}</span>}
      </div>
      {body}
    </div>
  );
}
