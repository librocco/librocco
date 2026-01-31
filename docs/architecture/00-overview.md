# Librocco Architecture: The Life of a Page Load

This is a technical deep-dive into how Librocco starts up, stores data, syncs it across devices, and keeps the UI in lockstep with the database. It was written to equip you to tackle two specific problems:

1. **The loading screen takes too long** -- why does the splash screen linger?
2. **Two browsers showed different books on the same outbound note** -- how can a CRDT-synced app show inconsistent state?

Each document below covers one slice of the system. They reference each other frequently, because the pieces are deeply entangled.

## Documents

| # | Document | What it covers |
|---|----------|----------------|
| 1 | [DB Initialization](./01-db-initialization.md) | From splash screen to `AppDbState.Ready`: WASM loading, VFS selection, schema application, integrity checks. **Start here for the slow-loading issue.** |
| 2 | [Sync](./02-sync.md) | WebSocket sync via a Web Worker, the `SyncTransportController` chunking pipeline, initial sync optimization, and the FSNotify mechanism on the server. |
| 3 | [Migrations](./03-migrations.md) | Hash-based schema versioning, the JavaScript port of `crsql_automigrate`, and the `begin_alter`/`commit_alter` dance for CRDT tables. |
| 4 | [Reactivity](./04-reactivity.md) | How `TblRx` subscriptions flow from database writes to Svelte stores, the `notifyAll()` fix for sync-driven changes, and the `RxListenerManager` transfer mechanism. |
| 5 | [CRDT Conflict Resolution](./05-crdt-conflict-resolution.md) | Last-Write-Wins semantics, the `crsql_changes` virtual table, causal clocks, site IDs, and what can go wrong. **Start here for the inconsistent-note issue.** |
| 6 | [Diagnosis: Known Issues](./06-known-issues.md) | Detailed analysis of both target issues with root causes, contributing factors, and potential improvements. |
| 7 | [Sync User Requirements](./07-sync-user-requirements.md) | User-facing sync requirements, gap analysis, and implementation roadmap. **Start here for sync indicator and pending changes tracking.** |

## The 30-Second Picture

```
Browser Tab
  +layout.ts -----> initApp()
                       |
               +-------+--------+
               |                 |
          initializeDb()    initializeSync()
               |                 |
         getDBCore()         SyncWorker
               |             (Web Worker)
        WASM + VFS load          |
               |          WebSocket <---> Sync Server
          schema check                     (chokidar)
               |                              |
         AppDbState.Ready             FSNotify -> touchHack
               |                              |
          TblRx wired              changeset push/pull
               |                              |
          Svelte stores <---- notifyAll() <---+
               |
            UI render
```

Everything below unpacks this diagram.
