import { Decoder, type FieldOptions } from "@/components/Decoder";
import { getDb, getReference } from "@/lib/db";
import { CODE_FIELDS } from "@/lib/decoder/types";
import { getRecord } from "@/lib/history";

export const dynamic = "force-dynamic";

export default function DecodePage({ searchParams }: { searchParams: { record?: string } }) {
  getDb();
  const ref = getReference();
  const options: FieldOptions = {};
  for (const f of CODE_FIELDS) {
    const file = ref.fieldFiles[f];
    const codes = file ? ref.dictionaries[file]?.codes : undefined;
    if (codes) options[f] = codes.filter((c) => c.status === "current").map((c) => ({ code: c.code, title: c.short_label ?? c.title ?? "" }));
  }
  const record = searchParams.record ? getRecord(Number(searchParams.record)) : undefined;

  return (
    <div className="space-y-4">
      <div className="no-print">
        <h1 className="text-2xl font-bold">What packaging does this contract need?</h1>
        <p className="text-sm text-slate-600">
          Paste the packaging section of a DLA award or solicitation (or type the codes) and get plain-English packing steps, a materials list, and a heads-up
          if it needs special or long-lead packaging.
        </p>
      </div>
      <Decoder
        key={record?.id ?? "new"}
        options={options}
        initialText={record?.raw_block}
        initialLabel={record ? `${record.doc_number ?? record.source_file}${record.nsn ? ` — NSN ${record.nsn}` : ""}` : undefined}
      />
    </div>
  );
}
