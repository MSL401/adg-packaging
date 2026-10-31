import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const DICTIONARIES: [string, string][] = [
  ["method_of_preservation", "Method of preservation (PRES MTHD)"],
  ["cleaning_drying", "Cleaning & drying (CLNG/DRY)"],
  ["preservative_material", "Preservative (PRESV MAT)"],
  ["wrapping_material", "Wrapping (WRAP MAT)"],
  ["cushioning_material", "Cushioning (CUSH/DUNN MAT)"],
  ["cushioning_thickness", "Cushioning thickness"],
  ["unit_intermediate_container", "Unit / intermediate container"],
  ["optional_procedures", "Optional procedures (OPI)"],
  ["quantity_codes", "Quantity codes (QUP / ICQ)"],
  ["packing_code", "Packing code (PACK CODE)"],
  ["special_marking", "Special marking"],
];

const STATUS: Record<string, string> = {
  current: "",
  deleted_chg4: "Deleted by Change 4",
  not_in_chg4: "Not an official code",
  legacy_1D: "Older code (2073-1D)",
  legacy_1B_2C: "Older code (2073-1B/2C)",
};

interface Row {
  dictionary: string;
  code: string;
  status: string;
  title: string | null;
  plain_english: string | null;
  short_label: string | null;
  milstd_table: string | null;
  chg4_page: number | null;
}

export default function CodesPage({ searchParams }: { searchParams: { d?: string; q?: string; all?: string } }) {
  const d = searchParams.d ?? "method_of_preservation";
  const q = searchParams.q ?? "";
  const all = searchParams.all === "1";
  const like = `%${q.trim()}%`;
  const rows = getDb()
    .prepare(
      `SELECT dictionary, code, status, title, plain_english, short_label, milstd_table, chg4_page FROM code_entry
       WHERE (? = '' OR dictionary = ?) AND (? = 1 OR status = 'current')
         AND (code = ? OR title LIKE ? OR plain_english LIKE ? OR description LIKE ?)
       ORDER BY dictionary, CASE status WHEN 'current' THEN 0 ELSE 1 END, code`,
    )
    .all(q ? "" : d, q ? "" : d, all ? 1 : 0, q.trim().toUpperCase(), q ? like : "%", like, like) as Row[];
  const dictName = Object.fromEntries(DICTIONARIES);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Code lookup</h1>
        <p className="text-sm text-slate-600">Every MIL-STD-2073-1E (Change 4) packaging code, with what it means in plain English. Searching looks across all fields.</p>
      </div>
      <form className="flex flex-wrap items-center gap-2">
        <select name="d" defaultValue={d} className="rounded-md border border-slate-300 px-2 py-2 text-sm">
          {DICTIONARIES.map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <input name="q" defaultValue={q} placeholder="Code or words (e.g. BL, desiccant, foam)" className="w-72 rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <label className="flex items-center gap-1 text-sm text-slate-600">
          <input type="checkbox" name="all" value="1" defaultChecked={all} /> include old/deleted codes
        </label>
        <button className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white">Show</button>
      </form>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase text-slate-600">
            <tr>
              {q && <th className="px-3 py-2">Field</th>}
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Official meaning</th>
              <th className="px-3 py-2">In plain English</th>
              <th className="px-3 py-2">Ref</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.dictionary}-${r.code}-${r.status}`} className="border-t border-slate-100 align-top">
                {q && <td className="px-3 py-2 text-xs text-slate-500">{dictName[r.dictionary] ?? r.dictionary}</td>}
                <td className="px-3 py-2 font-mono font-semibold">
                  {r.code}
                  {STATUS[r.status] && <div className="font-sans text-xs font-normal text-amber-700">{STATUS[r.status]}</div>}
                </td>
                <td className="px-3 py-2 text-slate-600">{r.title}</td>
                <td className="px-3 py-2">
                  {r.short_label && <div className="font-semibold">{r.short_label}</div>}
                  <div className="text-slate-600">{r.plain_english}</div>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">
                  {[r.milstd_table && `Table ${r.milstd_table}`, r.chg4_page && `p. ${r.chg4_page}`].filter(Boolean).join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">{rows.length} codes</p>
    </div>
  );
}
