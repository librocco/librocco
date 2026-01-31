# Reactivity: From Database Writes to UI Updates

This document explains how changes to the SQLite database reach the Svelte UI. It covers two scenarios: local changes (user interaction) and remote changes (arriving via sync). The latter was broken until commit `b87fcd3c`.

## The Reactive Stack

```
SQLite write
    |
    v
cr-sqlite update hook  (fires on INSERT/UPDATE/DELETE)
    |
    v
TblRx  (@vlcn.io/rx-tbl)  (dispatches to matching listeners)
    |
    v
AppDbRx  (librocco wrapper)  (manages subscriptions, transfers on DB swap)
    |
    v
Svelte store / callback  (re-queries data, updates UI)
```

## TblRx: The Foundation

`TblRx` is from the `@vlcn.io/rx-tbl` package. It hooks into SQLite's update callback to detect when tables change. It provides three subscription types:

- **`onPoint(table, rowid, cb)`** -- fires when a specific row in a specific table changes
- **`onRange(tables, cb)`** -- fires when any row in any of the listed tables changes
- **`onAny(cb)`** -- fires on any change, with source information

When a local `INSERT`, `UPDATE`, or `DELETE` executes, SQLite's native update hook fires, TblRx determines which subscribers are affected, and calls their callbacks.

## AppDbRx: The Wrapper

```
apps/web-client/src/lib/app/rx.ts
```

`AppDbRx` wraps `TblRx` with two critical additions:

### 1. Subscription Persistence Across DB Swaps

When the database changes (e.g., after migration or initial sync), the underlying `TblRx` object must be replaced. But UI components shouldn't have to re-subscribe. The `RxListenerManager` (lines 37-91) solves this:

```typescript
transferToNewRx(next: TblRx | null) {
    for (const [id, listener] of this.#listeners.entries()) {
        this._unsubscribeSafe(id);  // unsub from old TblRx
        switch (listener._kind) {
            case "range":
                const unsubscribe = next?.onRange(tables, cb) || (() => {});
                this.set(id, { ...listener, unsubscribe });  // resub to new TblRx
                break;
            // ... similar for point and any
        }
    }
}
```

When `AppDb.setState(dbid, AppDbState.Ready, { db, vfs })` is called (db.ts:107-112), it invokes `rx.invalidate(db)`:

```typescript
invalidate(db: DBAsync) {
    // Notify all invalidate listeners (e.g., components that need to refetch)
    for (const cb of this.#invalidateListeners) cb();

    if (db != this.#db) {
        this.#db = db;
        this.#internal = tblrx(db);  // Create new TblRx for new DB
        this.#rxListeners.transferToNewRx(this.#internal);  // Transfer subscriptions
    }
}
```

### 2. The `notifyAll()` Method (Recent Fix)

**Problem:** When changes arrive via sync, they're applied in the sync worker's database connection, not the main thread's connection. The main thread's `TblRx` is hooked to the main thread's SQLite update callback, which doesn't fire for changes made by a different connection (even to the same file).

**Solution (commit `b87fcd3c`):** After sync changes are received, manually blast all listeners:

The main thread wires this up during sync initialization. In `+layout.svelte` or the sync setup code, `onChangesReceived` triggers `app.db.rx.notifyAll()`. This is currently implemented as a debounced call.

`notifyAll()` iterates every registered listener and invokes its callback with an empty update array:

```typescript
// Conceptual implementation within RxListenerManager
notifyAll() {
    for (const listener of this.#listeners.values()) {
        switch (listener._kind) {
            case "point":
            case "range":
                listener.cb([]);  // "something changed, please requery"
                break;
            case "any":
                listener.cb([], "thisProcess");
                break;
        }
    }
}
```

**Trade-offs of this approach:**
- It works -- the UI updates when sync changes arrive
- It's imprecise -- every listener fires, even if its table wasn't affected
- It can cause unnecessary re-queries for unrelated components
- The `"thisProcess"` source attribution for `onAny` is technically incorrect (the change came from sync, not this process)

## How Components Subscribe

A typical pattern in a Svelte component:

```typescript
// In +layout.svelte:123
disposer = getDbRx(app).onRange(["book_transaction"], async () => {
    stockCache.maybeInvalidate(await getDb(app));
});
```

This subscribes to changes on the `book_transaction` table. When a row changes (locally or via `notifyAll()`), the callback re-queries the stock cache.

The `getDbRx(app)` function (db.ts:276-281) throws if the DB isn't ready, ensuring components don't subscribe before initialization.

## The Invalidation Flow

### Local Change
```
User adds book to note
  -> db.exec("INSERT INTO book_transaction ...")
    -> SQLite update hook fires
      -> TblRx dispatches to onRange(["book_transaction"], cb)
        -> cb() re-queries and updates Svelte store
          -> UI re-renders
```

### Remote Change (Post-Fix)
```
Sync worker receives changeset from server
  -> Worker applies to its DB connection
    -> Worker posts "changesReceived" to main thread
      -> Main thread: app.db.rx.notifyAll()
        -> ALL listeners fire (imprecise but correct)
          -> Each cb() re-queries from main thread's DB
            -> Main thread's DB sees the new data (shared OPFS file)
              -> UI re-renders
```

### Remote Change (Pre-Fix -- Broken)
```
Sync worker receives changeset from server
  -> Worker applies to its DB connection
    -> Worker posts "changesReceived" to main thread
      -> Main thread: ??? (nothing triggered notifyAll)
        -> TblRx never fires (no local update hook triggered)
          -> UI doesn't update
            -> User must reload to see changes
```

## The Cross-Thread Data Visibility Question

A subtle but important point: when the sync worker writes to its database connection and the main thread re-queries from its own connection, **does the main thread see the worker's writes?**

Yes, because both connections share the same OPFS file (or IDB store). SQLite's WAL (Write-Ahead Log) mode ensures that readers see the latest committed data. The main thread may need to re-open its read transaction to see new data, but `TblRx` callbacks typically trigger new queries that establish new read snapshots.

## Key Files

| File | Purpose |
|------|---------|
| `apps/web-client/src/lib/app/rx.ts` | `AppDbRx`, `RxListenerManager`, `notifyAll()` |
| `apps/web-client/src/lib/app/db.ts` | `setState()` calls `rx.invalidate()` on Ready |
| `apps/web-client/src/routes/+layout.svelte` | Root subscription setup (`onRange`, `onMount`) |
| `apps/web-client/src/lib/workers/WorkerInterface.ts` | `onChangesReceived` event relay |
| `@vlcn.io/rx-tbl` (external) | `TblRx` -- SQLite update hook -> subscriber dispatch |
