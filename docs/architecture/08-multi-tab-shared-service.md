# Multi-Tab Support via Shared Service Pattern

This document assesses the multi-tab OPFS lock contention problem, explains why placing SQLite directly inside a SharedWorker does not work, and outlines a minimal implementation plan based on the "shared service" pattern from the wa-sqlite community.

## The Problem

Librocco uses the `sync-opfs-coop-sync` VFS, which holds an exclusive OPFS `SyncAccessHandle`. Only one JavaScript context can hold it at a time. When a second tab opens, the cooperative handoff via `BroadcastChannel` fails under Chrome's background-tab throttling (30s+ delays), causing `ErrDBInitTimeout`.

## Why SharedWorker Doesn't Solve It

PR #1234 attempted to fix this by placing the SQLite database directly inside a `SharedWorker`. The idea: one SharedWorker instance shared across all tabs holds the OPFS lock permanently, and each tab connects via a `MessagePort`.

This approach is fundamentally flawed:

1. **`createSyncAccessHandle()` is spec-restricted to `DedicatedWorkerGlobalScope`**. The [File System Access spec](https://fs.spec.whatwg.org/#api-filesystemfilehandle) explicitly excludes `SharedWorkerGlobalScope`. As the wa-sqlite maintainer explains: "Ideally the database could go into a SharedWorker but unfortunately that won't work because OPFS `FileSystemSyncAccessHandle` isn't available in SharedWorker."

2. **Firefox fails immediately** -- the PR's own compatibility table shows Firefox falls back to `DedicatedWorker`, meaning the multi-tab fix is not applied there.

3. **Chrome may work today under `crossOriginIsolated=true`** (with COOP/COEP headers), but this is non-spec behaviour that could be reverted. It also restricts cross-origin resource loading (book covers, ISBN APIs).

4. **Playwright headless Chromium fails** -- making the fix untestable in CI without falling back to `DedicatedWorker`.

In every fallback case, we're back to the original lock contention problem.

## The Shared Service Pattern

The correct approach, outlined in [wa-sqlite discussion #81](https://github.com/rhashimoto/wa-sqlite/discussions/81) and its [demo](https://github.com/rhashimoto/wa-sqlite/tree/master/demo/SharedService), keeps the database in a **DedicatedWorker** (where `createSyncAccessHandle` is guaranteed) and multiplexes all tabs' requests to it via leader election.

### Architecture

```
Tab 1 (leader)     Tab 2 (client)     Tab 3 (client)
  |                   |                   |
  | owns              | MessagePort       | MessagePort
  v                   | (via relay)       | (via relay)
DedicatedWorker  <----+-------------------+
  |
  +-- SQLite DB (OPFS SyncAccessHandle)
  +-- SyncRuntime (embedded in same worker)
```

Three Web APIs coordinate:

| API | Role |
|-----|------|
| **Web Locks** | Leader election -- `navigator.locks.request('librocco-db-<name>')`. Exactly one tab wins; others queue. Auto-promotes when leader tab closes. |
| **BroadcastChannel** | Signaling -- leader announces itself; client tabs request `MessagePort`s. |
| **SharedWorker** (~20 lines) | Port-forwarding relay -- routes `MessagePort`s from leader to clients. (BroadcastChannel can't transfer ports.) Falls back to ServiceWorker or BroadcastChannel-only on Android. |

The SharedWorker here is a trivial relay -- it forwards ports, not runs SQLite.

### Leader Migration

When the leader tab closes:

1. Web Lock auto-releases, next queued tab becomes leader
2. New leader spawns a fresh DedicatedWorker (opens same OPFS file)
3. Announces itself via BroadcastChannel
4. Client tabs get new MessagePorts routed to the new worker
5. Client tabs re-initialize their DB connection (see below)

## Why This Is Simpler Than It Looks (in our context)

Several properties of the librocco codebase make leader migration tractable:

### 1. Sync lives inside the DB worker

`SyncRuntime` and `SharedConnectionSyncDB` are embedded in the same `DedicatedWorker` as SQLite (`worker-db.worker.ts`). One worker = one unit to migrate. No need to coordinate separate workers.

### 2. All DB access is already Comlink-over-MessagePort

The main thread never touches SQLite directly. Every `db.execO()`, `db.tx()`, etc. is a Comlink RPC call over a `MessagePort`. Adding another hop (via the relay) is transparent to callers.

### 3. Transactions are fully worker-contained

`db.tx(callback)` executes entirely inside the worker. No transaction state leaks across the Comlink boundary. When the worker dies, any in-flight transaction either completed or didn't -- there's no half-committed state visible to the main thread.

### 4. cr-sqlite is a CRDT

Changes are conflict-free and idempotent. A transaction lost during migration can be safely retried without risk of duplication. The sync protocol will catch up from the server regardless.

### 5. OPFS persists across worker death

The database file survives worker termination. The new leader opens the same file and picks up where the old one left off. No data loss.

### 6. The app already has a re-initialization state machine

`AppDb` (Null -> Loading -> Ready) handles full DB initialization including schema checks and sync startup. Rather than trying to transparently hot-swap the Comlink proxy (which would require re-preparing statements, refreshing the mutex, re-wiring event subscriptions), we re-run the init sequence. It's fast because the DB already exists on OPFS.

## Implementation Plan

### Step 1: SharedService relay (~150-200 lines)

A generic `SharedService` class (no librocco-specific logic) that:

- Acquires a named Web Lock for leader election
- Broadcasts provider announcements on a `BroadcastChannel`
- Uses a tiny SharedWorker (~20 lines) to forward `MessagePort`s between tabs
- Emits a `"provider-change"` event when leadership changes
- Exposes `activate()` / `deactivate()` / `close()` lifecycle

Reference implementations exist: the [wa-sqlite demo](https://github.com/rhashimoto/wa-sqlite/tree/master/demo/SharedService), [Matt-TOTW/shared-service](https://github.com/Matt-TOTW/shared-service), and [sampbarrow/observable-worker](https://github.com/sampbarrow/observable-worker).

### Step 2: Multi-port support in the DedicatedWorker

`worker-db.worker.ts` currently does `Comlink.expose(db)` on `self` (the single port). Change it to accept incoming `MessagePort`s and `Comlink.expose(db, port)` on each one. The leader tab sends a "new-client" message with a `MessagePort`; the worker exposes the DB on it.

### Step 3: Modify `worker-db.ts` -- two paths

```
getWorkerDB(dbname, vfs)
+-- SharedService.activate()       // participate in leader election
+-- Am I the leader?
|   +-- YES: spawn DedicatedWorker, register port factory with SharedService
|   +-- NO:  get MessagePort via SharedService relay -> leader's worker
+-- Comlink.wrap(port)             // same as today, same WorkerDB class
```

The `WorkerDB` class stays almost unchanged. The existing `teardown: () => void` abstraction already decouples it from the specific cleanup mechanism.

### Step 4: Migration handler

Wire the SharedService `"provider-change"` event to the app layer:

1. SharedService fires `"provider-change"`
2. `worker-db.ts` closes the stale port
3. `AppDb` state -> `Loading` (existing state machine)
4. Re-runs `initializeDb()` -> `getWorkerDB()` (connects to new leader's worker)
5. Sync restarts via existing `initializeSync()` flow
6. `AppDb` state -> `Ready`, splash screen dismissed

This is safe because:

- In-flight Comlink calls reject with a port-closed error -- callers see a transient failure during the brief re-init window
- `db.tx()` either completed before the worker died or didn't -- CRDT idempotency means retry is safe
- Sync's `@vlcn.io/ws-client` already handles connection drops and re-syncs from last-seen version
- Prepared statements and the mutex are re-created during init

### Step 5: Tests

| Scenario | What it verifies |
|----------|------------------|
| 2 tabs open | Both reach `db_ready` without timeout |
| Close leader tab | Client tab auto-promotes, spawns new worker, reaches `db_ready` |
| 3 tabs, close leader | Both remaining tabs recover |
| Reload leader tab | New leader elected, other tabs recover |

## What Is NOT Needed

- **Transaction ID / idempotency tables** -- cr-sqlite's CRDT semantics already handle duplicate writes. The `crsql_changes` table is conflict-free by design.
- **Transparent proxy hot-swap** -- Re-initialization via the existing `AppDb` state machine is simpler and more robust than keeping the same `WorkerDB` instance alive across migrations.
- **COOP/COEP headers** -- `createSyncAccessHandle` runs in a DedicatedWorker where it's guaranteed to work. No `crossOriginIsolated` needed. No cross-origin resource loading restrictions.
- **Complex connection state recovery** -- No temp tables or ATTACHed databases to re-establish. The only persistent state is the OPFS file.

## Risk Assessment

| Area | Risk | Mitigation |
|------|------|------------|
| Migration during sync changeset application | Transaction in worker may be mid-commit | Worker death = transaction rolled back by OS. New leader re-syncs from server via last-seen tracking. |
| Brief UX flash on migration | Splash screen re-appears (~100-200ms) | Init from existing OPFS DB is fast. Could add a lightweight "reconnecting" state instead of full splash. |
| Android (no SharedWorker) | Port-forwarding relay unavailable | BroadcastChannel-only fallback (messages go to all tabs, heavier but functional), or ServiceWorker relay. |
| In-flight Comlink calls during migration | Calls reject with port-closed error | Callers already handle async errors. Could add retry-once wrapper at the `WorkerDB` level. |

## References

- [wa-sqlite discussion #81: "Using a shared Worker (instead of SharedWorker)"](https://github.com/rhashimoto/wa-sqlite/discussions/81)
- [wa-sqlite SharedService demo](https://github.com/rhashimoto/wa-sqlite/tree/master/demo/SharedService)
- [wa-sqlite SharedService-sw demo (ServiceWorker variant)](https://github.com/rhashimoto/wa-sqlite/tree/master/demo/SharedService-sw)
- [File System Access spec: createSyncAccessHandle](https://fs.spec.whatwg.org/#api-filesystemfilehandle) (DedicatedWorker only)
