"use client";

import { useEffect, useMemo, useState } from "react";
import type { CodeItem, Feedback, ItemType, NumberedQuestion, ReviewSection, Stock, Verdict } from "@/lib/review";
import type { Photo } from "@/lib/photos";
import { ContractEvidenceBox } from "./ContractEvidence";

// Built for a reviewer who isn't used to computers: large type, big click targets, plain words, one obvious Save button.

interface Data {
  questions: { sections: ReviewSection[]; items: NumberedQuestion[] };
  codes: CodeItem[];
  feedback: Feedback[];
  photos: Photo[];
}

const NAME_KEY = "packaging-reviewer-name";

const VERDICT_LABEL: Record<Verdict, string> = { ok: "✅ Yes, that's right", change: "✏️ Needs a change", unsure: "❓ I'm not sure", answered: "📝 Answered" };
const STOCK_LABEL: Record<Stock, string> = { stock: "We keep it on the shelf", buy: "We have to buy it (3–4 weeks)", star: "Star / custom (5–7 weeks)", unknown: "I don't know" };

const fbKey = (t: ItemType, k: string) => `${t}|${k}`;
/** DOM id of a card, for "Next unanswered" to scroll to. */
const anchorId = (t: ItemType, k: string) => `${t}-${k.replace(/[^A-Za-z0-9-]/g, "_")}`;

export function ReviewBoard() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [tab, setTab] = useState<"round2" | "questions" | "codes" | "answers" | null>(null);

  useEffect(() => {
    try {
      setName(localStorage.getItem(NAME_KEY) ?? "");
    } catch {
      /* storage blocked — they just type it again */
    }
    fetch("/api/packaging/review")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Could not load");
        setData(j as Data);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const saveName = (v: string) => {
    setName(v);
    try {
      localStorage.setItem(NAME_KEY, v);
    } catch {
      /* ignore */
    }
  };

  const latest = useMemo(() => new Map((data?.feedback ?? []).map((f) => [fbKey(f.itemType, f.itemKey), f])), [data]);
  const photoKit: PhotoKit = {
    reviewer: name,
    photosFor: (t, k) => (data?.photos ?? []).filter((p) => p.itemType === t && p.itemKey === k),
    onChange: (photos) => setData((d) => (d ? { ...d, photos } : d)),
    all: data?.photos ?? [],
  };
  const onSaved = (f: Feedback) => setData((d) => (d ? { ...d, feedback: [f, ...d.feedback.filter((x) => fbKey(x.itemType, x.itemKey) !== fbKey(f.itemType, f.itemKey))] } : d));

  if (error) return <p className="rounded-xl bg-red-50 p-4 text-xl text-red-700">{error}</p>;
  if (!data) return <p className="text-xl text-slate-500">Loading…</p>;

  const round1 = data.questions.items.filter((q) => (q.round ?? 1) === 1);
  const round2 = data.questions.items.filter((q) => q.round === 2);
  const qDone = round1.filter((q) => latest.has(fbKey("question", q.id))).length;
  const rDone = round2.filter((q) => latest.has(fbKey("question", q.id))).length;
  const nextR = round2.find((q) => !latest.has(fbKey("question", q.id)));
  // Open on Round 2 while it has unanswered questions; otherwise on Part 1.
  const shown = tab ?? (nextR ? "round2" : "questions");
  const usedCodes = data.codes.filter((c) => c.usedIn > 0);
  const cDone = usedCodes.filter((c) => latest.has(fbKey("code", c.key))).length;
  const nextQ = round1.find((q) => !latest.has(fbKey("question", q.id)));
  const nextC = usedCodes.find((c) => !latest.has(fbKey("code", c.key)));
  const nextUnanswered =
    shown === "round2" ? nextR && anchorId("question", nextR.id) : shown === "questions" ? nextQ && anchorId("question", nextQ.id) : nextC && anchorId("code", nextC.key);
  const [done, total] = shown === "round2" ? [rDone, round2.length] : shown === "questions" ? [qDone, round1.length] : [cDone, usedCodes.length];

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-2xl border-2 border-slate-200 bg-white p-5">
        <label className="block">
          <span className="block text-2xl font-bold">Your name</span>
          <input
            value={name}
            onChange={(e) => saveName(e.target.value)}
            placeholder="Type your name here"
            className={`mt-2 w-full max-w-md rounded-xl border-2 px-4 py-3 text-2xl focus:outline-none focus:ring-4 focus:ring-blue-300 ${
              name.trim() ? "border-slate-400" : "border-amber-500 bg-amber-50"
            }`}
          />
        </label>
        <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-3 text-base text-slate-600">
          <span>For the office:</span>
          <a href="/review/worksheet" target="_blank" className="underline hover:text-slate-900">
            Print a paper copy
          </a>
          <a href="/api/packaging/review/export" className="underline hover:text-slate-900">
            Download answers for Excel
          </a>
        </div>
      </div>

      {/* Stays at the top while scrolling: the tabs, how far along he is, and a jump to the next unanswered card. */}
      <div className="sticky top-0 z-20 -mx-2 space-y-2 border-b-2 border-slate-200 bg-slate-50/95 px-2 py-2 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          {(
            [
              ...(round2.length ? ([["round2", `Round 2: Follow-ups`, rDone, round2.length]] as const) : []),
              ["questions", `Part 1: Questions`, qDone, round1.length],
              ["codes", `Part 2: Code meanings`, cDone, usedCodes.length],
              ["answers", `Your answers`, data.feedback.length, null],
            ] as const
          ).map(([k, label, done, total]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`rounded-xl border-2 px-4 py-2 text-lg font-semibold ${
                shown === k ? "border-slate-800 bg-slate-800 text-white" : "border-slate-300 bg-white text-slate-800 hover:bg-slate-100"
              }`}
            >
              {label} <span className="font-normal opacity-80">{total === null ? `(${done})` : `${done} / ${total}`}</span>
            </button>
          ))}
          {shown !== "answers" && nextUnanswered && (
            <button
              type="button"
              onClick={() => document.getElementById(nextUnanswered)?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="ml-auto rounded-xl bg-blue-700 px-4 py-2 text-lg font-bold text-white hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-300"
            >
              ⬇ Next unanswered
            </button>
          )}
          {shown !== "answers" && !nextUnanswered && <span className="ml-auto text-lg font-bold text-emerald-700">✓ All done in this part — thank you!</span>}
        </div>
        {shown !== "answers" && (
          <div className="h-2 overflow-hidden rounded-full bg-slate-200" aria-label="Progress">
            <div
              className="h-full rounded-full bg-emerald-600 transition-all"
              style={{ width: `${Math.round((100 * done) / Math.max(1, total))}%` }}
            />
          </div>
        )}
      </div>

      {shown === "round2" && <Round2List items={round2} latest={latest} reviewer={name} onSaved={onSaved} photoKit={photoKit} />}

      {shown === "questions" && <QuestionList data={data} items={round1} latest={latest} reviewer={name} onSaved={onSaved} photoKit={photoKit} />}

      {shown === "codes" && <CodeList codes={data.codes} latest={latest} reviewer={name} onSaved={onSaved} photoKit={photoKit} />}

      {shown === "answers" && <Answers data={data} />}
    </div>
  );
}

// ---------- one feedback form, shared by questions and codes ----------

interface FormState {
  verdict: Verdict | null;
  choice: string;
  partAnswers: Record<string, string>;
  stock: Stock | "";
  suggestedText: string;
  comment: string;
}

function useFeedbackForm(itemType: ItemType, itemKey: string, last: Feedback | undefined, reviewer: string, onSaved: (f: Feedback) => void) {
  const initial = (): FormState => ({
    verdict: last?.verdict ?? null,
    choice: last?.choice ?? "",
    partAnswers: last?.partAnswers ?? {},
    stock: last?.stock ?? "",
    suggestedText: last?.suggestedText ?? "",
    comment: last?.comment ?? "",
  });
  const [form, setForm] = useState<FormState>(initial);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<FormState>) => {
    setForm((f) => ({ ...f, ...patch }));
    setDirty(true);
  };

  async function save(verdict: Verdict) {
    if (!reviewer.trim()) {
      setError("Please type your name at the top of the page first, then press Save again.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/packaging/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemType, itemKey, ...form, verdict, stock: form.stock || null, reviewer }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Could not save");
      setForm((f) => ({ ...f, verdict }));
      setDirty(false);
      onSaved(j.feedback as Feedback);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return { form, set, dirty, busy, error, save };
}

const textareaCls = "w-full rounded-xl border-2 border-slate-400 p-4 text-xl focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-200";

/** One-line summary of an answer; multi-part questions list each line ("Clear poly bags: 1–2 weeks"). */
const summarize = (f: Feedback, parts?: { id: string; label: string }[]) =>
  [
    f.verdict === "answered" ? null : VERDICT_LABEL[f.verdict],
    f.choice,
    ...(f.partAnswers && parts ? parts.filter((p) => f.partAnswers![p.id]).map((p) => `${p.label}: ${f.partAnswers![p.id]}`) : []),
    f.stock && STOCK_LABEL[f.stock],
    f.suggestedText,
    f.comment,
  ]
    .filter(Boolean)
    .join(" · ");

const NumberBadge = ({ n }: { n: string }) => <span className="shrink-0 rounded-lg bg-slate-800 px-2.5 py-0.5 font-mono text-lg font-bold text-white">{n}</span>;

/** A big, whole-box-clickable answer option with a large round marker. */
function ChoiceTile({ label, selected, onClick, compact = false }: { label: string; selected: boolean; onClick: () => void; compact?: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`flex w-full items-center rounded-xl border-2 text-left focus:outline-none focus:ring-4 focus:ring-blue-300 ${
        compact ? "gap-2.5 px-3 py-2 text-base" : "gap-3 px-4 py-3 text-lg"
      } ${
        selected ? "border-blue-700 bg-blue-50 font-semibold text-blue-900" : "border-slate-300 bg-white text-slate-800 hover:border-slate-500 hover:bg-slate-50"
      }`}
    >
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[3px] ${selected ? "border-blue-700" : "border-slate-400"}`}>
        {selected && <span className="h-3 w-3 rounded-full bg-blue-700" />}
      </span>
      {label}
    </button>
  );
}

// Answer buttons sit side by side across the full-width card, wrapping on narrow screens.
const tileGrid = "grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(14rem,1fr))]";

/**
 * The yellow box: the one thing being asked, plus the specifics being judged (bullets, a sample label),
 * so everything needed to answer sits in one place directly above the answer buttons.
 */
function QuestionBox({ children, details, sample, note }: {
  children: React.ReactNode;
  details?: string[];
  sample?: { heading: string; lines: string[] };
  note?: string; // what the tool does today, in small print
}) {
  return (
    <div className="rounded-xl border-4 border-amber-400 bg-amber-50 p-4">
      <p className="text-base font-bold uppercase tracking-wide text-amber-800">❓ The question</p>
      <p className="mt-1 text-xl font-bold leading-snug text-slate-900">{children}</p>
      {((details && details.length > 0) || sample) && (
        <div className="mt-3 flex flex-col gap-6 border-t-2 border-amber-200 pt-3 text-lg lg:flex-row lg:items-start">
          {details && details.length > 0 && (
            <ul className="flex-1 list-disc space-y-1.5 pl-6">
              {details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
          {sample && (
            <div className="shrink-0">
              <SampleLabel heading={sample.heading} lines={sample.lines} />
            </div>
          )}
        </div>
      )}
      {note && <p className="mt-3 text-lg text-slate-600">{note}</p>}
    </div>
  );
}

/** "Add a note" stays a small link until it's needed, so the card isn't cluttered with an empty box. */
function NoteBox({ value, onChange, open }: { value: string; onChange: (v: string) => void; open: boolean }) {
  const [show, setShow] = useState(open || !!value);
  if (!show && !open)
    return (
      <button type="button" onClick={() => setShow(true)} className="text-lg text-blue-800 underline hover:text-blue-950">
        + Add a note
      </button>
    );
  return (
    <div className="space-y-2">
      <Prompt>{open ? "Tell us more:" : "Your note:"}</Prompt>
      <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} className={textareaCls} />
    </div>
  );
}

// The label the contract itself prints for each code list, e.g. "PACK CODE", so questions read like the contract.
const CONTRACT_LABEL: Record<string, string> = {
  method_of_preservation: "PRES MTHD",
  cleaning_drying: "CLNG/DRY",
  preservative_material: "PRESV MAT",
  wrapping_material: "WRAP MAT",
  cushioning_material: "CUSH/DUNN MAT",
  cushioning_thickness: "CUSH/DUNN THKNESS",
  unit_intermediate_container: "UNIT CONT / INTRMDTE CONT",
  optional_procedures: "OPI",
  quantity_codes: "QUP / INTRMDTE CONT QTY",
  packing_code: "PACK CODE",
  special_marking: "SPECIAL MARKING CODE",
};
const contractLabel = (c: CodeItem) => CONTRACT_LABEL[c.dictionary] ?? c.dictionaryLabel;

/** What a card needs to show and change photos. */
interface PhotoKit {
  reviewer: string;
  photosFor: (t: ItemType, k: string) => Photo[];
  onChange: (all: Photo[]) => void;
  all: Photo[];
}

/**
 * Shrink a photo before upload: longest side 1600 px, JPEG at 80%. Photos are stored inside the database,
 * so a 5 MB phone picture becomes a few hundred KB. Re-encoding also drops the camera's location data.
 */
async function shrinkPhoto(file: File): Promise<Blob> {
  const MAX_SIDE = 1600;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("That file isn't a photo this browser can open. Please pick a JPG or PNG.");
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; // transparent PNG areas would turn black in a JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not prepare the photo"))), "image/jpeg", 0.8),
  );
}

/** Upload/remove example photos for one card. Photos save right away, separate from the answer. */
function usePhotoUpload(itemType: ItemType, itemKey: string, kit: PhotoKit) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    if (!kit.reviewer.trim()) {
      setError("Please type your name at the top of the page first, then add the photo again.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let all = kit.all;
      for (const file of Array.from(files)) {
        const body = new FormData();
        body.set("itemType", itemType);
        body.set("itemKey", itemKey);
        body.set("reviewer", kit.reviewer);
        body.set("file", await shrinkPhoto(file), file.name.replace(/\.[^.]+$/, "") + ".jpg");
        const res = await fetch("/api/packaging/review/photos", { method: "POST", body });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error ?? "Could not save the photo");
        all = [...all, j.photo as Photo];
        kit.onChange(all);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    if (!window.confirm("Remove this photo?")) return;
    const res = await fetch(`/api/packaging/review/photos/${id}`, { method: "DELETE" });
    if (res.ok) kit.onChange(kit.all.filter((p) => p.id !== id));
  }

  return { busy, error, upload, remove };
}

/** Thumbnails of a card's photos (click to open full size, × to remove). Nothing when there are none. */
function PhotoThumbs({ photos, onRemove }: { photos: Photo[]; onRemove: (id: number) => void }) {
  if (!photos.length) return null;
  return (
    <div className="flex flex-wrap gap-3">
      {photos.map((p) => (
        <div key={p.id} className="relative">
          <a href={`/api/packaging/review/photos/${p.id}`} target="_blank" rel="noreferrer" title={p.originalName ?? "Photo"}>
            {/* eslint-disable-next-line @next/next/no-img-element -- served from our own API, no optimisation needed */}
            <img src={`/api/packaging/review/photos/${p.id}`} alt={p.caption ?? p.originalName ?? "Example photo"} className="h-24 w-24 rounded-lg border-2 border-slate-300 object-cover" />
          </a>
          <button
            type="button"
            onClick={() => onRemove(p.id)}
            className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white font-bold text-red-700 shadow ring-1 ring-slate-300"
            aria-label="Remove photo"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

/** Small "Add a photo" button that sits on the right of the Save row. */
function AddPhotoButton({ busy, count, onFiles }: { busy: boolean; count: number; onFiles: (files: FileList | null) => Promise<void> }) {
  return (
    <label
      className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-3 py-2 text-base font-medium text-slate-600 hover:bg-slate-50 ${busy ? "opacity-50" : ""}`}
    >
      📷 {busy ? "Saving photo…" : count ? "Add another photo" : "Add a photo"}
      <input type="file" accept="image/*" multiple className="sr-only" disabled={busy} onChange={(e) => void onFiles(e.target.files).then(() => (e.target.value = ""))} />
    </label>
  );
}

// Answers like "We do it differently — tell us how" open the note box automatically.
const asksForMore = (s?: string | null) => !!s && /tell us|explain|name it/i.test(s);

function Prompt({ children }: { children: React.ReactNode }) {
  return <p className="text-lg font-bold text-slate-800">{children}</p>;
}

/** An answered item shrinks to a short box with a stamp; "Change my answer" opens it again. */
function AnsweredRow({ number, title, summary, photos = 0, onEdit }: { number: string; title: string; summary: string; photos?: number; onEdit: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border-2 border-emerald-400 bg-emerald-50 px-5 py-4">
      <span className="shrink-0 font-mono text-xl font-bold text-slate-600">{number}</span>
      <div className="min-w-0 flex-1">
        <div className="text-lg font-medium text-slate-800">{title}</div>
        {summary && <div className="text-lg text-slate-600">Your answer: {summary}</div>}
        {photos > 0 && <div className="text-lg text-slate-600">📷 {photos} photo{photos === 1 ? "" : "s"}</div>}
      </div>
      <span className="shrink-0 -rotate-6 rounded-md border-4 border-emerald-600 px-3 py-1 text-lg font-extrabold uppercase tracking-widest text-emerald-700">
        ✓ Answered
      </span>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 rounded-xl border-2 border-slate-400 bg-white px-5 py-3 text-lg font-semibold text-slate-800 hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-blue-300"
      >
        ✏️ Change my answer
      </button>
    </div>
  );
}

/** A multi-part question: one row of answer buttons per line ("Clear poly bags: 1–2 weeks"). */
function PartsPicker({ parts, choices, answers, onPick }: {
  parts: { id: string; label: string; choices?: string[] }[];
  choices: string[];
  answers: Record<string, string>;
  onPick: (partId: string, choice: string) => void;
}) {
  return (
    <div className="space-y-4">
      <Prompt>Pick one answer for each line:</Prompt>
      {parts.map((p, i) => (
        <div key={p.id} className={`space-y-2 rounded-xl border-2 p-3 ${answers[p.id] ? "border-blue-200 bg-blue-50/40" : "border-slate-200"}`}>
          <p className="text-lg font-bold">
            {i + 1}. {p.label}
          </p>
          <div role="radiogroup" aria-label={p.label} className="grid gap-2 sm:grid-cols-3 lg:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]">
            {(p.choices ?? choices).map((c) => (
              <ChoiceTile key={c} compact label={c} selected={answers[p.id] === c} onClick={() => onPick(p.id, c)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function FormFooter({ disabled, hint = "Pick an answer above first", busy, onSave, onCancel, dirty, error, right }: {
  disabled: boolean;
  hint?: string;
  busy: boolean;
  onSave: () => void;
  onCancel?: () => void;
  dirty: boolean;
  error: string | null;
  right?: React.ReactNode; // e.g. the Add a photo button, pushed to the right end of the row
}) {
  return (
    <div className="space-y-3 border-t-2 border-slate-100 pt-4">
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={disabled || busy}
          onClick={onSave}
          className="rounded-xl bg-emerald-700 px-7 py-3 text-xl font-bold text-white shadow hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 disabled:shadow-none"
        >
          {busy ? "Saving…" : "💾 Save my answer"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-xl px-4 py-3 text-xl text-slate-600 underline hover:text-slate-900">
            Cancel
          </button>
        )}
        {disabled && !busy && <span className="text-lg text-slate-500">{hint}</span>}
        {!disabled && dirty && !busy && <span className="text-lg font-semibold text-amber-700">Not saved yet</span>}
        {right && <div className="ml-auto">{right}</div>}
      </div>
      {error && <p className="rounded-xl border-2 border-red-300 bg-red-50 p-4 text-xl font-semibold text-red-800">{error}</p>}
    </div>
  );
}

/** Questions arrive ranked (most contracts first, open questions next, SPIs last); a heading marks where each of the later groups starts. */
function Round2List({ items, latest, reviewer, onSaved, photoKit }: {
  items: NumberedQuestion[];
  latest: Map<string, Feedback>;
  reviewer: string;
  onSaved: (f: Feedback) => void;
  photoKit: PhotoKit;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold">Round 2: Follow-up questions</h2>
        <p className="text-xl text-slate-700">
          Thank you for finishing the first round — we already changed the tool based on your answers and the two guides you sent. These {items.length} questions
          follow up on a few answers that didn&rsquo;t quite agree, and on things the guides raised. &ldquo;Not sure&rdquo; is still a good answer.
        </p>
      </div>
      {items.map((q, i) => (
        <div key={q.id} id={anchorId("question", q.id)} className={`scroll-mt-40 ${i > 0 ? "border-t-4 border-black pt-6" : ""}`}>
          <QuestionCard q={q} last={latest.get(fbKey("question", q.id))} reviewer={reviewer} onSaved={onSaved} photoKit={photoKit} />
        </div>
      ))}
    </div>
  );
}

function QuestionList({ data, items, latest, reviewer, onSaved, photoKit }: {
  data: Data;
  items: NumberedQuestion[];
  latest: Map<string, Feedback>;
  reviewer: string;
  onSaved: (f: Feedback) => void;
  photoKit: PhotoKit;
}) {
  const group = (q: NumberedQuestion) => (q.askLast ? "spi" : q.section === "shop" ? "shop" : "main");
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold">Part 1: Questions</h2>
        <p className="text-xl text-slate-700">
          Everything you need is in the <b className="bg-amber-100 px-1">yellow box</b> on each card, with the answers right below it. Click a contract
          line if you want to see all of its codes. The ones that come up on the most contracts are first.
        </p>
        <p className="text-xl text-slate-700">
          Our tool puts a flag on every contract: <b className="text-red-700">RED</b> = star / custom
          foam packaging (5–7 weeks, very expensive), <b className="text-amber-700">YELLOW</b> = we have to buy packaging (3–4 weeks),{" "}
          <b className="text-emerald-700">GREEN</b> = we have everything on the shelf.
        </p>
      </div>
      {items.map((q, i) => {
        const prev = items[i - 1];
        const heading = prev && group(prev) !== group(q) ? group(q) : null;
        return (
          <div key={q.id} className={`space-y-5 ${i > 0 ? "border-t-4 border-black pt-6" : ""}`}>
            {heading === "shop" && (
              <GroupHeading title="Your know-how" text="Open questions — write as much or as little as you like." />
            )}
            {heading === "spi" && (
              <GroupHeading
                title="Rare ones: Special Packaging Instructions (SPIs)"
                text="These only came up on a few contracts. “Don't know — need to see the SPI” is a perfectly good answer."
              />
            )}
            <div id={anchorId("question", q.id)} className="scroll-mt-40">
              <QuestionCard q={q} last={latest.get(fbKey("question", q.id))} reviewer={reviewer} onSaved={onSaved} photoKit={photoKit} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** A mock-up of a printed label, so the reviewer can compare it with what we actually put on boxes. */
function SampleLabel({ heading, lines }: { heading: string; lines: string[] }) {
  return (
    <div className="space-y-2">
      <p className="text-lg font-bold text-slate-600">{heading}:</p>
      <div className="inline-block min-w-[22rem] rounded-sm border-4 border-black bg-white px-6 py-4 font-mono text-xl font-bold uppercase leading-relaxed shadow-md">
        {lines.map((l) =>
          l.startsWith("[") ? (
            <div key={l} className="mt-2 flex items-center gap-3 text-base">
              <span className="flex h-14 w-14 items-center justify-center border-2 border-black text-4xl leading-none">▦</span>
              {l.replace(/^\[\s*|\s*\]$/g, "")}
            </div>
          ) : (
            <div key={l}>{l}</div>
          ),
        )}
      </div>
    </div>
  );
}

function GroupHeading({ title, text }: { title: string; text: string }) {
  return (
    <div className="space-y-1 rounded-xl bg-slate-800 px-5 py-4 text-white">
      <h3 className="text-2xl font-bold">{title}</h3>
      <p className="text-xl text-slate-100">{text}</p>
    </div>
  );
}

function QuestionCard({ q, last, reviewer, onSaved, photoKit }: {
  q: NumberedQuestion;
  last?: Feedback;
  reviewer: string;
  onSaved: (f: Feedback) => void;
  photoKit: PhotoKit;
}) {
  const photos = photoKit.photosFor("question", q.id);
  const photo = usePhotoUpload("question", q.id, photoKit);
  const [editing, setEditing] = useState(!last);
  const { form, set, dirty, busy, error, save } = useFeedbackForm("question", q.id, last, reviewer, (f) => {
    onSaved(f);
    setEditing(false);
  });
  const open = q.kind === "question";
  const parts = q.parts && q.parts.every((p) => p.choices ?? q.partChoices) ? q.parts : undefined;
  const partsLeft = parts ? parts.filter((p) => !form.partAnswers[p.id]).length : 0;

  if (last && !editing)
    return (
      <AnsweredRow number={q.tag} title={`${q.title} — ${q.question}`} summary={summarize(last, q.parts)} photos={photos.length} onEdit={() => setEditing(true)} />
    );

  return (
    // Reads straight down: title → contract (one line each, expandable) → the question with its specifics → the answers.
    <div className="space-y-4 rounded-2xl border-2 border-slate-300 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <NumberBadge n={q.tag} />
        <h3 className="text-2xl font-bold leading-snug">{q.title}</h3>
        {q.usedIn > 0 && (
          <span className="rounded-full bg-amber-100 px-4 py-1 text-lg font-bold text-amber-900">
            {q.appliesTo === "all" ? "Every contract" : `On ${q.usedIn} of our contracts`}
          </span>
        )}
      </div>
      {q.evidence.length > 0 && (
        <div className="space-y-2">
          {q.evidence.map((e) => (
            <ContractEvidenceBox key={e.docNumber} e={e} large collapsed />
          ))}
        </div>
      )}

      <div className="space-y-5">
        <QuestionBox details={q.details} sample={q.sample} note={q.assumption}>
          {q.question}
        </QuestionBox>
        {parts ? (
          <PartsPicker
            parts={parts}
            choices={q.partChoices ?? []}
            answers={form.partAnswers}
            onPick={(id, c) => set({ partAnswers: { ...form.partAnswers, [id]: c } })}
          />
        ) : q.choices ? (
          <div className="space-y-3">
            <Prompt>Pick one:</Prompt>
            <div className={tileGrid}>
              {q.choices.map((c) => (
                <ChoiceTile key={c} label={c} selected={form.choice === c} onClick={() => set({ choice: c })} />
              ))}
            </div>
          </div>
        ) : open ? (
          <div className="space-y-2">
            <Prompt>Your answer:</Prompt>
            <textarea
              rows={5}
              value={form.suggestedText}
              onChange={(e) => set({ suggestedText: e.target.value })}
              placeholder={q.answerHint}
              className={textareaCls}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <Prompt>Pick one:</Prompt>
            <div className={tileGrid}>
              {(["ok", "change", "unsure"] as const).map((v) => (
                <ChoiceTile key={v} label={VERDICT_LABEL[v]} selected={form.verdict === v} onClick={() => set({ verdict: v })} />
              ))}
            </div>
          </div>
        )}
        {!open && form.verdict === "change" && (
          <div className="space-y-2">
            <Prompt>What should it say instead? Write it the way you&rsquo;d explain it to a new packer:</Prompt>
            <textarea rows={4} value={form.suggestedText} onChange={(e) => set({ suggestedText: e.target.value })} className={textareaCls} />
          </div>
        )}
        {(!open || q.choices || parts) && (
          <NoteBox
            value={form.comment}
            onChange={(v) => set({ comment: v })}
            open={asksForMore(form.choice) || Object.values(form.partAnswers).some(asksForMore)}
          />
        )}
        <PhotoThumbs photos={photos} onRemove={(id) => void photo.remove(id)} />

        <FormFooter
          disabled={parts ? partsLeft > 0 : (!open && !form.verdict) || (open && !form.choice && !form.suggestedText.trim())}
          hint={parts && partsLeft > 0 ? `${partsLeft} line${partsLeft === 1 ? "" : "s"} still need an answer` : undefined}
          busy={busy}
          onSave={() => void save(open ? "answered" : form.verdict!)}
          onCancel={last ? () => setEditing(false) : undefined}
          dirty={dirty}
          error={error ?? photo.error}
          right={<AddPhotoButton busy={photo.busy} count={photos.length} onFiles={photo.upload} />}
        />
      </div>
    </div>
  );
}

function CodeList({ codes, latest, reviewer, onSaved, photoKit }: {
  codes: CodeItem[];
  latest: Map<string, Feedback>;
  reviewer: string;
  onSaved: (f: Feedback) => void;
  photoKit: PhotoKit;
}) {
  const [dictionary, setDictionary] = useState("");
  const [onlyUsed, setOnlyUsed] = useState(true);
  const [q, setQ] = useState("");

  const dictionaries = useMemo(() => [...new Map(codes.map((c) => [c.dictionary, c.dictionaryLabel])).entries()], [codes]);
  const needle = q.trim().toLowerCase();
  const shown = codes.filter(
    (c) =>
      (!dictionary || c.dictionary === dictionary) &&
      (!onlyUsed || c.usedIn > 0) &&
      (!needle || [c.code, c.title, c.plainEnglish, c.shortLabel].some((s) => s?.toLowerCase().includes(needle))),
  );

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-3xl font-bold">Part 2: What each code means</h2>
        <p className="text-xl text-slate-700">
          These are the packaging codes on our past contracts, sorted so the ones that come up most often are first. For each one: is what we tell the packer correct? For boxes, bags and materials,
          also tell us if we keep it on the shelf or have to buy it.
        </p>
      </div>
      <details className="rounded-xl border-2 border-slate-200 bg-white p-4 text-lg">
        <summary className="cursor-pointer select-none font-semibold">Looking for a particular code? Click here to search</summary>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <select value={dictionary} onChange={(e) => setDictionary(e.target.value)} className="rounded-xl border-2 border-slate-400 px-3 py-3 text-lg">
            <option value="">All kinds of codes</option>
            {dictionaries.map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a code, e.g. BL" className="w-64 rounded-xl border-2 border-slate-400 px-4 py-3 text-lg" />
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={!onlyUsed} onChange={(e) => setOnlyUsed(!e.target.checked)} className="h-6 w-6" /> Also show codes we&rsquo;ve never had
          </label>
        </div>
      </details>
      {shown.map((c, i) => (
        <div key={c.key} id={anchorId("code", c.key)} className={`scroll-mt-40 ${i > 0 ? "border-t-4 border-black pt-5" : ""}`}>
          <CodeCard c={c} last={latest.get(fbKey("code", c.key))} reviewer={reviewer} onSaved={onSaved} photoKit={photoKit} />
        </div>
      ))}
      {shown.length === 0 && <p className="text-xl text-slate-500">No codes match.</p>}
    </div>
  );
}

function CodeCard({ c, last, reviewer, onSaved, photoKit }: {
  c: CodeItem;
  last?: Feedback;
  reviewer: string;
  onSaved: (f: Feedback) => void;
  photoKit: PhotoKit;
}) {
  const photos = photoKit.photosFor("code", c.key);
  const photo = usePhotoUpload("code", c.key, photoKit);
  const [editing, setEditing] = useState(!last);
  const { form, set, dirty, busy, error, save } = useFeedbackForm("code", c.key, last, reviewer, (f) => {
    onSaved(f);
    setEditing(false);
  });

  if (last && !editing)
    return (
      <AnsweredRow
        number={`C${c.number}`}
        title={`Code ${c.code} — ${c.shortLabel ?? c.dictionaryLabel}`}
        summary={summarize(last)}
        photos={photos.length}
        onEdit={() => setEditing(true)}
      />
    );

  const label = c.shortLabel ?? c.plainEnglish ?? c.title ?? "";
  // Ready-made alternatives so "Needs a change" is a click, not typing: the official wording and the tool's longer explanation.
  // (a full stop after "e.g" / "i.e" or inside "in." does not end a sentence — C60's wording was cut off at "(e.g" before)
  const firstSentence = c.plainEnglish?.split(/(?<!\b(?:e\.g|i\.e|in|etc)\.)(?<=\.)\s/)[0]?.replace(/\.$/, "");
  const alternatives = [...new Set([c.title, firstSentence].filter((s): s is string => !!s && s !== label))];
  const ownWords = form.suggestedText !== "" && !alternatives.includes(form.suggestedText);

  return (
    <div className="space-y-4 rounded-2xl border-2 border-slate-300 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <NumberBadge n={`C${c.number}`} />
        <span className="font-mono text-3xl font-bold">{c.code}</span>
        <span className="text-xl text-slate-600">{c.dictionaryLabel}</span>
        {c.usedIn > 0 ? (
          <span className="rounded-full bg-amber-100 px-4 py-1 text-lg font-bold text-amber-900">
            #{c.number} most common — on {c.usedIn} of our contracts
          </span>
        ) : (
          <span className="text-lg text-slate-500">Not on our contracts yet</span>
        )}
      </div>

      <div className="space-y-5">
        <QuestionBox
          note={`Military standard: ${c.title ?? "—"}${c.ref ? ` (MIL-STD-2073-1E ${c.ref})` : ""}${c.examples.length ? ` · Seen on ${c.examples.join(", ")}` : ""}`}
        >
          When a contract says <span className="font-mono">{contractLabel(c)} {c.code}</span>, should the packer be told
          &ldquo;<span className="text-blue-900">{label}</span>&rdquo;?
        </QuestionBox>
        <div className={tileGrid}>
          {(["ok", "change", "unsure"] as const).map((v) => (
            <ChoiceTile key={v} label={VERDICT_LABEL[v]} selected={form.verdict === v} onClick={() => set({ verdict: v })} />
          ))}
        </div>
        {form.verdict === "change" && (
          <div className="space-y-3">
            <Prompt>Pick a better wording:</Prompt>
            <div className={tileGrid}>
              {alternatives.map((a) => (
                <ChoiceTile key={a} label={a} selected={form.suggestedText === a} onClick={() => set({ suggestedText: a })} />
              ))}
              <ChoiceTile label="✍️ I'll write my own" selected={ownWords} onClick={() => set({ suggestedText: ownWords ? form.suggestedText : " " })} />
            </div>
            {ownWords && (
              <textarea
                rows={2}
                autoFocus
                value={form.suggestedText.trimStart()}
                onChange={(e) => set({ suggestedText: e.target.value || " " })}
                placeholder="How should it say it?"
                className={textareaCls}
              />
            )}
          </div>
        )}
        {c.isContainer && (
          <div className="space-y-3">
            <QuestionBox>
              Do we keep &ldquo;{label}&rdquo; (<span className="font-mono">{c.code}</span>) on the shelf, or do we have to buy it?
            </QuestionBox>
            <div className={tileGrid}>
              {(Object.keys(STOCK_LABEL) as Stock[]).map((s) => (
                <ChoiceTile key={s} label={STOCK_LABEL[s]} selected={form.stock === s} onClick={() => set({ stock: s })} />
              ))}
            </div>
          </div>
        )}
        <NoteBox value={form.comment} onChange={(v) => set({ comment: v })} open={false} />
        <PhotoThumbs photos={photos} onRemove={(id) => void photo.remove(id)} />
        <FormFooter
          disabled={!form.verdict}
          busy={busy}
          onSave={() => void save(form.verdict!)}
          onCancel={last ? () => setEditing(false) : undefined}
          dirty={dirty}
          error={error ?? photo.error}
          right={<AddPhotoButton busy={photo.busy} count={photos.length} onFiles={photo.upload} />}
        />
      </div>
    </div>
  );
}

function Answers({ data }: { data: Data }) {
  const questions = new Map(data.questions.items.map((q) => [q.id, `${q.tag}. ${q.question}`]));
  const codes = new Map(data.codes.map((c) => [c.key, `C${c.number}. Code ${c.code} — ${c.dictionaryLabel}`]));
  const parts = new Map(data.questions.items.map((q) => [q.id, q.parts]));
  if (!data.feedback.length) return <p className="text-xl text-slate-500">No answers yet.</p>;
  return (
    <div className="space-y-3">
      {data.feedback.map((f) => (
        <div key={f.id} className="rounded-xl border-2 border-slate-200 bg-white p-4 text-lg">
          <p className="font-semibold">{(f.itemType === "question" ? questions.get(f.itemKey) : codes.get(f.itemKey)) ?? f.itemKey}</p>
          <p>{summarize(f, f.itemType === "question" ? parts.get(f.itemKey) : undefined) || VERDICT_LABEL[f.verdict]}</p>
          <p className="text-base text-slate-500">
            {f.reviewer}, {new Date(f.createdAt).toLocaleDateString()}
          </p>
        </div>
      ))}
    </div>
  );
}
