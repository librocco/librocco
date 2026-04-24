---
title: Architecture Overview
description: How Librocco's components fit together.
---

Librocco is built around a single guiding principle: **the local database is the source of truth**. The network is optional.

## High-level diagram

```
┌─────────────────────────────────────┐
│           Web Client (SvelteKit)    │
│                                     │
│  ┌─────────────┐  ┌──────────────┐  │
│  │   UI Layer  │  │  DB Package  │  │
│  │  (Svelte +  │  │  (CR-SQLite) │  │
│  │  Tailwind)  │  └──────┬───────┘  │
│  └─────────────┘         │          │
└────────────────────────  │  ────────┘
                           │ WebSocket
                    ┌──────▼───────┐
                    │  Sync Server │
                    │  (Node.js)   │
                    └──────────────┘
```

## Components

### Web client (`apps/web-client`)

A SvelteKit application that runs entirely in the browser. It owns a local SQLite database (via OPFS — Origin Private File System) and communicates with the sync server over WebSockets when available.

The UI is built with Svelte components styled with Tailwind CSS. Storybook is used for component development.

### DB package (`pkg/db` via CR-SQLite)

The database layer wraps CR-SQLite, which extends SQLite with CRDT-based conflict resolution. This is what makes offline-first sync possible — concurrent changes from different devices are merged without conflicts.

The package exposes a typed interface that the web client and sync server both use.

### Sync server (`apps/sync-server`)

A Node.js WebSocket server that acts as a relay and persistent store for sync operations. It:

- Accepts connections from web clients
- Broadcasts changes between connected clients
- Persists changes so clients that were offline can catch up
- Runs health checks and handles schema migrations on startup

### Plugins (`plugins/`)

Book data plugins implement a standard interface (`@librocco/book-data-extension`) and are loaded by the web client to fetch book metadata by ISBN. They are optional — the app works without them.

## Data flow

1. User makes a change (e.g. adds stock) in the web client
2. Change is written to the local CR-SQLite database immediately
3. If the sync server is connected, the change is sent over WebSocket
4. The sync server broadcasts the change to other connected clients
5. Each client merges the incoming change into its local database using CR-SQLite's CRDT merge

If the sync server is offline, steps 3–5 are deferred until connectivity is restored.
