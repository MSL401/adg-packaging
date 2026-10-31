import Link from "next/link";
import { TierBadge } from "@/components/TierBadge";
import { searchHistory } from "@/lib/history";

export const dynamic = "force-dynamic";

export default function HistoryPage({ searchParams }: { searchParams: { q?: string; tier?: string } }) {
  const q = searchParams.q ?? "";
  const tier = searchParams.tier ?? "";
  const all = searchHistory(q);
  const rows = tier ? all.filter((r) => r.tier === tier) : all;
  const count = (t: string) => all.filter((r) => r.tier === t).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Past contracts</h1>
        <p className="text-sm text-slate-600">Packaging pulled from our DLA awards, POs and solicitations. Click a contract to see the full packing recipe.</p>
      </div>
      <form className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="NSN, contract / PO #, or part number"
          className="w-80 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
        <select name="tier" defaultValue={tier} className="rounded-md border border-slate-300 px-2 py-2 text-sm">
          <option value="">All ({all.length})</option>
          <option value="red">🔴 Star / special ({count("red")})</option>
          <option value="yellow">🟡 Purchase needed ({count("yellow")})</option>
          <option value="green">🟢 Basic ({count("green")})</option>
        </select>
        <button className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white">Search</button>
      </form>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2">Flag</th>
              <th className="px-3 py-2">Contract / PO</th>
              <th className="px-3 py-2">NSN</th>
              <th className="px-3 py-2">Part #</th>
              <th className="px-3 py-2">Packaging in one line</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 align-top">
                <td className="px-3 py-2">
                  <TierBadge tier={r.tier} review={r.needsReview} />
                </td>
                <td className="px-3 py-2">
                  <Link href={`/?record=${r.id}`} className="font-mono text-blue-700 hover:underline">
                    {r.docNumber}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-mono">{r.nsn ?? "—"}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.partNumber ?? ""}</td>
                <td className="px-3 py-2">{r.headline}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                  Nothing found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
