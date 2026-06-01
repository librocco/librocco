# Extracting the Database from Disk

**Relevant task:** "Grab a copy of a user's live database" — for debugging, backups, or reproducing a bug against real data, without disturbing the running browser.

Librocco's database lives in the browser's **Origin Private File System (OPFS)**, not on the normal filesystem and not behind any server. This document explains where those bytes actually land on disk and how to copy one out from the command line — no DevTools, no remote-debugging port, no browser restart.

It builds directly on the storage internals in [01-db-initialization.md](./01-db-initialization.md); read that first for the VFS/WASM picture.

> ⚠️ **This is an unofficial, reverse-engineered method.** The disk-copy approach depends on *undocumented* Chromium internals — the on-disk OPFS layout, verbatim single-file storage, and rollback-journal assumption — observed in **current** browser versions. No browser vendor guarantees any of this, and any update can change or remove it silently. Treat it as a debugging/backup convenience, not a stable interface. The only forward-compatible way to get the bytes is the [in-app export](#in-app-export-the-gold-standard-for-a-live-copy), which uses the public OPFS API.

## Why this works (without disturbing the browser)

Three properties of how librocco stores data make an out-of-band copy work:

1. **One contiguous file per database.** The app uses wa-sqlite's `OPFSCoopSyncVFS` (`DEFAULT_VFS = "sync-opfs-coop-sync"`, see `core/constants.ts`). This VFS stores each SQLite database as a *single* OPFS file whose bytes **are** the database — no block pool, no `sahpool` header. You can confirm it from the shipped export, which reads the DB with a plain `dir.getFileHandle(dbid).getFile()` (`lib/utils/debug-export.ts`).

2. **Chromium persists OPFS files verbatim.** For the default storage bucket, a Chromium-family browser writes each OPFS file to:

   ```
   <profile>/File System/<origin-id>/t/<NN>/<file-id>
   ```

   The backing file's first 16 bytes are `SQLite format 3\0` — i.e. it is a normal SQLite file with a numeric name. (`<origin-id>` is a per-origin directory; the `File System/Origins` LevelDB maps it back to the origin URL.)

3. **Rollback journal, not WAL.** Librocco keeps the DB in rollback-journal mode and actively rewrites any WAL header byte back to rollback on import (`core/utils.ts`). An **idle** database is therefore a single self-consistent file with an empty (zero-byte) `-journal` sidecar — so a byte copy taken between transactions is a valid, complete database.

The browser's `SyncAccessHandle` is an *internal* lock; it does **not** place an OS-level lock on the backing file, so an external reader can copy it while the tab stays open.

## The database files

| OPFS filename | Constant | What it is |
|---|---|---|
| `librocco_current.sqlite3` | `DEFAULT_DB_NAME` | the active store database |
| `librocco_demo_db.sqlite3` | `DEMO_DB_NAME` | the demo database |

A given origin's `File System/<origin-id>/t/Paths/` LevelDB lists these names, which is how you confirm an origin directory belongs to librocco.

## Recommended: the extraction script

`scripts/extract-opfs-db.py` automates discovery, copy, and verification across all installed Chromium-family browsers (Brave, Chrome, Chromium, Edge, Vivaldi). It **only reads** the browser profile; it writes nothing inside it.

```bash
# List every librocco database found on the machine, with origin + row counts
scripts/extract-opfs-db.py --list

# Copy the most recently written one to a file, verified
scripts/extract-opfs-db.py --out /tmp/store.sqlite3

# Narrow to a particular origin (substring match on the URL)
scripts/extract-opfs-db.py --origin localhost

# Grab the demo database instead
scripts/extract-opfs-db.py --db-name librocco_demo_db.sqlite3
```

What it does for you:

- finds candidate backing files by **content** (SQLite magic + librocco schema), not by a hardcoded path — the numeric `<file-id>` changes over time;
- copies to a temp file and runs `PRAGMA integrity_check`, **retrying** if a concurrent browser write produced a torn read;
- if a transaction was mid-flight, copies the hot `-journal`/`-wal` sidecar alongside so SQLite rolls back to the last commit.

The result opens in any vanilla `sqlite3` — the cr-sqlite extension is only needed to read the `crsql_*` *virtual* tables, not the base data.

## Manual fallback

If you'd rather do it by hand (or on a browser the script doesn't know about):

```bash
# 1. Find librocco's backing file: a >0-byte file whose content starts with the
#    SQLite magic, under a 'File System' origin dir that references the db name.
grep -rl "librocco_current.sqlite3" \
  "$HOME/.config/<browser>/<profile>/File System/"*/t/Paths/ 2>/dev/null
#    -> tells you which <origin-id> dir; the main db is the large SQLite-magic
#       file under that dir's t/<NN>/.

# 2. Copy it out (read-only; the browser can stay open) and verify.
cp "<.../File System/NNN/t/NN/XXXXXXXX>" /tmp/store.sqlite3
sqlite3 /tmp/store.sqlite3 'PRAGMA integrity_check;'
```

## In-app export (the gold standard for a *live* copy)

For a guaranteed up-to-the-instant snapshot while the app is actively being written to, use the app's own export instead of a disk copy — it reads through the same VFS, so it can never catch a torn write:

- Route: `/debug` → the export action (`apps/web-client/src/routes/debug/+page.svelte`).
- Implementation: `exportStateArchive()` in `apps/web-client/src/lib/utils/debug-export.ts`, which zips the raw SQLite file plus the relevant `localStorage` config.

The matching `importStateArchive()` writes a raw SQLite file back into OPFS.

## Caveats

- **Point-in-time.** A disk copy reflects the last *committed* state. Check the backing file's mtime to see when that was; re-run after the app commits to capture newer data.
- **Torn reads.** Only a risk if a write lands mid-copy. The script detects this (integrity check) and retries; for heavy concurrent writing, prefer the in-app export.
- **Layout coupling / future breakage.** The disk path (`File System/<origin>/t/...`), the verbatim single-file storage, and the rollback-mode assumption are all **reverse-engineered from current Chromium behaviour** — undocumented and unguaranteed. A browser update can change any of them and break the disk-copy methods here without warning. The in-app export depends only on the public OPFS API and is the method to prefer when longevity matters.
- **Profiles & origins.** The same database can exist under several origins (e.g. a dev `localhost` instance and a deployed host) and in several browsers. Use `--list` / the `Origins` mapping to pick the right one.

## Key files

| File | Purpose |
|------|---------|
| `scripts/extract-opfs-db.py` | CLI: discover, copy, verify an OPFS database |
| `apps/web-client/src/lib/db/cr-sqlite/core/constants.ts` | `DEFAULT_VFS` / VFS selection |
| `apps/web-client/src/lib/db/cr-sqlite/core/vfs.ts` | maps VFS names to `OPFSCoopSyncVFS` etc. |
| `apps/web-client/src/lib/db/cr-sqlite/core/utils.ts` | OPFS helpers; WAL→rollback header fix |
| `apps/web-client/src/lib/utils/debug-export.ts` | in-app `exportStateArchive()` / import |
| `apps/web-client/src/lib/constants.ts` | `DEFAULT_DB_NAME`, `DEMO_DB_NAME` |
