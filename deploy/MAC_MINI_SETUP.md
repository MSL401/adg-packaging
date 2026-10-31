# Mac mini setup: Packaging Decoder

**Copy how Quote Assist is set up and deployed. Don't invent a new pattern.** This file only lists what is specific to this app; the MacBook session fills in the rest from Quote Assist and the Production Assistant's FLEET.md.

| | |
|---|---|
| Port | **3003** (`next start -p 3003`) |
| launchd | LaunchAgent `com.adg.packaging` for user `adg`, `~/Library/LaunchAgents/com.adg.packaging.plist`. Run node and next directly, the way the Quote Assist plist does (not `zsh -lc npm`). Logs where the others keep theirs. |
| Node | `/usr/local/bin/node` (Node 22). `better-sqlite3` is a native module: `npm ci` must build or download it for the mini's Node and CPU. |
| Database | `data/packaging.db` inside the app folder (gitignored; created on first start). Override with `PACKAGING_DB_PATH`. **Review photos are stored inside this file**, so there is no other folder to back up. |
| Config | `.env.local` in the app folder (template: `.env.example`). Set `ADMIN_PASSWORD` (no default; never "admin"). |
| Backups | Production Assistant → Settings → Backups → extra databases: name `Packaging`, path to `data/packaging.db`. Then Back Up Now and a test restore. |
| Deploy | A `deploy-packaging` alias in `~/.zshrc` on the MacBook that works like `deploy-quote`. The mini only pulls. Upgrade steps run automatically on start. |
| First start | Starts fresh from `seed/*.json`. Don't copy the Dell's database. |

## Checks after setup

- `http://192.168.8.201:3003` loads from another PC, and Decode works.
- `/review` shows 40 questions and 69 codes.
- A test photo saves (it lands inside `data/packaging.db`, not as a file), then gets removed.
- After `launchctl kickstart -k`, answers are still there.
- MRP (3000), Production Assistant (3001), Quote Assist (3002) and Mini Tools (5500) are untouched.

## Reading the expert's answers from another computer

Open on the plant network during the review period (no login yet):

- JSON: `http://192.168.8.201:3003/api/packaging/review`
- CSV (Excel): `http://192.168.8.201:3003/api/packaging/review/export`
- A photo: `http://192.168.8.201:3003/api/packaging/review/photos/<id>`
