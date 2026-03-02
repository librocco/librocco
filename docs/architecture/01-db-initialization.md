# DB Initialization: From Splash Screen to Ready

**Relevant issue:** The loading screen takes too long.

This document traces every step from the moment the browser tab opens to the moment the splash screen slides away. Each step is a potential bottleneck.

## The Splash Screen

Before SvelteKit even hydrates, a hand-crafted HTML splash screen is already visible. It lives in raw HTML inside `app.html`:

```
apps/web-client/src/app.html:130-143
```

The splash has its own mini state machine driven by a global callback `window.__dbInitUpdate(phase, error)` (line 162). The phases are `idle`, `loading`, `migrating`, `error`, and `ready`. On `ready`, the splash plays a 200ms exit animation and removes itself from the DOM (lines 180-184).

This approach -- a pre-hydration splash -- exists because SvelteKit can't render anything meaningful until JavaScript loads and the database is ready. The splash is the first thing the user sees, and the last thing before the app appears.

## The Initialization Sequence

The entry point is `+layout.ts`:

```
apps/web-client/src/routes/+layout.ts:59-69
```

When running in the browser, it calls `initApp(app)`, which delegates to `initAppImpl()` in:

```
apps/web-client/src/lib/app/init.ts:54-69
```

The sequence is:

### Step 1: I18n Initialization
```typescript
await initializeI18n();  // init.ts:57
```
Detects locale, loads translation strings, applies overrides. This is async and involves a `fetch()` if URL-based translation overrides are configured. Normally fast, but it blocks everything else.

### Step 2: Database Initialization
```typescript
const vfs = getVFSFromLocalStorage(DEFAULT_VFS);  // init.ts:61
await initializeDb(app, get(app.config.dbid), vfs);  // init.ts:62
```

This is where the time goes. Let's unpack it.

### Step 3: Sync Initialization
```typescript
await initializeSync(app, vfs);  // init.ts:67
if (get(syncActive)) await startSync(app, get(dbid), get(syncUrl));  // init.ts:68
```

Spawns the sync Web Worker and, if sync is enabled, starts the WebSocket connection. See [02-sync.md](./02-sync.md).

## Inside `initializeDb()`

```
apps/web-client/src/lib/app/db.ts:120-192
```

### 2a. VFS Selection and WASM Loading

```typescript
const db = await getDBCore(dbid, vfs);  // db.ts:129
```

`getDBCore` is actually `getDB` from `db/cr-sqlite/db.ts:26-34`. It inspects the VFS name to decide whether to use the main thread or a worker:

```typescript
const mainThreadVFS = new Set(["asyncify-idb-batch-atomic", "asyncify-opfs-any-context"]);
if (mainThreadVFS.has(vfs)) {
    return getMainThreadDB(dbname, vfs);   // Main thread path
}
return getWorkerDB(dbname, vfs);           // Worker thread path
```

Either path eventually calls `getCrsqliteDB()` in:

```
apps/web-client/src/lib/db/cr-sqlite/core/init.ts:46-58
```

This function:
1. **Loads the WASM module** -- dynamically imports one of three builds (`sync`, `asyncify`, `jspi`) based on the VFS. The VFS-to-build mapping is at `init.ts:31-40`.
2. **Creates a VFS factory** -- wraps the browser storage API (OPFS or IndexedDB).
3. **Initializes cr-sqlite** -- calls `createWasmInitializer()` from `@vlcn.io/crsqlite-wasm`, which loads the WASM binary and opens the database file.

**Why this is slow:** WASM binaries are ~1-2MB. On first load, they must be fetched over the network. On subsequent loads, the browser may cache them, but initialization still involves compiling WASM to native code. The OPFS VFS also requires negotiating file system handles with the browser, which can be slow especially if the browser has stale locks from a previous crash.

### 2b. Integrity Check

```typescript
const [[res]] = await db.execA<[string]>("PRAGMA integrity_check");  // db.ts:132
```

This runs SQLite's full integrity check on the database. For a large database, this walks every page. It's a linear scan of the entire file. On a 50MB database, this can take noticeable time.

### 2c. Schema Check and Application

```typescript
const schemaRes = await getSchemaNameAndVersion(db);  // db.ts:140
```

Queries `crsql_master` for the stored schema name and version hash. Three outcomes:

1. **No schema stored** (fresh DB): Apply the full schema from `$lib/schemas/init` and store the name + version. See [03-migrations.md](./03-migrations.md) for the schema file.
2. **Schema matches**: Done. Set state to `Ready`.
3. **Schema mismatch**: Enter the `Migrating` state and run auto-migration. See [03-migrations.md](./03-migrations.md).

### 2d. State Transitions and the Splash

The `AppDb.setState()` method (db.ts:95-116) updates a Svelte writable store. The `+layout.svelte` component subscribes to this store and calls `window.__dbInitUpdate(phase)` to drive the splash screen:

```
apps/web-client/src/routes/+layout.svelte:54-58
```

The state machine:
```
Null --> Loading --> [Migrating -->] Ready
  \                                   |
   +----------> Error <--------------+
```

When `Ready` is set, two things happen simultaneously:
- The splash animates out (app.html:180-184)
- `AppDbRx.invalidate(db)` wires up the reactive subscription system (db.ts:110)

## Where the Time Goes: A Budget

| Step | Typical time | Notes |
|------|-------------|-------|
| I18n detection + load | ~50-100ms | Fast unless fetching overrides |
| WASM fetch (first load) | 500ms-2s | Depends on network; cached after |
| WASM compilation | 200-500ms | Browser JIT compiles WASM to native |
| VFS/OPFS handle acquisition | 50-500ms | Can be slow if stale locks exist |
| `sqlite.open(dbname)` | 50-200ms | Opens file, reads header |
| `PRAGMA integrity_check` | 100ms-2s | Linear scan of entire database |
| Schema check | <10ms | Simple query |
| Auto-migration (if needed) | 200ms-5s | Creates temp DB, diffs, applies |
| Sync worker spawn | 50-100ms | Parallel with above after Ready |
| **Total (warm cache, no migration)** | **~0.5-3s** | |
| **Total (cold cache, with migration)** | **~2-8s** | |

## Key Files

| File | Purpose |
|------|---------|
| `apps/web-client/src/app.html` | Splash screen HTML + state callback |
| `apps/web-client/src/routes/+layout.ts` | Entry point, calls `initApp()` |
| `apps/web-client/src/routes/+layout.svelte` | Bridges `AppDbState` to splash callback |
| `apps/web-client/src/lib/app/init.ts` | `initApp()` / `initAppImpl()` orchestration |
| `apps/web-client/src/lib/app/db.ts` | `AppDb` class, `initializeDb()`, state machine |
| `apps/web-client/src/lib/db/cr-sqlite/db.ts` | `getDB()`, schema version, change functions |
| `apps/web-client/src/lib/db/cr-sqlite/core/init.ts` | WASM loading, VFS factory, `getCrsqliteDB()` |

## Potential Improvements

See [06-known-issues.md](./06-known-issues.md) for a detailed analysis of what could be done to reduce loading time.
