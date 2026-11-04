import type { DecodeResult, Layer, Material } from "@/lib/decoder/types";
import { FIELD_INFO } from "@/lib/decoder/types";
import type { HistoryRow } from "@/lib/history";
import Link from "next/link";
import { TierBadge } from "./TierBadge";

const BANNER = {
  red: "border-red-400 bg-red-50 text-red-900",
  yellow: "border-amber-400 bg-amber-50 text-amber-900",
  green: "border-emerald-400 bg-emerald-50 text-emerald-900",
};

/** Draw the pack as nested boxes: shipping container on the outside, the item in the middle. */
function Nesting({ layers }: { layers: Layer[] }) {
  const shown = layers.filter((l) => !l.name.startsWith("="));
  const build = (i: number): React.ReactNode => {
    const l = shown[i];
    if (!l) return null;
    const inner = i === 0;
    return (
      <div className={`rounded-lg border-2 ${inner ? "border-slate-700 bg-slate-700 text-white" : "border-slate-300 bg-white"} p-2`}>
        <div className="text-sm font-semibold">{l.name}</div>
        {l.detail && <div className={`text-sm ${inner ? "text-slate-200" : "text-slate-500"}`}>{l.detail}</div>}
        {i > 0 && <div className="mt-2">{build(i - 1)}</div>}
      </div>
    );
  };
  return shown.length ? <div>{build(shown.length - 1)}</div> : null;
}

function MaterialList({ items }: { items: Material[] }) {
  return (
    <ul className="space-y-2">
      {items.map((m, i) => (
        <li key={i}>
          <span className="font-medium">{m.name}</span>
          {m.code && <span className="ml-1 font-mono text-sm text-slate-500">({m.code})</span>}
          {m.spec && <span className="block text-sm text-slate-500">{m.spec}</span>}
          {m.supplier && <span className="block text-sm text-slate-500">Usually from {m.supplier}</span>}
        </li>
      ))}
    </ul>
  );
}

// Reads top to bottom: flag → one-line summary → steps → picture + materials → heads-up → codes → past awards.
export function RecipeView({ result, history }: { result: DecodeResult; history?: HistoryRow[] }) {
  const { flags, recipe } = result;
  const toBuy = recipe.materials.filter((m) => m.purchase);
  const onShelf = recipe.materials.filter((m) => !m.purchase);
  return (
    <div className="space-y-8 text-base">
      <section className={`print-break-avoid rounded-xl border-2 p-5 ${BANNER[flags.tier]}`}>
        <div className="flex flex-wrap items-center gap-3">
          <TierBadge tier={flags.tier} review={flags.needsReview} />
          <h2 className="text-xl font-bold">{flags.label}</h2>
          {flags.leadTimeWeeks && flags.leadTimeWeeks !== "0" && <span>Lead time: ~{flags.leadTimeWeeks} weeks</span>}
          {flags.cost && <span>Cost: {flags.cost}</span>}
        </div>
        <p className="mt-1">{flags.action}</p>
        {flags.reasons.length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer select-none text-sm underline">Why this flag ({flags.reasons.length})</summary>
            <ul className="mt-1 list-disc pl-5 text-sm">
              {flags.reasons.map((r, i) => (
                <li key={i}>
                  {r.tier === "review" ? "⚠️ " : ""}
                  {r.reason}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section>
        <p className="text-sm uppercase tracking-wide text-slate-500">In one line</p>
        <h1 className="text-3xl font-bold leading-tight">{recipe.headline}</h1>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">How to pack it</h2>
        <ol className="space-y-3">
          {recipe.steps.map((s, i) => (
            <li key={i} className="print-break-avoid flex gap-4 rounded-xl border border-slate-200 bg-white p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-lg font-bold text-white">{i + 1}</span>
              <div className="min-w-0 space-y-1">
                <div className="text-lg font-semibold">
                  {s.title}
                  {s.codes?.map((c) => (
                    <span key={c.field + c.code} className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-sm font-normal text-slate-600">
                      {FIELD_INFO[c.field].label} {c.code}
                    </span>
                  ))}
                </div>
                <p className="whitespace-pre-line text-slate-700">{s.detail}</p>
                {s.warnings?.map((w, j) => (
                  <p key={j} className="font-medium text-amber-800">
                    ⚠️ {w}
                  </p>
                ))}
                {s.pictures?.length ? (
                  <details className="print:hidden pt-1">
                    <summary className="cursor-pointer text-sm font-medium text-sky-700">
                      📷 See the picture{s.pictures.length > 1 ? "s" : ""}
                    </summary>
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                      {s.pictures.map((pic) => (
                        <figure key={pic.src} className="space-y-1">
                          <a href={pic.src} target="_blank" rel="noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={pic.src} alt={pic.caption} loading="lazy" className="w-full rounded border border-slate-200" />
                          </a>
                          <figcaption className="text-xs text-slate-500">{pic.caption}</figcaption>
                        </figure>
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>
              <span className="ml-auto hidden h-6 w-6 shrink-0 rounded border-2 border-slate-400 print:block" />
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="print-break-avoid space-y-2">
          <h2 className="text-2xl font-semibold">What it looks like</h2>
          <Nesting layers={recipe.layers} />
          {recipe.layers.find((l) => l.name.startsWith("=")) && (
            <p className="text-sm text-slate-500">{recipe.layers.find((l) => l.name.startsWith("="))?.detail}</p>
          )}
        </section>

        <section className="print-break-avoid space-y-4">
          <h2 className="text-2xl font-semibold">Materials</h2>
          {toBuy.length > 0 && (
            <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
              <p className="mb-2 font-bold text-amber-900">🛒 Order these — not on our shelf</p>
              <MaterialList items={toBuy} />
            </div>
          )}
          {onShelf.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="mb-2 font-bold text-emerald-800">✅ On the shelf</p>
              <MaterialList items={onShelf} />
            </div>
          )}
        </section>
      </div>

      {recipe.warnings.length > 0 && (
        <section className="print-break-avoid rounded-xl border border-amber-300 bg-amber-50 p-4">
          <h2 className="mb-1 text-lg font-semibold text-amber-900">Heads up</h2>
          <ul className="list-disc space-y-1 pl-5 text-amber-900">
            {recipe.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </section>
      )}

      {recipe.codeTable.length > 0 && (
        <section className="print-break-avoid space-y-2">
          <h2 className="text-2xl font-semibold">The codes on this contract</h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {recipe.codeTable.map((r) => (
              <li key={r.field} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <div className="font-mono text-sm text-slate-500">
                  {r.label} <b className="text-base text-slate-900">{r.code}</b>
                </div>
                <div className="font-semibold">{r.shortLabel ?? r.plainEnglish ?? "—"}</div>
                {((r.title && r.title !== r.shortLabel) || r.milstdRef) && (
                  <details className="text-sm text-slate-600">
                    <summary className="cursor-pointer select-none text-slate-500 underline">official wording</summary>
                    {r.title !== r.shortLabel && r.title}
                    {r.milstdRef && <span className="block text-xs text-slate-400">MIL-STD-2073-1E {r.milstdRef}</span>}
                  </details>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {history && history.length > 0 && (
        <section className="no-print space-y-2">
          <h2 className="text-2xl font-semibold">How we were told to pack this NSN before</h2>
          {new Set(history.map((h) => h.headline)).size > 1 && (
            <p className="font-medium text-amber-800">⚠️ Packaging for this NSN has changed between awards — pack to the current contract, not from memory.</p>
          )}
          <ul className="space-y-1">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-2">
                <TierBadge tier={h.tier} review={h.needsReview} />
                <Link href={`/?record=${h.id}`} className="font-mono text-blue-700 hover:underline">
                  {h.docNumber}
                </Link>
                <span className="text-slate-600">{h.headline}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-sm text-slate-400">
        Plain-English guidance based on MIL-STD-2073-1E Change 4, DLA RP001 and MIL-STD-129. The contract, its SPI/drawings and the standards govern.
      </p>
    </div>
  );
}
