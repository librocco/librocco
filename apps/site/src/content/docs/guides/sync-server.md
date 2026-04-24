---
title: Sync Server
description: Set up the WebSocket sync server for multi-device inventory sync.
---

The sync server enables **real-time, conflict-free sync** between multiple Librocco clients using CR-SQLite replication over WebSockets.

## How it works

Each client maintains a full local SQLite database. When connected to the sync server, changes are broadcast to other connected clients and merged using CR-SQLite's CRDT-based conflict resolution. No change is ever lost — concurrent edits from different devices are reconciled automatically.

## Running the sync server

```bash
cd apps/sync-server
rushx start
```

The server starts on `ws://localhost:8080` by default.

## Configuration

| Environment variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | WebSocket port |
| `DB_PATH` | `./data/sync.db` | Path to the server-side SQLite database |
| `LOG_LEVEL` | `info` | Log verbosity (`debug`, `info`, `warn`, `error`) |

Create a `.env` file in `apps/sync-server/`:

```bash
PORT=8080
DB_PATH=./data/sync.db
LOG_LEVEL=info
```

## Connecting a client

Point the web client at the sync server:

```bash
# apps/web-client/.env
VITE_SYNC_SERVER_URL=ws://localhost:8080
```

Restart the dev server after changing environment variables.

## Offline behaviour

If the sync server is unreachable, the client continues to work normally. All changes are recorded locally. When the connection is restored, pending changes are automatically synced.

## Production deployment

For production, the sync server can be deployed as a standard Node.js process behind a reverse proxy (nginx, Caddy) with WebSocket support enabled.

Health check endpoint: `GET /health` — returns `200 OK` when the server is ready.
