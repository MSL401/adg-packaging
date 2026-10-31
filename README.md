# Packaging Decoder (Rev 0.1)

Paste a DLA contract's packaging block (or type the MIL-STD-2073-1 codes) → plain-English packing steps, a nesting picture, a materials list, and a 🔴/🟡/🟢 flag for star / purchase-needed / basic packaging.

Same stack as Production Assistant, MRP and Quote Assist: **Next.js 14 (App Router), strict TypeScript, Node 22, better-sqlite3, Tailwind**. Built to move into Production Assistant at `/packaging` later.

## Pages and API

| Path | What |
|---|---|
| `/` | Decoder — paste contract text or enter codes; print packing sheet. `/?record=<id>` loads a past contract. |
| `/history` | Every packaging block from our past DLA contracts, searchable by NSN / contract / P/N, filterable by flag. |
| `/codes` | Code lookup — every Change 4 code with plain English. |
| `/review` | Expert review — our packaging veteran checks flag rules, step wording and every code translation; answers saved per item. Questions live in `seed/review_questions.json`. |
| `/review/worksheet` | The same review as a printable paper worksheet (codes on our contracts only). |
| `GET/POST /api/packaging/review` | Review items + latest feedback / save one piece of feedback |
| `GET /api/packaging/review/export` | Every feedback row as CSV (opens in Excel) |
| `GET/POST /api/packaging/review/photos`, `GET/DELETE …/photos/:id` | Example photos per question/code, stored inside the database (shrunk in the browser to 1600 px JPEG first) |
| `POST /api/packaging/decode` | `{ text?, codes?, nsn? }` → `{ parsed, flags, recipe, history }` |
| `GET /api/packaging/history?q=` | Past packaging rows |
| `GET /api/packaging/codes?dictionary=&q=&all=1` | Code entries |

## Layout

```
src/lib/decoder/   Pure TS engine (no DB/I/O): parse.ts → flags.ts → recipe.ts. Reused by every later phase.
src/lib/db/        better-sqlite3 connection, upgrade steps (upgrades.ts), seed sync (seed.ts)
src/lib/auth/      Module-access placeholder (module key "packaging") + activity log
seed/              reference.json (code dictionaries + flag rules), history.json (past contracts), review_questions.json
                   — see HANDOFF.md for how they were built and how to change them
```

## Database

- One file, `data/packaging.db` (gitignored; override with `PACKAGING_DB_PATH`). Review photos are stored inside it, so registering this one file in Production Assistant's backups covers everything.
- Schema changes are **upgrade steps** in `src/lib/db/upgrades.ts`, applied in order at server start. Never edit a released step — add a new one.
- Seed data re-syncs automatically when `seed/*.json` changes version. Flag rules edited in-app (future) are not overwritten by a re-seed.

## Run (dev)

```bash
cp .env.example .env.local   # set ADMIN_PASSWORD
npm ci
npm run dev        # http://localhost:3003
npm run typecheck
npm test           # never opens a database; includes a sweep over all 271 historical contract blocks
```

On the Windows dev PC there is no system Node; use the portable copy: `..\tools\node\node.exe ..\tools\dev-server.cjs`.

## Deploy to the Mac mini

Runs on the mini at **http://192.168.8.201:3003**, set up and deployed exactly like Quote Assist: see [deploy/MAC_MINI_SETUP.md](deploy/MAC_MINI_SETUP.md). Developed on the MacBook; the mini only pulls. Release notes: [REV.md](REV.md). Background for whoever picks this up: [HANDOFF.md](HANDOFF.md).

## Not done yet (by design)

- **Admin password**: `src/lib/auth/admin.ts` (`requireAdmin(req)`, header `x-admin-password`, value from `ADMIN_PASSWORD` in `.env.local`, no default). Nothing is admin-only yet; every future flag-rule / reference-data / settings / delete route must call it.
- **Login/module access** is a placeholder (`src/lib/auth/access.ts` always returns the shared user with Edit). Swap in Production Assistant's session + module-access check when this moves in-app or once we copy that code.
- v2: PDF upload. v3: watched folder + auto-match to orders by PO #, OCR, shop-specific materials, MIL-STD-129 labels.
