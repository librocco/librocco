# Diagnosis: The Slow Loading Screen and the Inconsistent Note

This document brings together everything from the other architecture docs to analyze the two issues that motivated this documentation effort.

## Issue 1: The Loading Screen Takes Too Long

### What You See

The splash screen ("Librocco is loading. Hang tight!") persists for several seconds before the app becomes usable.

### Root Cause: Sequential Blocking Initialization

The initialization in `initAppImpl()` (`apps/web-client/src/lib/app/init.ts:54-69`) is a strictly sequential chain:

```typescript
await initializeI18n();              // Step 1
await initializeDb(app, dbid, vfs);  // Step 2 (the bottleneck)
await initializeSync(app, vfs);      // Step 3
```

Nothing runs in parallel. The database initialization (Step 2) is where the time goes, and it has its own sequential sub-steps:

```
WASM fetch/compile -> VFS init -> sqlite.open() -> PRAGMA integrity_check -> schema check -> [migration]
```

### The Major Bottlenecks

#### 1. WASM Loading (500ms-2s on first load)

`getCrsqliteDB()` in `apps/web-client/src/lib/db/cr-sqlite/core/init.ts:46-58`:

```typescript
const ModuleFactory = await getModule();    // Dynamic import of ~1-2MB WASM module
const initializer = createWasmInitializer({ ModuleFactory, vfsFactory, cacheKey });
const sqlite = await initializer(() => wasmUrl);  // Compile + instantiate
```

Three WASM builds exist (`sync`, `asyncify`, `jspi`), selected by VFS. Each is a separate ~1-2MB binary. Browser caching helps on subsequent loads, but compilation still takes time.

#### 2. VFS Initialization

OPFS (Origin Private File System) requires negotiating file handles with the browser. If a previous session crashed without releasing locks, the browser may take extra time to recover. The "coop-sync" VFS variants require a shared worker + Atomics-based locking.

#### 3. `PRAGMA integrity_check` (100ms-2s)

```typescript
// db.ts:132
const [[res]] = await db.execA<[string]>("PRAGMA integrity_check");
```

This is a **full linear scan** of every page in the database file. For a 50MB database with tens of thousands of records, this is measurable. It runs on every startup, even if the database is perfectly fine.

#### 4. I18n Before DB

```typescript
await initializeI18n();  // init.ts:57
```

I18n is loaded first and blocks everything. If translation overrides are fetched via HTTP (the `override-translations-it` URL param), this adds a full network round-trip before database initialization even begins.

### Potential Improvements

#### Parallelize I18n and DB Init
I18n and DB initialization are independent. They could run concurrently:

```typescript
await Promise.all([
    initializeI18n(),
    initializeDb(app, dbid, vfs)
]);
```

The splash screen doesn't need translations (it uses hardcoded English strings), so the DB can start loading immediately.

#### Defer or Weaken the Integrity Check
`PRAGMA integrity_check` is defensive but expensive. Options:
- **Remove it entirely** -- rely on SQLite's own crash recovery (WAL journaling handles most corruption scenarios)
- **Replace with `PRAGMA quick_check`** -- checks only structural integrity, not index consistency. Much faster.
- **Run it in the background** after the app is ready, and only show a warning if it fails

#### WASM Preloading
The WASM binary URL is known at build time. A `<link rel="preload">` tag in `app.html` could start the fetch immediately, before any JavaScript executes:

```html
<link rel="preload" href="/crsqlite.wasm" as="fetch" crossorigin>
```

This wouldn't help with compilation time, but would eliminate the fetch latency.

#### Lazy Sync Worker Initialization
The sync worker is initialized during `initAppImpl()`, blocking the transition to Ready. If sync isn't configured, this is wasted time. Even when sync is configured, the app could show the UI immediately and start sync in the background.

Currently, `initializeSync()` is called sequentially after DB init, but `startSync()` already has its own readiness checks. The worker initialization could happen in parallel with or after the first render.

#### Trade-offs

| Improvement | Effort | Risk | Impact |
|-------------|--------|------|--------|
| Parallelize I18n + DB | Low | Low (independent systems) | ~100-300ms saved |
| Replace integrity_check | Low | Medium (less corruption detection) | ~100ms-2s saved |
| WASM preload | Low | None | ~200-500ms saved (first load only) |
| Lazy sync worker | Medium | Medium (race conditions) | ~50-100ms saved |
| Skip integrity_check entirely | Low | Higher (undetected corruption) | ~100ms-2s saved |

---

## Issue 2: Same Outbound Note Shows Different Books

### What You See

Two browsers syncing with the same server. Both are viewing the same outbound note. One shows books A and B, the other shows books A and C (or just different subsets).

### Key Principle: The Databases Were Identical

cr-sqlite guarantees that after bidirectional sync completes, both databases converge to the same state. This is unconditional. If two browsers showed different books, the databases were either mid-sync (data not yet propagated) or the **UI wasn't reflecting the database state**. The databases themselves were not divergent.

### Root Cause: Missing UI Notifications (Fixed in b87fcd3c)

**Before the fix:** When sync changes arrived via the Web Worker, the main thread's `TblRx` wasn't notified. The underlying database had the correct, converged data, but the UI never re-queried. Both databases contained the same books; only the UI was stale. See [04-reactivity.md](./04-reactivity.md).

**After the fix:** `notifyAll()` blasts all listeners after sync changes arrive. The UI re-queries and shows the latest data.

A page refresh would have revealed that both browsers had the same data all along. The divergence was between the UI and its own database, not between the two databases.

### Secondary Factor: Sync Latency Window

Even with `notifyAll()` working correctly, there's always a window between when a change is made on one browser and when it appears on another:

```
Browser A: local write
  -> cr-sqlite records change
    -> ws-client detects and sends
      -> Network transit
        -> Server receives and stores
          -> Server pushes to Browser B
            -> Browser B worker applies
              -> postMessage to main thread
                -> notifyAll()
                  -> UI re-queries and renders
```

During this window (typically <1 second on a good connection), the two databases genuinely differ -- sync hasn't finished yet. This is inherent to any distributed system and not a bug. Once bidirectional sync completes, the databases are identical.

### Semantic Surprises (Not Data Divergence)

Even with perfect sync and perfect UI reactivity, the CRDT model can produce results that surprise business expectations. These are not bugs in cr-sqlite -- the databases converge correctly -- but they may violate assumptions the application makes:

- **Post-commit book arrival:** Browser A commits a note. Browser B's book addition syncs afterward. Both databases agree: the note is committed AND has a book_transaction with `committed_at = NULL`. Consistent data, surprising semantics.
- **Orphaned rows:** No checked foreign keys means a `book_transaction` can reference a deleted note. Both databases agree the orphan exists.
- **Duplicate warehouse entries:** The composite key `(isbn, note_id, warehouse_id)` means two browsers adding the same ISBN from different warehouses creates two rows. Both databases agree on both rows.

In every case, the databases converge. The question is whether the application layer handles the converged state correctly.

### Improvements

#### 1. Confirm notifyAll Fix is Sufficient (Done)
The e2e test in `sync.spec.ts` ("should update UI when remote-only changes arrive via sync") validates that remote changes appear in the UI without user interaction.

#### 2. Add Table-Specific Notifications
The current `notifyAll()` fires every listener. A more targeted approach would parse the incoming changeset to determine which tables changed and only notify relevant listeners. This would improve performance and reduce unnecessary re-queries.

#### 3. Application-Level Guards for Critical Operations
For business-critical operations (like committing a note), the application could:
- Check for unsynced changes before committing
- Require a sync round-trip before allowing commit
- Show a warning if the note has been modified on another device

This is application-level logic, not CRDT-level. CRDTs guarantee convergence; application guards enforce business rules on top of that converged state.

---

## Summary

| Issue | Primary Cause | Status | Notes |
|-------|--------------|--------|-------|
| Slow loading | Sequential init + WASM load + integrity check | Open | See improvement trade-offs above |
| Different books in UI | UI not re-querying after sync (missing `notifyAll()`) | Fixed (b87fcd3c) | Databases were always converged; the UI was stale |
