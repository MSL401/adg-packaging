import { ContractEvidenceBox } from "@/components/ContractEvidence";
import { listCodeItems, listQuestions } from "@/lib/review";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

const Box = ({ label }: { label: string }) => (
  <span className="mr-4 inline-flex items-center gap-1 whitespace-nowrap">
    <span className="inline-block h-3.5 w-3.5 border border-slate-700" /> {label}
  </span>
);

const Lines = ({ n }: { n: number }) => (
  <div className="mt-2 space-y-5">
    {Array.from({ length: n }, (_, i) => (
      <div key={i} className="border-b border-slate-400" />
    ))}
  </div>
);

// Paper version of the expert review: same questions and codes (only the ones on our contracts), with boxes to tick and lines to write on.
export default function WorksheetPage() {
  const { sections, items } = listQuestions();
  const codes = listCodeItems().filter((c) => c.usedIn > 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6 bg-white p-6 text-[13px] leading-snug">
      <div className="no-print flex items-center gap-3 rounded-md bg-amber-50 p-3 text-sm">
        <span>This page is laid out for printing. Answers written on paper get typed into the Expert review tab afterwards.</span>
        <PrintButton />
      </div>

      <header>
        <h1 className="text-2xl font-bold">DLA Packaging — Expert Review Worksheet</h1>
        <p>
          Reviewer: ________________________________ &nbsp; Date: ______________
        </p>
        <p className="mt-2 text-slate-700">
          We built a tool that reads the packaging codes on DLA contracts (MIL-STD-2073-1E) and turns them into plain-English packing steps. Please check our work. For
          each item tick a box, and if something is wrong, write how you would say it. There are no wrong answers — &ldquo;not sure&rdquo; is useful too.
        </p>
      </header>

      <section className="space-y-4">
        <div className="print-break-avoid">
          <h2 className="border-b-2 border-slate-800 text-lg font-bold">Part 1: Questions (most common first)</h2>
          <p className="text-slate-700">
            Our tool flags every contract: RED = star / custom foam packaging (5–7 weeks, very expensive), YELLOW = we have to buy packaging (3–4 weeks), GREEN =
            everything is on the shelf. The rare Special Packaging Instruction (SPI) questions are at the end.
          </p>
        </div>
        {items.map((q) => (
          <div key={q.id} className="print-break-avoid space-y-1 border-t-2 border-black pt-3">
            <p className="text-base font-bold">
              <span className="mr-2 rounded bg-slate-800 px-1.5 font-mono text-white">{q.tag}</span>
              {q.title}
            </p>
            <p className="text-xs text-slate-500">
              {sections.find((x) => x.id === q.section)?.short}
              {q.usedIn > 0 && ` · ${q.appliesTo === "all" ? "every contract" : `on ${q.usedIn} of our contracts`}`}
            </p>
            {q.assumption && (
              <p className="border-l-4 border-slate-300 pl-2 text-slate-700">
                <i>{q.assumption}</i>
              </p>
            )}
            {q.details && (
              <ul className="list-disc pl-5">
                {q.details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
            {q.sample && (
              <div className="inline-block border-2 border-black px-3 py-1 font-mono text-xs font-bold uppercase">
                {q.sample.lines.map((l) => (
                  <div key={l}>{l}</div>
                ))}
              </div>
            )}
            <p className="rounded bg-slate-100 px-2 py-1 font-semibold">QUESTION: {q.question}</p>
            {q.evidence.map((e) => (
              <ContractEvidenceBox key={e.docNumber} e={e} printable />
            ))}
            {q.parts && q.parts.every((p) => p.choices ?? q.partChoices) ? (
              <div className="space-y-1.5 pt-1">
                {q.parts.map((p, i) => (
                  <div key={p.id}>
                    <p className="font-semibold">
                      {i + 1}. {p.label}
                    </p>
                    <div className="flex flex-wrap gap-y-1 pl-4">
                      {(p.choices ?? q.partChoices ?? []).map((c) => (
                        <Box key={c} label={c} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : q.choices ? (
              <div className="flex flex-wrap gap-y-1 pt-1">
                {q.choices.map((c) => (
                  <Box key={c} label={c} />
                ))}
              </div>
            ) : q.kind === "assumption" ? (
              <div className="pt-1">
                <Box label="Right" />
                <Box label="Needs a change" />
                <Box label="Not sure" />
              </div>
            ) : null}
            <Lines n={q.kind === "question" && !q.choices && !q.parts ? 4 : 2} />
          </div>
        ))}
      </section>

      <section className="space-y-3" style={{ breakBefore: "page" }}>
        <div>
          <h2 className="border-b-2 border-slate-800 text-lg font-bold">Part 2: Code meanings (most common first)</h2>
          <p className="text-slate-700">
            Is &ldquo;what we tell the packer&rdquo; right? For containers and materials, also tick whether we keep it on the shelf or have to buy it. Write corrections
            in the space.
          </p>
        </div>
        {codes.map((c) => (
          <div key={c.key} className="print-break-avoid border-b border-slate-300 pb-2">
            <p>
              <span className="mr-2 rounded bg-slate-800 px-1.5 font-mono text-white">C{c.number}</span>
              <span className="font-mono text-base font-bold">{c.code}</span> &nbsp;<span className="text-slate-500">{c.dictionaryLabel}</span>{" "}
              <span className="text-xs text-slate-500">
                — on {c.usedIn} contract{c.usedIn === 1 ? "" : "s"}, e.g. <b className="text-slate-800">{c.examples.join(", ")}</b>
              </span>
            </p>
            <p className="text-base">
              <i>We tell the packer:</i> <b>{c.shortLabel ?? c.plainEnglish}</b>
            </p>
            <p className="text-slate-600">
              <i>Official:</i> {c.title}
            </p>
            <div className="pt-1">
              <Box label="Right" />
              <Box label="Needs a change" />
              <Box label="Not sure" />
            </div>
            {c.isContainer && (
              <div className="pt-1">
                <Box label="On the shelf" />
                <Box label="Must buy" />
                <Box label="Star / custom" />
              </div>
            )}
            <Lines n={1} />
          </div>
        ))}
      </section>
    </div>
  );
}
