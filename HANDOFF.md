# Handoff: Packaging Decoder, Rev 0.1

Written 2026-10-30 by the Claude session that built the app on the Dell PC, for the session that develops it on the MacBook from now on. Read this, then [README.md](README.md), [deploy/MAC_MINI_SETUP.md](deploy/MAC_MINI_SETUP.md) and [REV.md](REV.md).

## What it is

It turns the MIL-STD-2073-1 packaging codes on DLA contracts into plain-English packing steps for shipping, purchasing and management. It flags packaging that costs money or time:

- 🔴 star packaging (special foam boxes, 5–7 weeks per the expert; it was 8–10 before his review)
- 🟡 materials to buy ahead (weather-resistant boxes, desiccant, MIL-DTL-117 bags; 3–4 weeks)
- 🟢 shelf stock

The **Expert review** tab lets our retired packaging veteran (40 years on the job) check every assumption and code translation before we rely on them. Later the app folds into Production Assistant at `/packaging` (module key `packaging`).

## Architecture

| Layer | Where | Notes |
|---|---|---|
| Decoder engine | `src/lib/decoder/` | Pure TypeScript with no database or file I/O. `parse.ts` reads a contract's packaging block, `flags.ts` applies the red/yellow/green rules and `recipe.ts` builds steps and the materials list. Reuse it as-is when the app moves into Production Assistant. |
| Database | `src/lib/db/` | One better-sqlite3 connection per process (WAL). `upgrades.ts` holds the schema steps and `seed.ts` loads `seed/*.json`. |
| Review | `src/lib/review.ts`, `src/lib/photos.ts`, `src/components/ReviewBoard.tsx` | Questions, ranking, answers and photos. |
| Access | `src/lib/auth/access.ts` (placeholder: everyone gets Edit), `src/lib/auth/admin.ts` (admin password) | |
| Pages | `/` decoder, `/history`, `/codes`, `/review`, `/review/worksheet` (printable) | |
| API | `src/app/api/packaging/*` | Listed in the README. |

### Upgrade steps (`src/lib/db/upgrades.ts`)

These run in order at server start, and every release must boot on the previous production schema. Never edit a released step; add a new one. A dev server only picks up a new step after a restart.

| v | What |
|---|---|
| 1 | Base schema: code dictionaries, flag rules, packaging records, activity log, app_meta |
| 2 | `review_feedback`: the expert's answers. Append-only, and the latest row per item wins. |
| 3 | `code_entry.short_label`, plus a forced re-seed |
| 4 | `review_feedback.part_answers`: one answer per line for multi-part questions (JSON) |
| 5 | `review_photo`: photo metadata (v5 kept the images as files) |
| 6 | Photos move into the database: `review_photo_data` (BLOB, cascade delete). `file_name` is dropped. No photos existed anywhere, so nothing was migrated. |

## Seed files: how they were made and how to change them

`seed/` holds three files. Each has a `version` field. The app reloads a file into the database at start whenever its `version` differs from the one recorded in `app_meta`, so **bump `version` whenever you edit a file by hand**.

| File | Size | Made by | Change it by |
|---|---|---|---|
| `reference.json` | 644 KB | `build_app_seed.py` on the Dell. It merged the code dictionaries (typed up from MIL-STD-2073-1 Change 4), `short_labels.json` and `flag_rules.json`. | Editing it directly. Flag rules edited in the app (a future admin feature) are never overwritten by a re-seed. |
| `history.json` | 316 KB | On the Dell, by three steps: PyMuPDF text extraction of the ~408 PDFs in a copy of our contracts folder → `parse_packaging.py` → de-duplication → `build_app_seed.py`. The result is 271 packaging blocks from 231 awards. 8 scanned PDFs had no text and were typed in by hand. | Leaving it alone; new contracts will come in through the app (see below). |
| `review_questions.json` | 40 KB | Written by hand. Each item has an id, section, kind, title, question, details, a sample, choices or parts, and the contracts it applies to. Answers are keyed by `id`, so **never reuse or rename an id** — add a new one instead. | Editing it directly. |

**Decision:** the Python scripts, the PDFs, the standards and the raw extracted text stay on the Dell. They are not in this repo, as the move instructions required. From now on `seed/*.json` is the source of truth. If the MacBook ever needs to rebuild `history.json` from scratch, ask the owner to copy the Dell's `Packaging Tool/scripts` and `data/reference` folders across; they need Python 3 and PyMuPDF.

## Expert review workflow

- `/review` has two tabs:
  - **Questions:** 40 in all, Q1–Q40. They are ranked by how many of our contracts each one affects; the shop's own know-how comes next, and the rare SPI (special packaging instruction) questions come last.
  - **Codes:** 69, C1–C69. Each is a code that appears on our contracts, ranked by how often, with its short label and plain-English wording for the expert to confirm or correct.
- The page asks for the reviewer's name once per browser (localStorage) and saves it with every answer and photo.
- Answers are `ok`, `change`, `unsure` or `answered`, plus the chosen option, per-line answers, a "do we stock it?" answer, suggested wording and a note.
- Photos save as soon as they are added. The browser shrinks each one first (longest side 1600 px, JPEG 80%, which also drops GPS data). The server checks the real type from the file's first bytes and refuses anything over 4 MB.
- The expert can remove his own photos without the admin password, because that's part of answering.
- `/review/worksheet` prints the same questions on paper.
- To read the answers from another computer: `GET /api/packaging/review` (JSON), `GET /api/packaging/review/export` (CSV, one row per part answer) and `GET /api/packaging/review/photos/:id`. These are open on the plant network during the review period.
- **Next:** when answers come in, turn them into changes: short labels, flag rules, step wording and follow-up questions. Two questions were flagged early for the expert:
  - Are the cable-assembly SPIs (AM12001059, AM10895488, AM10895489) really star packaging?
  - Should the NS/NV reusable boxes be 🔴 or 🟡?

## Expert review results (2026-11-04)

Perry Stone answered all 109 items: 39 OK, 25 changed, 7 unsure, and 38 questions answered. He added no photos. Rev 0.2 applies what was clear (see REV.md). The raw answers stay in the mini's database (`GET /api/packaging/review`).

**How to read his "Needs a change" answers.** The code card asked only whether the short label was right, and offered two ready-made wordings: the official title, or the first sentence of our explanation.
- For materials he picked the spec callout; for steps and markings, the full instruction.
- So he prefers precise spec wording over our friendly names.
- His wording is now each code's `short_label`.

**Confirmed by him.** These now match what the tool does:
- OPI M and O;
- PACK CODE U (palletize over 25 boxes) and Q at Level B (a weather-resistant cardboard box);
- AAA limits, and a count in the instructions wins over AAA;
- BL, A1, Method 31 and 32 need a MIL-spec bag; A2, D3951 and Method 10 can use a commercial bag;
- "BAG BL WITHIN BOX ED" means the part goes in the bag and the bag goes in the box;
- NR and NW are star packaging;
- every DLA "always" rule is followed;
- the exact bag the contract names is always used.

**Shop practice that differs from the standard.** These are not changed in the tool; the owner needs to decide.
1. Method 31: "we don't do the seal tests". Owner decision (2026-11-04): we don't need them. The tool says the seal must be continuous, with no separate leak or seal test.
2. Methods 32 and 42: "we don't blunt the corners" of the inner box. Owner decision: the tool doesn't mention corners at all.
3. Labels: our linear (Code 39) bar code is fine. Both guides show it as the normal label; the 2D (PDF417) symbol is needed only for items with a UII (IUID). Settled from the guides.

## Packaging guides from the expert (docs/expert-guides, added 2026-11-04)

Public documents (Distribution A / unlimited):
- `DoD_PackagingandMarking_Guide.pdf`: DCMA "Packaging and Marking Guide for DoD", April 2014, 42 pages.
- `J3_DLAPackagingandMarkingGuide_250401.pdf`: "DLA Packaging and Marking Guide", April 2025, 74 slides.

What the app uses from them (Rev 0.2):
- A diagram for each preservation method (10, 20, 31–33, 41–45, 51–55) and the label examples. They're rendered into `public/guides/*.jpg` and shown under "See the picture" on the step.
- The "Mark it" step: what goes on the ID label, which bar codes go where, and the MSL. It also says where the label goes: on the bag AND the outer box for 42/52; on the bag and the box when a box makes the unit pack for 31/33/41/51; and for 43/53 the bag is the unit pack while the outer container gets the shipping marks.
- The Method 50 label on desiccant packs.
- A 2D-symbol warning when the contract text mentions a UII, IUID or DFARS 252.211-7003. None of the 271 past blocks do.
- The cost of a marking defect, from the DLA guide: DLA finds a defect on 1 in 15 receipts, bills the contractor (procurement note C14), holds payment over $1,000, and the defect counts against SPRS.

Where the guides differ from shop practice (the owner decided to follow shop practice; noted here so it isn't lost):
- DoD guide p. 26–27: MIL-STD-2073-1 Appendix G makes the contractor responsible for the leak and heat-seal tests (Table G-II), and lists "interior unit container corners not blunted" as an inspection defect. The Method 32 and 42 diagrams show corners being blunted.

Not used yet, possible later:
- RFID tags (DFARS 252.211-7006) for some destinations.
- IP027 (FSC 5961/5962 semiconductors and microcircuits).
- Shelf-life label formats (Type I/II, cured date).
- Pallet load limits from MIL-STD-147: 43 x 52 x 54 in., 3,000 lb.

**His answers conflict.** These need a follow-up question.
- The question said BL and foil bags (BS, SE, B3, SF, SK) are "on the shelf", but the BL and BS code cards said "we have to buy it (3–4 weeks)". The tool keeps them yellow.
- Regular boxes (D1, D3, D4, DO, EC, 10) were "buy" on the code cards, but "sometimes have to order" in the shelf question.
  - They are left green.
  - Making them yellow would move 38 more of the 271 past blocks from green to yellow.

**Still unknown.**
- NS and NV: red or yellow?
- All six SPI questions: he needs to see each SPI. The all-ZZ question: not sure.
- PRESV MAT 49, the desiccant methods (51–53) and their stock, MIL-PRF-23199, OPI E and A.
- Weather-resistant boxes other than ED.
- The suppliers he picked "Other" for: star boxes, ED boxes and pallets.
- His photos (he has all five).
- Lead times not used by the flags yet: desiccant under 1 week, heat-treated wood 1–2 weeks.



- **Stack and approach:** same stack as the fleet. Own SQLite file. No separate user system. Global Shop is read-only; contracts match orders by PO # = contract number.
- **Bags:**
  - Code BL is a MIL-DTL-117 heat-sealed bag that must be bought; it is not a regular commercial bag.
  - A2, and contracts under ASTM D3951, allow a regular commercial bag.
  - Across our 271 blocks:

    | Bag | Blocks | Share |
    |---|---|---|
    | MIL-spec bag | 125 | 46% |
    | No bag | 77 | 28% |
    | Commercial bag OK | 40 | 15% |
    | Special / SPI | 29 | 11% |

  - The decoder's wording and its 🛒 "order these" list reflect this.
- **Plain language:** every code has a 2–6 word shop label. The official military wording is kept but tucked away. The UI is built for an older, non-technical reviewer: large text and big buttons, the cards read top to bottom, and the question names the actual code.
- **Login:** during the review period the app is open on the plant network. Anything beyond review answers (flag rules, reference data, settings, deletes) must call `requireAdmin(req)`, which checks the `x-admin-password` header against `ADMIN_PASSWORD` in `.env.local`. There is no default, the password is never "admin", and if it isn't set every admin action is refused. Nothing is admin-only yet. Later the app moves to Production Assistant's single sign-on (as in the move instructions).

## Tests

```bash
npm run typecheck
npm test
```

There are 20 tests:

- the decoder rules, plus a sweep over all 271 historical blocks
- the photo byte-type check
- the admin password rules

**`npm test` never opens a database.** It only reads `seed/*.json` and calls pure functions. Nothing in it calls `getDb()` or reads `PACKAGING_DB_PATH`. Keep it that way: any future database test must create its own temporary file and must never use `PACKAGING_DB_PATH`.

## Database size

- An empty database loaded from the seeds is about **1.3 MB**.
- One review photo is about **0.1–0.4 MB** after the browser shrinks it; a 4000×3000 test image came out at 95 KB.
- At 0.3 MB per photo:

  | Photos | Database size |
  |---|---|
  | 50 | ~16 MB |
  | 200 | ~60 MB |

  Even several backup copies fit easily on a 2 GB backup stick.
- Answers are tiny (a few KB each).

## New contract PDFs: answers to the move questions

**How contracts get into the app today:** they don't. There is no runtime ingestion. History was a one-time batch on the Dell (above). For a new contract, someone pastes the packaging block, or types the codes, into the decoder.

**What has to become an app feature so nothing depends on the Dell:**

1. **PDF text extraction in Node.** `pdfjs-dist` is pure JavaScript, so there's no native build on the mini. It replaces the PyMuPDF step.
2. **Block parsing.** Already in the app (`src/lib/decoder/parse.ts`). The Python parser was only used for the first batch.
3. **De-duplication.** One award often comes as several files: SF26 award, signed copy, mods (SF30), merged "combinepdf" files. The batch dropped duplicates by contract number + NSN + identical block; the app needs the same rule, keyed by contract number (pattern `SP[A-Z0-9]{4}\d{2}[A-Z]…`) read from the text, not the file name.
4. **Scanned PDFs.** 8 of the ~408 PDFs in our copy (about 2%) had no text layer. Options: OCR with `tesseract.js` (WASM, no native build, slower), or show "no text found — paste or type the codes" and handle them by hand. At 1–4 contracts a week, the manual fallback may be enough to start.

**Network share path(s):** not decided yet. IT is setting up a new drive for this, and it isn't live. Leave the scan folder configurable, for example `PACKAGING_CONTRACTS_DIR` in `.env.local`. Per the move instructions, a missing or slow share must never break the app.

**File naming:** inconsistent, so don't depend on it. Examples from our copy:
- `SF26_SPE4A624D0122 (Signed).pdf`
- `SPE4A6-25-F-2615.pdf`
- `MOD SPE4A6245306.pdf`
- `SF18_SPE4A624Q0987.PDF`
- `SIGNED SOL SPE4A624RX454.pdf`
- `A5a - SF26_SPE4A724D0188.pdf`

Read the contract number from the PDF text instead.

**Volume:** about 1–4 new contracts a week, per the owner. The history averages about 1.5 a week (231 awards over ~3 years).

**Anything else needed from the network drives:** no. The standards (MIL-STD-2073-1, MIL-STD-129, etc.) are already distilled into `seed/reference.json`, and the app needs no drawings.

**DIBBS (assessment only, nothing built):**
- According to the owner, about **99% of our contracts come from DIBBS**, so pulling from DIBBS directly is worth a serious look.
- **For:** it doesn't depend on people saving files to the right folder. Also, the same packaging codes appear on the **solicitation** (RFQ), so the app could flag star packaging *before we bid* and feed lead time and cost into Quote Assist. That is probably worth more than flagging after award.
- **Unverified:**
  - which DIBBS award and solicitation documents can be downloaded without a login
  - whether DIBBS's terms of use and consent banner allow automated downloads
  - how stable its URLs are

  Check these by hand before designing anything.
- **Against:** the remaining ~1% (some mods, emailed documents) still needs a folder or upload path. And DIBBS outages or changes must never break the app — the same "rule zero" as for the share.
- **Suggestion:** build the folder scan first, since it's needed anyway. Then assess DIBBS solicitation pulls as a separate round together with Quote Assist.

## Open questions

1. The network share path, once IT has the new drive live, and a read-only account for user `adg` on the mini.
2. The DIBBS checks listed above.
3. What the expert says about the two early flag questions, and about everything else in the review.
4. Shop-specific materials (exact bag, box and foam part numbers we stock), so the 🛒 list can say "Uline S-1234" rather than "clear poly bag". Planned for later.
5. MIL-STD-129 shipping labels: out of scope for v1 but in scope for the final product.

## Round 2 and SPIs (owner, 2026-11-04)

- **Round 2:** Perry answers on the "Round 2: Follow-ups" tab at /review (questions `r2-*` in seed/review_questions.json, `round: 2`). Apply his answers the same way as round 1:
  - R1: change PURCHASE_CONTAINERS for BL, BS, SF and SK if he says they're on the shelf.
  - R2: regular boxes yellow or green.
  - R3: fill SUPPLIER.
  - R4/R5: the label checklist.
- **SPIs:** the owner dropped the SPI questions for contracts that already shipped. Only SPIs on contracts we still have to deliver get chased. The contracts in our history that carry an SPI, newest first:
  - SPE4A724P7503 (9384854)
  - SPE4A626V7046 (AM10895489)
  - SPE4A626PP336 (AM10936300)
  - SPE4A626PAAJ5 (AM10895488)
  - SPE4A626PAR19 and SPE4A625P4224 (AM12001059)
  - SPE4A624R0125 and SPE4A624T29NF (AG00000600)
  - SPE4A624PW586 and SPE4A624T80B6 (P10737994)

  Which of these are still open hasn't been checked yet; that needs the open-orders list.

## Round 2 results (Perry, 2026-11-04) — applied in Rev 0.4

- R1:
  - BL: "We buy them for each job" (stays yellow).
  - BS/SF/SK: "On the shelf, but big orders need buying" (now green, with a stock-check note).
- R2: regular boxes: "Keep them green — we get them in a few days".
- R3: "Star Packaging" for star boxes; "Royco or Uline" for ED boxes; "Service Pallet" for heat-treated pallets.
- R4: the label always shows NSN, CAGE, PN and name, quantity, contract number, and method and date. It **never** shows gross weight on the shipping box. Comment: the item name must come from the contract, not the ERP or drawing; DLA has written us up for that.
- R5: the MSL comes from DLA's VSM. Skids are stenciled in paint (contract, NSN, PN, quantity). Our own software prints the item ID labels (PN, NSN, description, 2D bar code at the bottom).
- R6: "make sure our instructions trump the guide or call out when they do not match".
- R7: no photos after all. Use the guide diagrams for now and take our own photos eventually.

Open from round 2:
- **Gross weight (owner to confirm):** MIL-STD-129 and both guides require it on exterior containers, and the shop never marks it. On 2026-11-05 the owner said to leave it off for now and that they will confirm, so the "Mark it" step no longer mentions it (Rev 0.4.1). If the answer is to mark it, add the line back to the ID label list in `appendCommon` in `src/lib/decoder/recipe.ts`.
- Take our own photos (BL bag, ED box, star box, labeled unit pack, finished pallet) and add them under the guide pictures.

