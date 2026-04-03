# TODOS

Deferred work captured during engineering review.

---

## SharedWorker debug-export teardown

**What:** `writeDbBytesToOPFS` in `src/lib/utils/debug-export.ts:78` calls `disconnectAllPorts()` then waits 300ms before writing to OPFS. With SharedWorker, the OPFS SyncAccessHandle release is async (happens when the worker GC runs after all ports close). The 300ms is a timing race — works in practice on fast machines but is not deterministic.

**Why:** When the SharedWorker DB migration lands, this becomes a latent bug for the import-state-archive developer flow. On a slow device or under load, the 300ms may not be enough for the worker GC to release the handle, causing the OPFS write to fail.

**Fix:** Add a `wkr-close` message protocol:
1. Worker tracks `connectedPorts` count in `onconnect` / on `wkr-close` message
2. On `wkr-close` message from main thread: decrement count; when count hits 0, explicitly `await db.close()` (releases SyncAccessHandle), then send `wkr-close-ack`
3. Main thread: `disconnectAllPorts()` sends `wkr-close` to each port, awaits ack before proceeding with file write

**Files:** `src/lib/db/cr-sqlite/core/worker-db.worker.ts`, `src/lib/utils/debug-export.ts`

**Depends on:** SharedWorker DB migration landing first.

---

## Demo DB SharedWorker migration

**What:** `initializeDemoDb` in `src/lib/app/db.ts` uses `DEMO_VFS` (same `sync-opfs-coop-sync`) but a different DB file (`DEMO_DB_NAME`). It currently calls `getDBCore()` which goes through the worker path, but demo DB init has its own lifecycle separate from the main DB SharedWorker.

**Why:** After the main DB SharedWorker migration, demo DB still runs a DedicatedWorker. If a user opens demo mode in two tabs, they hit the same OPFS lock contention bug (just for the demo DB). Low probability but inconsistent.

**Fix:** Apply the same SharedWorker pattern to demo DB initialization. Same `onconnect`/`getOrInitDB` approach, different dbname key (`DEMO_DB_NAME---<vfs>`).

**Files:** `src/lib/app/db.ts` (`initializeDemoDb`), potentially `src/lib/db/cr-sqlite/core/worker-db.ts`

**Depends on:** SharedWorker DB migration landing and proving stable in production (at least one release cycle).
