# Sync: From Browser to Server and Back

This document covers the full sync pipeline: how changes leave the browser, reach the sync server, and return to other connected clients. It also covers the initial sync optimization and the FSNotify mechanism that caused the bug fixed in PR #1169.

## Architecture Overview

```
Browser A                           Sync Server                     Browser B
--------                           -----------                     --------
                                        |
Main Thread  <->  Sync Worker  <--> WebSocket <--> chokidar/FS  <->  Sync Worker  <->  Main Thread
  (UI)           (Web Worker)       (ws-server)    (FSNotify)        (Web Worker)        (UI)
                     |                  |                                |
              SyncTransport         dbCache                      SyncTransport
              Controller           (in-memory)                    Controller
                     |                  |                                |
              ChangesProcessor     touchHack                    ChangesProcessor
```

## The Sync Worker

The sync worker runs in a dedicated Web Worker thread. It's defined in:

```
apps/web-client/src/lib/workers/sync-worker.ts
```

### Initialization (lines 63-104)

When the main thread sends a `"start"` message, the worker:

1. **Resolves WASM artefacts** for the given VFS (line 65)
2. **Creates a `dbProvider`** -- a factory that, given a database name, loads the WASM module, creates the VFS, initializes cr-sqlite, and opens the database (lines 76-90)
3. **Wraps the transport provider** with `SyncTransportController` for chunking and progress tracking (lines 94-97)
4. **Calls `start(config)`** from `@vlcn.io/ws-client` to begin the sync loop (line 100)
5. **Sends `"ready"`** back to the main thread (line 103) -- without this, the main thread hangs forever waiting for `initPromise`

The critical detail: the sync worker creates its **own** database connection. It doesn't share the main thread's connection. The two connections share the same underlying file (via OPFS or IDB), but they are independent SQLite instances.

### Worker Communication

The `WorkerInterface` class (main thread side) manages bidirectional messaging:

```
apps/web-client/src/lib/workers/WorkerInterface.ts
```

**Outbound messages** (main -> worker):
- `start`: Initialize with VFS config
- `startSync` / `stopSync`: Begin or end syncing a specific database (inherited from `@vlcn.io/ws-client`)

**Inbound messages** (worker -> main):
- `changesReceived`: A batch of changes arrived from the server
- `changesProcessed`: A batch finished applying
- `progress`: Sync progress update (nProcessed/nTotal)
- `ready`: Worker initialized
- `connection.open` / `connection.close`: WebSocket state

## The SyncTransportController

```
apps/web-client/src/lib/workers/sync-transport-control.ts:129-213
```

This is a decorator around the raw `Transport` from `@vlcn.io/ws-client`. It adds two things:

### 1. Chunking via `ChangesProcessor`

When a large batch of changes arrives (e.g., during initial sync), applying them all at once would block the worker thread. The `ChangesProcessor` (lines 70-127) breaks them into chunks of `MAX_SYNC_CHUNK_SIZE = 1024` changes:

```typescript
enqueue({ _tag, sender, changes, since }: Changes) {
    for (const chunk of chunks(changes, this.#maxChunkSize)) {
        this.#queue.push({ _tag, sender, changes: chunk, since });
    }
    if (!this.#running) {
        this.#running = true;
        this._processQueue();
    }
}
```

Each chunk is processed sequentially via `_processQueue()` (lines 86-104). The `onChunk` callback triggers the actual application of changes to the local database.

### 2. Progress Tracking

The `SyncEventEmitter` (lines 9-36) broadcasts progress to the main thread. The main thread uses this to show the sync dialog (see `+layout.svelte:103-104`).

### 3. Connection Monitoring

The `ConnectionEventEmitter` (lines 38-57) tracks WebSocket open/close events. The main thread uses `WorkerInterface.isConnected` to show connectivity status.

## How Changes Flow

### Outbound (local change -> server)

1. User modifies data (e.g., adds a book to a note)
2. The modification writes to the local SQLite database via cr-sqlite
3. cr-sqlite automatically records the change in `crsql_changes` with the local `site_id`
4. The `@vlcn.io/ws-client` library detects new local changes and calls `transport.sendChanges()`
5. The `SyncTransportController` passes this through to the underlying WebSocket transport
6. The server receives the changeset and applies it to its copy of the database

### Inbound (server change -> local)

1. The server detects a change (via another client's push, or via FSNotify -- see below)
2. The server sends changesets over WebSocket to all connected clients
3. `transport.onChangesReceived` fires in the sync worker
4. `SyncTransportController._onChangesReceived()` enqueues the changes (line 183-185)
5. `ChangesProcessor` chunks and processes them sequentially
6. Each chunk is applied to the worker's database connection via `INSERT INTO crsql_changes`
7. After processing, `changesReceived` event is posted to the main thread
8. The main thread's `onChangesReceived` handler calls `app.db.rx.notifyAll()` to update the UI

That last step -- `notifyAll()` -- is the recent fix from commit `b87fcd3c`. See [04-reactivity.md](./04-reactivity.md) for details.

## Initial Sync Optimization

```
apps/web-client/src/lib/app/sync.ts:166-217
```

When a client connects for the first time (empty local database + OPFS-capable VFS), downloading a full snapshot is faster than streaming individual changesets:

```typescript
if (isEmpty && opfsSupported) {
    sync.state.set(AppSyncState.InitialSync);
    const fileUrl = getRemoteDbFileUrl(url, dbid);
    await _performInitialSync(dbid, fileUrl, sync.initialSyncProgressStore, async () => {
        shouldReload = true;
        await db.close();
    });
}
```

The `_performInitialSync` function (lines 222-281):

1. **Downloads the full database file** from `/{dbid}/file` on the sync server
2. **Stores it temporarily** in OPFS as `{dbid}-temp`
3. **Closes the current database** connection
4. **Deletes the old OPFS file** and renames the temp file
5. **Triggers a page reload** to reinitialize with the fresh database

After reload, `isEmptyDB()` returns false (the downloaded DB has data), so the optimization is skipped and normal WebSocket sync begins.

### Site ID Reidentification

After downloading the server's database, the client must establish its own identity. The `reidentifyDbNode()` function (in `core/utils.ts`) generates a new `site_id` and attributes all existing clock entries to the server. This ensures future local changes are tracked as originating from this client, not from the server.

## The Sync Server and FSNotify

The sync server (external repo, `@vlcn.io/ws-server` based) exposes:

- **WebSocket endpoint** for real-time changeset exchange
- **`/{dbid}/exec`** for dev/e2e RPC (execute SQL against the server's copy)
- **`/{dbid}/file`** for serving full database snapshots

### The FSNotify Mechanism

The server uses `chokidar` (file system watcher) to detect when database files change on disk. When a change is detected:

1. `chokidar` fires a file event with the full path
2. `fileEventNameToDbId()` converts the file path to a database ID
3. The server looks up connected WebSocket clients for that database ID
4. It pushes new changesets to those clients

### The Bug Fixed in PR #1169

The `fileEventNameToDbId` function was using `path.parse(filename).name`, which strips file extensions. For a database named `mydb.sqlite3`:

- **Listeners registered as:** `mydb.sqlite3` (the full database name)
- **FSNotify looked up:** `mydb` (extension stripped)

Result: no match, no notification, no sync. The fix changed to `path.basename(filename)`, which preserves the extension.

### touchHack

When changes arrive via the HTTP API (e.g., `/{dbid}/exec`), the database file might not actually change on disk if the data is only in the in-memory WAL. The `touchHack` forces a file modification timestamp update so that `chokidar` detects it:

```typescript
dbProvider.use(dbname, async (db) => {
    // ... apply changes ...
    touchHack(dbFilePath);  // ensures FSNotify fires
});
```

## Key Files

| File | Purpose |
|------|---------|
| `apps/web-client/src/lib/app/sync.ts` | `AppSync` class, `startSync()`, initial sync |
| `apps/web-client/src/lib/workers/sync-worker.ts` | Web Worker: WASM init, sync loop |
| `apps/web-client/src/lib/workers/WorkerInterface.ts` | Main thread proxy for worker communication |
| `apps/web-client/src/lib/workers/sync-transport-control.ts` | Chunking, progress, connection monitoring |
| `apps/web-client/src/lib/db/cr-sqlite/db.ts` | `getChanges()`, `applyChanges()` |
| `apps/web-client/src/lib/db/cr-sqlite/core/utils.ts` | `reidentifyDbNode()`, OPFS helpers |

## Threading Model

```
Main Thread                    Sync Worker Thread
-----------                    ------------------
App UI (Svelte)                @vlcn.io/ws-client loop
App DB connection              Worker DB connection
TblRx subscriptions           SyncTransportController
                               WebSocket I/O
                               ChangesProcessor

Shared: OPFS file (same database, independent connections)
Communication: postMessage() / onmessage
```

Both threads have their own SQLite WASM instance and their own connection to the same underlying file. The sync worker writes changesets from the server into its connection; the main thread reads data for the UI from its connection. Cross-thread notification happens via `postMessage` -> `onChangesReceived` -> `notifyAll()`.
