---
title: Environment Variables
description: All environment variables used by Librocco.
---

## Web client (`apps/web-client`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_SYNC_SERVER_URL` | No | — | WebSocket URL of the sync server (e.g. `ws://localhost:8080`) |
| `VITE_BOOK_DATA_PLUGIN` | No | — | Book data plugin to use (`google-books` or `open-library`) |
| `VITE_GOOGLE_BOOKS_API_KEY` | Conditional | — | Required if `VITE_BOOK_DATA_PLUGIN=google-books` |
| `VITE_GIT_SHA` | No | — | Git SHA injected at build time for version display |
| `PUBLIC_IS_DEBUG` | No | `false` | Enables debug mode UI |
| `PUBLIC_IS_E2E` | No | `false` | Enables E2E test mode (disables certain animations) |
| `PUBLIC_IS_DEMO` | No | `false` | Enables demo mode with pre-seeded data |
| `BASE_PATH` | No | `/` | Base path for the app, used for non-root deployments |

## Sync server (`apps/sync-server`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `8080` | WebSocket server port |
| `DB_PATH` | No | `./data/sync.db` | Path to the SQLite database file |
| `LOG_LEVEL` | No | `info` | Log level (`debug`, `info`, `warn`, `error`) |

## Setting environment variables

Create a `.env` file in the relevant app directory. These files are gitignored and should not be committed.

```bash
# apps/web-client/.env
VITE_SYNC_SERVER_URL=ws://localhost:8080
VITE_BOOK_DATA_PLUGIN=open-library
```

For CI, set variables in your GitHub Actions workflow secrets and reference them in the workflow YAML.
