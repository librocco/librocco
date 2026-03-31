---
title: Offline-First Design
description: How Librocco handles offline usage and data sync.
---

## What offline-first means

In Librocco, **offline is the default state** — not a fallback. Every operation (reading stock, recording sales, adding books) works without a network connection. Sync is a background process that happens opportunistically.

This is different from "offline mode" in apps that are primarily online — where offline is a degraded experience with limited functionality.

## CR-SQLite

The foundation is [CR-SQLite](https://github.com/vlcn-io/cr-sqlite), a SQLite extension that adds CRDT (Conflict-free Replicated Data Type) semantics to regular SQL tables.

Each row in a CR-SQLite table tracks:
- The value of each column
- A logical clock (Lamport timestamp) for that column
- The site ID of the device that last wrote the value

When two versions of a row are merged, the CRDT rules determine the winner — typically last-write-wins per column, based on the logical clock.

## Running in the browser

Librocco uses **OPFS** (Origin Private File System) to persist SQLite databases in the browser. This is a modern browser API that provides efficient, persistent, sandboxed file storage — fast enough for SQLite's read/write patterns.

The CR-SQLite WASM module runs in a Web Worker to avoid blocking the main thread.

## Sync protocol

Sync happens over WebSockets:

1. Client connects to the sync server and announces its current database version
2. Server sends any changes the client hasn't seen yet
3. Client sends its own unseen changes to the server
4. Both sides apply incoming changes using CR-SQLite's merge function
5. The connection stays open; new changes are streamed in real time

## Handling conflicts

Conflicts are resolved automatically by CR-SQLite's merge semantics. For inventory data:

- **Stock levels** use last-write-wins per cell — if two devices update the same book's quantity concurrently, the most recent update (by logical clock) wins
- **Deletions** are handled with tombstones — a deleted record is marked as deleted rather than removed, ensuring the deletion propagates correctly

In practice, conflicts are rare in a bookshop context — inventory changes tend to happen sequentially on a single device.
