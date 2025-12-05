# Demo Architecture

Public demo of the librocco web-client application.

**Live URL:** https://libroc.co/demo

## Overview

The demo allows users to try librocco with pre-populated sample data without signing up or syncing. The app runs entirely in the browser with a pre-built SQLite database stored in OPFS (Origin Private File System).

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Demo System                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  librocco repo                        demo-data repo                     │
│  ─────────────                        ──────────────                     │
│  apps/sync-server/schemas/init        (github.com/librocco/demo-data)   │
│           │                                    │                         │
│           │ fetched at build time              │                         │
│           └────────────────────────────────────┤                         │
│                                                │                         │
│                                                ▼                         │
│                                    ┌─────────────────────┐               │
│                                    │  make               │               │
│                                    │  - fetch schema     │               │
│                                    │  - generate data    │               │
│                                    │  - build SQLite DB  │               │
│                                    └──────────┬──────────┘               │
│                                               │                          │
│                                               ▼                          │
│  production-demo branch              demo_db.sqlite3                     │
│           │                                   │                          │
│           │ CI: deploy-demo job               │ manual upload            │
│           ▼                                   ▼                          │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │                    R2 Bucket: librocco-demo                     │     │
│  │                                                                 │     │
│  │   /demo/index.html          /demo/demo_db.sqlite3               │     │
│  │   /demo/_app/...            (pre-built database)                │     │
│  │   (built app)                                                   │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                                    │                                     │
│                                    ▼                                     │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │                    Cloudflare Worker                            │     │
│  │                    libroc.co/* → R2 bucket                      │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                                    │                                     │
│                                    ▼                                     │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │                    User's Browser                               │     │
│  │  1. Load app from /demo/                                        │     │
│  │  2. Download demo_db.sqlite3 to OPFS                            │     │
│  │  3. Run app with local database                                 │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Demo Database Generation

### Repository
**https://github.com/librocco/demo-data**

### How It Works

The demo-data repo generates realistic sample data:

1. **Schema fetched automatically** from main librocco repo at build time:
   ```
   https://raw.githubusercontent.com/librocco/librocco/main/apps/sync-server/schemas/init
   ```
   The `crsql_as_crr` and `crsql_finalize` calls are filtered out for plain SQLite compatibility.

2. **Data generation** uses statistical models for realism:
   - GEM distribution for book popularity (Zipfian-like)
   - Geometric distribution for books per note
   - Skorokhod reflection to prevent negative stock
   - ~15,000 notes, 8 warehouses, ~160 active ISBNs

3. **Output:** `data/demo_db.sqlite3`

### Generating the Database

```bash
git clone https://github.com/librocco/demo-data.git
cd demo-data
make
# Output: data/demo_db.sqlite3
```

Prerequisites: `uv`, `curl`, `sqlite3`

### Maintenance: Column Whitelists

The `load_db.py` script uses column whitelists when loading CSV data into SQLite. When adding new columns to the schema:

1. Add column to `apps/sync-server/schemas/init` (this repo)
2. If the column needs data, update `load_db.py` whitelist in demo-data repo
3. Regenerate and upload

Example whitelist in `load_db.py`:
```python
drop_excess_cols(df_book_transactions, [
    "isbn", "quantity", "note_id", "warehouse_id",
    "updated_at", "committed_at", "last_bubbled_up"
])
```

## Uploading Demo Database

After generating, upload to R2:

```bash
# Configure rclone (one-time)
rclone config  # Add r2-demo remote with Cloudflare credentials

# Upload
rclone copy data/demo_db.sqlite3 r2-demo:librocco-demo/demo/
```

Credentials needed: `CLOUDFLARE_DEMO_ACCESS_KEY_ID`, `CLOUDFLARE_DEMO_SECRET_ACCESS_KEY`

## App Deployment

### Trigger
Push to `production-demo` branch.

### CI Job
Location: `.github/workflows/web-client-ci.yml` (job: `deploy-demo`)

Builds with:
```yaml
env:
  BASE_PATH: /demo
  PUBLIC_IS_DEMO: "true"
  PUBLIC_DEMO_DB_URL: https://libroc.co/demo/demo_db.sqlite3
```

**Note:** CI deploys the app only, not the database.

## Client-Side Behavior

### Demo Initialization
1. App checks `IS_DEMO` flag
2. Checks if demo DB exists in browser OPFS
3. If missing, downloads from `PUBLIC_DEMO_DB_URL`
4. Validates SQLite header and schema
5. Stores in OPFS as `librocco_demo_db.sqlite3`

### Reset Functionality
Users can reset via `/demo_settings`:
- Deletes existing DB from OPFS
- Downloads fresh copy
- Full page reload

### Key Files
- `src/lib/constants.ts` - `IS_DEMO`, `DEMO_DB_NAME`, `DEMO_DB_URL`
- `src/routes/+layout.ts` - Demo initialization (lines 76-88)
- `src/lib/db/cr-sqlite/core/utils.ts` - `fetchAndStoreDBFile()`
- `src/routes/demo_settings/+page.svelte` - Reset UI

## Configuration

| Variable | Description | Value |
|----------|-------------|-------|
| `PUBLIC_IS_DEMO` | Enables demo mode | `"true"` |
| `PUBLIC_DEMO_DB_URL` | Database download URL | `https://libroc.co/demo/demo_db.sqlite3` |
| `BASE_PATH` | App base path | `/demo` |

## Infrastructure

### R2 Bucket
- **Name:** `librocco-demo`
- **App path:** `/demo/`
- **DB path:** `/demo/demo_db.sqlite3`

### Cloudflare Worker
`.github/cf-worker/worker.js` routes:
- `libroc.co/*` → `librocco-demo` bucket
- `test.libroc.co/*` → `librocco-ci` bucket (CI previews)

## Maintenance Checklist

### ⚠️ When Schema Changes (IMPORTANT)

Schema changes require updating the demo database, otherwise the demo will break.

**After modifying `apps/sync-server/schemas/init`:**

1. **Check if new columns need data in demo-data repo:**
   - If adding columns to `book`, `warehouse`, `note`, or `book_transaction` tables
   - Update the whitelist in `demo-data/load_db.py` to include the new column
   - If column needs non-default values, update the data generator scripts

2. **Regenerate the demo database:**
   ```bash
   cd demo-data
   make clean && make
   ```

3. **Upload to R2:**
   ```bash
   rclone copy data/demo_db.sqlite3 r2-demo:librocco-demo/demo/
   ```

4. **Deploy app changes:**
   - Push to `production-demo` branch
   - CI will deploy the updated app

**Note:** The schema is fetched automatically at build time, so you don't need to manually copy it. However, the `load_db.py` whitelists must be updated manually when adding columns that the CSV data generators produce.

### Updating Demo Content
1. Make changes in demo-data repo
2. Run `make clean && make`
3. Upload: `rclone copy data/demo_db.sqlite3 r2-demo:librocco-demo/demo/`

### Deploying App Changes Only
1. Push to `production-demo` branch
2. CI handles the rest

## Related Files

### librocco repo
- `apps/sync-server/schemas/init` - Schema (source of truth)
- `.github/workflows/web-client-ci.yml` - `deploy-demo` job
- `.github/cf-worker/` - R2 proxy worker

### demo-data repo
- `Makefile` - Build orchestration
- `load_db.py` - CSV→SQLite loader (has column whitelists)
- `generate_*.py` - Data generators
- `.github/workflows/on-push.yml` - Build verification CI
