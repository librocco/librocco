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
- `DENIED_CLIENT_VERSIONS`: comma-separated client build versions (git SHAs) refused at the sync WebSocket upgrade; the special token `unversioned` refuses clients that predate version announcement. Unset (the default) admits everyone. See "Client version gate" below before using.

## Client version gate

Clients announce their build version as a `client_version` query parameter on the sync
WebSocket URL. Every connection's version is logged; versions listed in
`DENIED_CLIENT_VERSIONS` are refused at the HTTP upgrade (401), before any sync protocol
runs — a denied client can neither push nor pull. Purpose: after a fix that requires the
whole fleet to run it (e.g. per-site id allocation, D-595), a straggler tab on the old
build can silently corrupt shared CRDT data; listing that build enforces the upgrade.

Operational notes — read before enabling:

- **The env is sampled at process startup only**, and the launcher snapshots its own
  environment: changing the variable in a shell and clicking "restart sync server" in the
  launcher will NOT pick it up. Set it where the launcher itself gets its environment,
  then relaunch. Verify what the running process actually loaded via
  `curl -s localhost:3000/health | grep -o '"deniedClientVersions":[^]]*]'`.
- **Rollback** is the same procedure with the variable unset. Because a mistake can
  disconnect tills, only change the list during a staffed window and re-check `/health`
  afterwards.
- **`unversioned` disconnects every pre-gate client at once.** Roll out the announcing
  client first, confirm every register's version appears in the connection logs, and only
  then add `unversioned` to the list.
- **A denied till keeps selling offline.** The gate stops live mixing, but the denied
  build keeps writing to its local DB; those writes sync as soon as the denial is lifted
  or the same DB is opened by an upgraded build. Before re-admitting a device, reload it
  on the fixed build — and if the denied build's writes are themselves the problem,
  remediate its local DB first. On the client, a denied connection currently surfaces as
  the generic "sync stuck" state (the pre-upgrade 401 carries no readable reason in the
  browser WebSocket API).

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
