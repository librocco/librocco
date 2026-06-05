# Sync Server

WebSocket sync server for Librocco databases (CR-SQLite based).

## Commands

- Build: `rushx build`
- Start (production mode): `rushx start`
- Start (dev mode with RPC endpoint): `rushx start:dev`
- Tests: `rushx test` / `rushx test:ci`

## Startup flow

On startup, the server runs these steps in order:

1. Ensure `DB_FOLDER` exists.
2. Run startup health checks (unless `SKIP_HEALTH_CHECK=true`).
3. For databases with stale/unknown schema metadata, back up the DB (via SQLite backup API) and sidecar files.
4. Open every existing `*.sqlite3`, `*.sqlite`, and `*.db` file in `DB_FOLDER`.
5. Let `@vlcn.io/ws-server` auto-migrate each database to the current schema version.
6. Start listening for HTTP/WebSocket traffic.

If a migration fails for any existing database, startup fails and the server does not begin serving requests.
Backup runs are reused per schema target version, so repeated failed restarts do not create duplicate backup directories.

## Environment variables

- `PORT`: HTTP port (default `3000`)
- `DB_FOLDER`: database folder path (default `./test-dbs`)
- `SCHEMA_FOLDER`: schema folder path (default `./schemas`)
- `SCHEMA_NAME`: schema file name in `SCHEMA_FOLDER` (default `init`)
- `IS_DEV=true`: enables dev-only RPC endpoints
- `READONLY_QUERY_API=false`: disables `POST /:dbname/readonly-query` (enabled by default)
- `SKIP_HEALTH_CHECK=true`: disables startup health checks
- `STARTUP_MIGRATION_BACKUP_FOLDER`: optional explicit backup folder (default `DB_FOLDER/.startup-migration-backups`)
- `STARTUP_MIGRATION_MAX_BACKUP_RUNS`: number of backup run directories to retain (default `5`)

## Read-only query API

The read-only query API is enabled by default and is available at:

```http
POST /:dbname/readonly-query
Content-Type: application/json

{
  "sql": "SELECT * FROM book WHERE updated_at > ? ORDER BY updated_at ASC",
  "bind": [1234567890]
}
```

The endpoint only accepts SQLite reader statements and executes them with `PRAGMA query_only = ON`.
It exists for external integrations that need authoritative reads through the sync server's active DB connection without enabling the dev-only generic `/exec` endpoint.
