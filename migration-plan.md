# Schema Migration & DB Initialization: A Team Discussion Document

## The Problem We Keep Dancing Around

Picture this: User opens the app, syncs their database (schema version X), closes the tab, and goes about their life. Meanwhile, we ship a new feature that requires a schema change (version X+1). User returns, browser fetches the shiny new JavaScript bundle, and... boom. The app code speaks X+1, but the OPFS database stubbornly remains at X.

This isn't a theoretical edge case. This is _the_ primary upgrade path for every user of the application.

---

## Flow Diagrams

### Current Initialization Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         +layout.ts load()                           │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      getInitializedDB(dbname, vfs)                  │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                    ▼                             ▼
            ┌─────────────┐               ┌─────────────┐
            │ Cache hit?  │───Yes────────▶│ Return      │
            │             │               │ cached      │
            └─────────────┘               │ promise     │
                    │                     └─────────────┘
                    │ No
                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  getDB(dbname, vfs)                                                 │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ IDB VFS?    ──Yes──▶  Main thread: getCrsqliteDB()          │    │
│  │             ──No───▶  Worker thread: Comlink proxy          │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│  checkAndInitializeDB(db)                                           │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 1. PRAGMA quick_check  ───Fail───▶  throw ErrDBCorrupted    │    │
│  │                                                             │    │
│  │ 2. getSchemaNameAndVersion()                                │    │
│  │    ├─ null ─────────────▶  initializeDB() (apply schema)    │    │
│  │    └─ [name, version] ──┐                                   │    │
│  │                         ▼                                   │    │
│  │ 3. Compare with app's schemaName/schemaVersion              │    │
│  │    ├─ Match ────────────▶  Return db ✓                      │    │
│  │    └─ Mismatch ─────────▶  throw ErrDBSchemaMismatch        │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                   │
              ┌────────────────────┴────────────────────┐
              │                                         │
              ▼                                         ▼
       ┌─────────────┐                          ┌─────────────┐
       │   Success   │                          │    Error    │
       │  Return     │                          │  Caught in  │
       │  DbCtx      │                          │  +layout.ts │
       └─────────────┘                          └─────────────┘
              │                                         │
              ▼                                         ▼
       ┌─────────────┐                          ┌─────────────┐
       │  App loads  │                          │ Error dialog│
       │  normally   │                          │ shown       │
       └─────────────┘                          └─────────────┘
```

### Sync Worker Lifecycle (Current)

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  +layout    │      │    Sync     │      │   Sync      │
│  .svelte    │      │   Worker    │      │   Server    │
└──────┬──────┘      └──────┬──────┘      └──────┬──────┘
       │                    │                    │
       │  1. DB initialized │                    │
       │  (resolvedDbCtxStore)                   │
       ▼                    │                    │
   ┌───────────────────┐    │                    │
   │ Wait 1 second     │    │                    │
   │ (setTimeout)      │    │                    │
   └─────────┬─────────┘    │                    │
             │              │                    │
             │  2. "start"  │                    │
             ├─────────────▶│                    │
             │              │  3. Load WASM,     │
             │              │     init VFS       │
             │              │                    │
             │              │  4. WebSocket      │
             │              ├───────────────────▶│
             │              │                    │
             │  5. "ready"  │                    │
             │◀─────────────┤                    │
             │              │                    │
             │              │◀────sync─────────▶│
             │              │                    │
             │  6. Progress │                    │
             │◀─────────────┤                    │
             ▼              ▼                    ▼
```

### Schema Version Mismatch Recovery (Current)

```
     User opens app with outdated DB
                    │
                    ▼
        ┌────────────────────┐
        │ ErrDBSchemaMismatch│
        │ thrown during load │
        └─────────┬──────────┘
                  │
                  ▼
        ┌────────────────────┐
        │ Error dialog shown │
        │ "Schema mismatch"  │
        │                    │
        │ [Automigrate]      │
        └─────────┬──────────┘
                  │
                  │ User clicks button
                  ▼
        ┌────────────────────┐
        │  automigrateDB()   │
        │                    │
        │  1. Get raw DB     │
        │     (bypasses      │
        │      cache)        │
        │                    │
        │  2. Call db.       │
        │     automigrateTo()│
        │                    │
        │  3. window.        │
        │     location.      │
        │     reload()       │
        └─────────┬──────────┘
                  │
                  ▼
        ┌────────────────────┐
        │ Page reload        │
        │ (full restart)     │
        └─────────┬──────────┘
                  │
                  ▼
        ┌────────────────────┐
        │ Hopefully works    │
        │ now... 🤞          │
        └────────────────────┘
```

### The Problematic Race Condition

```
         Main Thread                    DB Worker                 Sync Worker
              │                             │                          │
              │  getInitializedDB()         │                          │
              ├────────────────────────────▶│                          │
              │                             │ Load WASM                │
              │                             │ Open DB                  │
              │                             │ Check schema ─── MISMATCH!
              │◀──── ErrDBSchemaMismatch ───┤                          │
              │                             │                          │
   ┌──────────┴──────────┐                  │                          │
   │ Show error dialog   │                  │                          │
   └──────────┬──────────┘                  │                          │
              │                             │                          │
   ┌──────────┴──────────┐                  │     Meanwhile...         │
   │ User thinking...    │                  │          │               │
   │ "What's this?"      │                  │          │  start()      │
   └──────────┬──────────┘                  │◀─────────┼───────────────┤
              │                             │          │               │
              │                             │          ▼               │
              │                             │   ┌─────────────────┐    │
              │                             │   │ Init DB (again) │    │
              │                             │   │ Start syncing   │    │
              │                             │   │ with OLD schema!│    │
              │                             │   └─────────────────┘    │
              │                             │                          │
              │ User clicks "Automigrate"   │                          │
              ├────────────────────────────▶│                          │
              │                             │ ← Migrate while          │
              │                             │   sync is running!       │
              │                             │                          │
              │                             │         💥               │
              ▼                             ▼          ▼               ▼
```

---

## Current Architecture: The Good Parts

### What We've Built

**Schema versioning**: Uses `cryb64` hash of schema SQL content. No manual version bumps to forget. Change the schema file, get a new version automatically.

```
apps/web-client/src/lib/db/cr-sqlite/db.ts:24-25
export const schemaName = "init";
export const schemaVersion = cryb64(schemaContent);
```

> **Alternative: `PRAGMA user_version`**
> Industry standard uses an explicit integer version rather than content hashing. Pros: No false positives from comment changes. Cons: Requires discipline to increment. Our hash approach with silent automigration effectively handles false positives anyway.

**Initialization flow**: Clean separation of concerns:
1. `getDB()` → opens database (worker or main thread)
2. `checkAndInitializeDB()` → validates integrity, checks schema, initializes if empty
3. `getInitializedDB()` → caches promises, prevents race conditions

**Error detection**: Three distinct error types:
- `ErrDBCorrupted` — PRAGMA quick_check failed (database is toast)
- `ErrDBSchemaMismatch` — schema name/version differs from app code
- `ErrDemoDBNotInitialised` — demo mode, no DB file in OPFS

**User-facing dialogs**: Each error has its own recovery path:
- Corrupted: "Nuke it" button (clears IndexedDB, reloads)
- Schema mismatch: "Automigrate" button
- Demo not init: "Load DB" button (fetches from R2)

**Auto-migration**: JS port of cr-sqlite's Rust automigrate logic in `debug/migrations.ts`. Handles:
- Table additions/removals
- Column additions/removals
- Index changes
- CRR-aware alterations (`crsql_begin_alter`/`crsql_commit_alter`)

---

## Current Shortcomings: Where It Hurts

### 1. The Sync Timing Problem

The current flow:
```
Load app → Check schema → Throw ErrDBSchemaMismatch → Show dialog
                                                    ↓
                                              User clicks "Automigrate"
                                                    ↓
                                              Migration runs
                                                    ↓
                                              Page reload
```

But here's the rub: **what if sync is running?** Or about to run? The sync worker starts independently. If we migrate the schema while sync is pushing/pulling changes... dragons.

The WIP changes (returning `worker` from `getDB`) attempt to solve this by unifying the DB worker and sync worker. But this creates new problems.

### 2. The Worker Architecture Tangle

Current state:
- DB can run in main thread (IDB VFS) or dedicated worker (OPFS VFS)
- Sync runs in its own dedicated worker
- Communication via Comlink (DB) and postMessage (sync)

WIP changes try to:
- Return the worker from `getDB()` so sync can use the same worker
- Run sync logic inside the DB worker

Problem: Now the sync worker and DB worker are coupled. If we need to restart sync, do we restart the DB? If the DB worker dies, sync dies too.

### 3. The Error Dialog Chicken-and-Egg

The current error handling assumes the user will click a button. But:
- What if they close the tab?
- What if they have multiple tabs open?
- What if the app is a PWA running in the background?

The error dialog is reactive (`$errorDialogOpen = Boolean(error)`), but it's still a _dialog_. It blocks the entire app.

### 4. The "Nuke" Option Is Too Aggressive

For `ErrDBCorrupted`, we offer only one option: delete everything. But the dialog says:

> "This won't resync the database. If you want to sync up the DB with the remote one, please do so on the settings page (after reinitialisation)"

This is a UX nightmare. User has to:
1. Click "Delete DB"
2. Wait for reload
3. Navigate to settings
4. Manually trigger sync

Why not: Delete → Auto-sync → Done?

### 5. The Automigrate Path Doesn't Always Work

From `migrations.ts`:

```typescript
// IMPORTANT NOTE: This is for debug purposes only and should NEVER be used in
// production as (unlike the original) it doesn't wrap everything into a transaction
```

The JS migration code opens an in-memory DB for comparison, which can fail if the schema is invalid. And it doesn't run in a transaction. If power is lost mid-migration... half-migrated database.

**Note on SQLite DDL & Transactions:**
Unlike MySQL/Oracle, SQLite supports transactional DDL—you CAN roll back `ALTER TABLE`, `CREATE TABLE`, etc. The production `db.automigrateTo()` (calling cr-sqlite's Rust `crsql_automigrate`) wraps everything in a transaction internally. The JS debug version uses a SAVEPOINT only for table modifications, leaving schema apply and version tracking outside—hence the "debug-only" warning.

**Performance consideration:** In OPFSCoopSyncVFS, each statement outside an explicit transaction acquires/releases the file lock. The production migration path batches operations correctly.

### 6. Initial Sync vs Migration Race

The `InitialSyncOptimiser` detects empty databases and downloads the full DB file from the server. But:

- If user has an old (pre-sync) database and schema changes...
- The app throws `ErrDBSchemaMismatch` before sync even starts
- User clicks "Automigrate"
- Now we have a migrated-but-empty database
- User has to manually trigger sync

Should migration happen before or after initial sync? Neither answer is obviously correct.

---

## Technical Possibilities: What Our Tools Offer

### 1. Preemptive Migration (Before App Loads)

vlcn.io's `db.automigrateTo()` can run before the schema check:

```typescript
// Instead of throwing ErrDBSchemaMismatch...
const schemaRes = await getSchemaNameAndVersion(db);
if (schemaRes) {
  const [name, version] = schemaRes;
  if (name !== schemaName || version !== schemaVersion) {
    // Try migration first, only throw if it fails
    try {
      await db.automigrateTo(schemaName, schemaContent);
    } catch (migrationError) {
      throw new ErrDBSchemaMismatch({ ... });
    }
  }
}
```

**Pros**: Invisible to user, happens automatically
**Cons**: If migration fails, we've hidden the original problem

### 2. Graceful Degradation with Read-Only Mode

Detect mismatch, but allow read-only access while migration is prepared:

```typescript
if (name !== schemaName || version !== schemaVersion) {
  return {
    db,
    readonly: true,
    pendingMigration: { from: version, to: schemaVersion }
  };
}
```

**Pros**: User sees their data immediately, migration happens in background
**Cons**: Complex state management, "readonly" mode has to cascade through all components

### 3. Server-Side Schema Negotiation

The sync server currently uses a single schema (`"init"`). It could:

1. Accept client's schema version in the sync handshake
2. Return appropriate responses based on version compatibility
3. Reject sync if versions are too far apart

From `sync-server/src/index.ts`:
```typescript
// Currently:
dbProvider.use(req.params.dbname, schemaName, (idb) => { ... });

// Could be:
dbProvider.use(req.params.dbname, clientSchemaName, clientSchemaVersion, (idb) => { ... });
```

**Pros**: Centralized version control, server can refuse incompatible clients
**Cons**: Requires server-side schema version awareness, breaks offline-first

### 4. Progressive Migration with Version History

Keep multiple schema versions in the codebase:

```
schemas/
  init.v1
  init.v2
  init.v3
  migrations/
    v1-to-v2.sql
    v2-to-v3.sql
```

Apply migrations incrementally:

```typescript
const currentVersion = await getSchemaVersion(db);
for (const [from, to, sql] of getMigrationPath(currentVersion, targetVersion)) {
  await db.exec(sql);
}
```

**Pros**: Explicit control over migrations, can handle complex data transformations
**Cons**: More files to maintain, version explosion over time

### 5. Sync-Aware Migration Flow

Stop sync → Migrate → Resume sync:

```typescript
async function safelyMigrate(db: DBAsync, syncController: SyncTransportController) {
  // 1. Pause sync (don't close, just pause)
  await syncController.pause();

  // 2. Wait for in-flight changes to settle
  await syncController.waitForIdle();

  // 3. Perform migration in transaction
  await db.transaction(async () => {
    await db.automigrateTo(schemaName, schemaContent);
  });

  // 4. Resume sync (server will catch up)
  await syncController.resume();
}
```

**Pros**: Clean separation, no race conditions
**Cons**: Requires sync pause/resume API (not currently implemented)

### 6. Optimistic Initial Sync Strategy

For new devices or "nuke" scenarios:

```typescript
if (await isEmptyDB(db) || schemaMismatch) {
  // Don't even try to use local data
  // Just fetch fresh from server
  await initialSyncOptimiser.fetchAndReplace();
}
```

**Pros**: Simple, no migration logic needed for fresh installs
**Cons**: Loses local changes if user had any

### 7. Bi-Directional Schema Compatibility

Store both old and new column names during transition period:

```sql
-- Add new column
ALTER TABLE customer ADD COLUMN email_new TEXT;

-- Copy data
UPDATE customer SET email_new = email;

-- Keep both columns until all clients upgrade
-- Remove old column in next version
```

**Pros**: Rolling upgrades without breakage
**Cons**: Schema bloat, requires discipline

### 8. Safe Schema Change Guidelines (Append-Only Evolution)

In a distributed local-first system, destructive schema changes are dangerous. If Device A drops a column and syncs with Device B (still on old schema), Device B may send data for the dropped column.

**Rules:**
1. **Never drop columns** — mark as deprecated in application logic
2. **Never rename columns** — add new column, migrate data, deprecate old
3. **Add nullable columns with defaults** — old clients can sync without knowing about new columns
4. **Add tables freely** — safe operation
5. **Remove tables only after all clients updated** — coordinate via app versioning

This "append-only" approach allows rolling upgrades without sync breakage.

---

## Questions for Discussion

1. **What's the acceptable UX for schema migration?**
   - Silent automatic (user never knows)
   - Banner notification ("Upgrading your data...")
   - Blocking dialog (current approach)
   - Progressive (readonly until migrated)

2. **How do we handle migration failures?**
   - Retry with exponential backoff
   - Fallback to "nuke and sync"
   - Keep broken state and let user decide
   - Phone home with telemetry

3. **Should we couple or decouple DB and sync workers?**
   - Same worker: Simpler lifecycle, but single point of failure
   - Separate workers: More complexity, but independent failures
   - Main thread DB + worker sync: Simplest, but blocks UI

4. **What about multi-tab scenarios?**
   - ~~SharedWorker for single DB instance~~ *(Not viable: `FileSystemSyncAccessHandle` unavailable in SharedWorkers—only Dedicated Workers)*
   - **Pattern A (Shared File, Distinct Workers):** Each tab spawns Dedicated Worker, OPFSCoopSyncVFS handles locking
   - **Pattern B (Leader Election):** Tabs compete for `app_sync_leader` lock; leader manages WebSocket, others write locally
   - BroadcastChannel for coordination
   - Lock API to prevent concurrent migrations

5. **Server's role in version management?**
   - Dumb pipe (current)
   - Version-aware (reject incompatible clients)
   - Migration service (transform changes in flight)

---

## Key Files to Review

| File | Purpose |
|------|---------|
| `apps/web-client/src/lib/db/cr-sqlite/db.ts` | Schema versioning, DB initialization |
| `apps/web-client/src/lib/db/cr-sqlite/debug/migrations.ts` | JS automigrate implementation |
| `apps/web-client/src/lib/db/cr-sqlite/errors.ts` | Error class definitions |
| `apps/web-client/src/routes/+layout.ts` | Load function, error catching |
| `apps/web-client/src/routes/+layout.svelte` | Error dialogs, recovery actions |
| `apps/web-client/src/lib/workers/sync-worker.ts` | Sync worker entry point |
| `apps/web-client/src/lib/workers/sync-transport-control.ts` | Sync transport layer |
| `apps/web-client/src/lib/schemas/init` | The actual schema SQL |
| `apps/sync-server/src/index.ts` | Sync server implementation |

---

## The WIP Changes (Current Branch)

The `feature/optimize-load` branch shows ongoing work to:

1. Return `worker` from `getDB()` for sync integration
2. Move sync logic into the DB worker (`worker-db.worker.ts`)
3. Remove the 1-second delay before starting sync
4. Use the existing worker instance instead of creating a new one

This is addressing the "when does sync start" timing issue, but introduces new coupling concerns.

---

---

## Recommended Approach

Based on the analysis, here's my recommended path forward—a pragmatic solution that addresses the core issues without over-engineering.

### The Core Insight

The current architecture has **two independent lifecycles** that should be **one**:

1. DB initialization lifecycle (check schema, throw error, show dialog)
2. Sync lifecycle (start after 1 second delay, hope for the best)

These need to be unified. The schema version check should be a **gate** that prevents sync from starting until the DB is in a valid state.

### Proposed Architecture

```
                     +layout.ts load()
                            │
                            ▼
             ┌─────────────────────────────┐
             │   getInitializedDB()        │
             │   with tryAutoMigrate: true │
             └─────────────────────────────┘
                            │
         ┌──────────────────┴──────────────────┐
         │                                     │
         ▼                                     ▼
   ┌───────────┐                        ┌────────────┐
   │ Schema OK │                        │ Schema     │
   │ or auto-  │                        │ mismatch   │
   │ migrated  │                        │ (migration │
   │ silently  │                        │  failed)   │
   └─────┬─────┘                        └──────┬─────┘
         │                                     │
         ▼                                     ▼
   ┌───────────┐                        ┌────────────┐
   │ Return    │                        │ Return     │
   │ DbCtx     │                        │ error +    │
   │ + worker  │                        │ degraded   │
   └─────┬─────┘                        │ DbCtx      │
         │                              └──────┬─────┘
         │                                     │
         ▼                                     ▼
   ┌───────────┐                        ┌────────────┐
   │ Sync can  │                        │ Show error │
   │ start NOW │                        │ dialog     │
   │ (same     │                        │ (no sync)  │
   │ worker)   │                        └────────────┘
   └───────────┘
```

### Implementation Steps

#### Step 1: Try Auto-Migration Before Throwing

Modify `checkAndInitializeDB` to attempt migration before throwing:

```typescript
const checkAndInitializeDB = async (db: DBAsync): Promise<DBAsync> => {
  // ... integrity check ...

  const schemaRes = await getSchemaNameAndVersion(db);

  if (!schemaRes) {
    await initializeDB(db);
    return db;
  }

  const [name, version] = schemaRes;
  if (name !== schemaName || version !== schemaVersion) {
    // NEW: Try migration first
    try {
      console.log("Schema mismatch detected, attempting auto-migration...");
      await db.automigrateTo(schemaName, schemaContent);
      console.log("Auto-migration successful");
      return db;
    } catch (migrationError) {
      // Migration failed, NOW throw
      console.error("Auto-migration failed:", migrationError);
      throw new ErrDBSchemaMismatch({
        ...payload,
        migrationError // Include for debugging
      });
    }
  }

  return db;
};
```

#### Step 2: Unify DB and Sync Workers

Keep the WIP direction but with clearer separation:

```typescript
// worker-db.worker.ts
let syncReady = false;
let dbReady = false;
let schemaValid = false;

// Only start sync when ALL conditions are met
function maybeStartSync() {
  if (dbReady && schemaValid && syncReady) {
    startSync(config);
  }
}

// Called after schema validation passes
function onDbInitialized(validSchema: boolean) {
  dbReady = true;
  schemaValid = validSchema;
  maybeStartSync();
}

// Called when sync config received from main thread
self.addEventListener("message", (e) => {
  if (e.data._type === "start") {
    syncReady = true;
    maybeStartSync();
  }
});
```

#### Step 3: Graceful Degradation for Failed Migrations

If migration fails, allow read-only access:

```typescript
// db.ts
export type DbCtx = {
  db: DBAsync;
  rx: ReturnType<typeof rxtbl>;
  vfs: VFSWhitelist;
  worker?: Worker;
  readonly?: boolean;  // NEW
  pendingMigration?: { from: bigint; to: bigint }; // NEW
};
```

The UI can then show a non-blocking banner: "Database upgrade required. Some features disabled."

#### Step 4: Remove the 1-Second Delay

The delay was a hack. With proper coordination, remove it:

```typescript
// +layout.svelte (BEFORE)
setTimeout(() => {
  wkr.start(ctx.vfs);
}, 1000);

// +layout.svelte (AFTER)
// Sync starts in worker when DB is ready
// No delay needed
```

#### Step 5: Handle Multi-Tab with Locks

Use the Web Locks API to prevent concurrent migrations:

```typescript
async function safeAutoMigrate(db: DBAsync): Promise<void> {
  await navigator.locks.request('db-migration', async () => {
    // Re-check schema in case another tab already migrated
    const current = await getSchemaNameAndVersion(db);
    if (current && current[1] === schemaVersion) {
      return; // Already migrated by another tab
    }
    await db.automigrateTo(schemaName, schemaContent);
  });
}
```

**Leader Election for Sync** (prevents duplicate WebSocket connections across tabs):

```typescript
// Only one tab should maintain the WebSocket connection
async function tryBecomeLeader(onPromoted: () => void) {
  navigator.locks.request('app_sync_leader', { ifAvailable: true }, async (lock) => {
    if (lock) {
      onPromoted(); // We are the leader, start WebSocket
      // Hold lock until tab closes (never resolve)
      return new Promise(() => {});
    }
    // Not leader - another tab handles sync
    // This tab still writes to OPFS; leader picks up changes
  });
}
```

This pattern ensures:
- All tabs can read/write to the DB (OPFSCoopSyncVFS handles file locking)
- Only one tab maintains the WebSocket connection (saves bandwidth/server resources)
- If leader tab closes, lock releases and another tab takes over seamlessly

### Startup Sequence Checklist

Validate implementation against this order:

| Phase | Action | Constraint |
|-------|--------|------------|
| 1 | Set COOP/COEP headers | Server-side; required for SharedArrayBuffer |
| 2 | Load WASM module | Async; wait for instantiation |
| 3 | Register VFS | `OPFSCoopSyncVFS.create()` before opening DB |
| 4 | Open database | Pass correct VFS name to `sqlite3_open_v2` |
| 5 | Load cr-sqlite extension | Must load on *every* new connection |
| 6 | Run migrations | Check `PRAGMA user_version` or schema hash |
| 7 | Connect WebSocket | Only after DB ready and migrated |

### What This Achieves

1. **Silent upgrades for most users**: Migration happens automatically on app load
2. **No race conditions**: Sync only starts after schema validation passes
3. **Graceful degradation**: Failed migrations don't brick the app
4. **Multi-tab safe**: Locks prevent concurrent migrations
5. **Simpler architecture**: One worker, one lifecycle

### What This Doesn't Solve (Future Work)

- **Very large migrations**: May still need a loading indicator for long-running migrations
- **Breaking schema changes**: Some changes can't auto-migrate (need explicit migration scripts)
- **Server version awareness**: Server still doesn't validate client schema
- **Offline-first migration conflicts**: User makes changes offline, app updates, migration changes data structure

### Files to Modify

1. `apps/web-client/src/lib/db/cr-sqlite/db.ts` — Add try-migrate logic
2. `apps/web-client/src/lib/db/cr-sqlite/core/worker-db.worker.ts` — Sync coordination
3. `apps/web-client/src/routes/+layout.svelte` — Remove delay, simplify sync start
4. `apps/web-client/src/lib/db/cr-sqlite/errors.ts` — Add `migrationError` to ErrDBSchemaMismatch

### Rough Effort Estimate

- Core changes (Steps 1-4): 2-3 focused hours
- Multi-tab locking (Step 5): 1 hour
- Testing across VFS types: 2-3 hours
- Edge case handling: Variable

---

*Document prepared for team discussion. The recommendation above is a starting point—the team should evaluate trade-offs together.*
