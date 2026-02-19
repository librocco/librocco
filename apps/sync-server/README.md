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
3. Open every existing `*.sqlite3`, `*.sqlite`, and `*.db` file in `DB_FOLDER`.
4. Let `@vlcn.io/ws-server` auto-migrate each database to the current schema version.
5. Start listening for HTTP/WebSocket traffic.

If a migration fails for any existing database, startup fails and the server does not begin serving requests.

## Environment variables

- `PORT`: HTTP port (default `3000`)
- `DB_FOLDER`: database folder path (default `./test-dbs`)
- `SCHEMA_FOLDER`: schema folder path (default `./schemas`)
- `IS_DEV=true`: enables dev-only RPC endpoints
- `SKIP_HEALTH_CHECK=true`: disables startup health checks
