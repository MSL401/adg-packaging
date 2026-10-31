"use client";

import { useEffect, useState } from "react";
import { CODE_FIELDS, FIELD_INFO, type CodeField, type DecodeResult, type PackagingCodes } from "@/lib/decoder/types";
import type { HistoryRow } from "@/lib/history";
import { RecipeView } from "./RecipeView";

export type FieldOptions = Partial<Record<CodeField, { code: string; title: string }[]>>;

const EXAMPLE = `PKGING DATA - MIL-STD-2073-1E
QUP:001  PRES MTHD:31  CLNG/DRY:1  PRESV MAT:00
WRAP MAT:00  CUSH/DUNN MAT:GT  CUSH/DUNN THKNESS:A
UNIT CONT:BL  OPI:M
INTRMDTE CONT:ED  INTRMDTE CONT QTY:064
PACK CODE:U
SPECIAL MARKING CODE:00 -00 No special marking`;

export function Decoder({ options, initialText, initialLabel }: { options: FieldOptions; initialText?: string; initialLabel?: string }) {
  const [mode, setMode] = useState<"paste" | "codes">("paste");
  const [text, setText] = useState(initialText ?? "");
  const [codes, setCodes] = useState<PackagingCodes>({});
  const [result, setResult] = useState<(DecodeResult & { history: HistoryRow[] }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(input: { text?: string; codes?: PackagingCodes }) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/packaging/decode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Decode failed");
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (initialText) void run({ text: initialText });
  }, [initialText]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void run(mode === "paste" ? { text } : { codes });
  };

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="no-print space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          {(["paste", "codes"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${mode === m ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
            >
              {m === "paste" ? "Paste from contract" : "Enter codes"}
            </button>
          ))}
          {initialLabel && <span className="text-sm text-slate-500">Loaded: {initialLabel}</span>}
        </div>

        {mode === "paste" ? (
          <div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={9}
              placeholder={EXAMPLE}
              className="w-full rounded-md border border-slate-300 p-3 font-mono text-sm focus:border-slate-500 focus:outline-none"
            />
            <p className="text-xs text-slate-500">
              Copy everything from <span className="font-mono">PREP FOR DELIVERY</span> / <span className="font-mono">PKGING DATA</span> through the special
              instructions. Extra text is fine.{" "}
              <button type="button" className="text-blue-700 hover:underline" onClick={() => setText(EXAMPLE)}>
                Load an example
              </button>
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {CODE_FIELDS.map((f) => (
              <label key={f} className="text-xs">
                <span className="block font-mono text-slate-500">{FIELD_INFO[f].label}</span>
                <span className="block text-slate-700">{FIELD_INFO[f].name}</span>
                <input
                  list={`opt-${f}`}
                  value={codes[f] ?? ""}
                  onChange={(e) => setCodes({ ...codes, [f]: e.target.value.toUpperCase() })}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 font-mono text-sm uppercase focus:border-slate-500 focus:outline-none"
                />
                {options[f] && (
                  <datalist id={`opt-${f}`}>
                    {options[f]!.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.title}
                      </option>
                    ))}
                  </datalist>
                )}
              </label>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={busy} className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
            {busy ? "Decoding…" : "Decode"}
          </button>
          {result && (
            <button type="button" onClick={() => window.print()} className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">
              🖨️ Print packing sheet
            </button>
          )}
          {error && <span className="text-sm text-red-700">{error}</span>}
        </div>
      </form>

      {result && <RecipeView result={result} history={result.history} />}
    </div>
  );
}
