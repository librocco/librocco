# 3rd-Party Dependencies

Librocco uses `@vlcn.io/*` packages from `npm.codemyriad.io` by default.  
Source mode is only for unpublished local changes and is never meant to be committed in manifests or lockfiles.
This document is the source of truth for that workflow. [`README.md`](../README.md) points here for the workflow; [`docs/vendor-registry-migration.md`](../docs/vendor-registry-migration.md) is migration/design background.

## Quick Start (Source Mode)

```bash
cd /path/to/librocco
./scripts/prepare_vlcn_source.sh
cd apps/web-client && rushx start
```

After `prepare_vlcn_source.sh` succeeds, Librocco commands auto-detect local vendor sources.
To go back to the registry-published packages:

```bash
./scripts/prepare_vlcn_source.sh --disable
```

For a non-standard local layout, use the escape hatch once during preparation:

```bash
./scripts/prepare_vlcn_source.sh --vlcn-root /absolute/path/to/vlcn-js
```

If `typed-sql` is not a sibling of that checkout, also pass `--typed-sql-root /absolute/path/to/typed-sql`.

## Edit-Test Loop (important)

1. Edit one of the Librocco-wired vendor packages listed in [Forked Package Inventory](#forked-package-inventory).
2. Rebuild the `vlcn-js` TypeScript outputs.

```bash
cd 3rd-party/js/tsbuild-all
pnpm build
```

3. Re-run the normal Librocco command you are working with:

```bash
cd apps/web-client && rushx start
cd apps/sync-server && rushx test:ci
cd apps/e2e && rushx test:ci
```

`prepare_vlcn_source.sh` is required when you first enter source mode, when switching to a different `vlcn-js` checkout, or after dependency/WASM changes.
For ordinary TypeScript edits inside `vlcn-js`, use `cd 3rd-party/js/tsbuild-all && pnpm build` instead of re-running the full prepare step.

Rush policy still applies to Librocco itself: use `rush` / `rushx` for Librocco commands.
`pnpm` is only for the upstream `vlcn-js` workspace because that repo is not Rush-managed.

## Resolution Paths by App

- `apps/web-client` (Vite config + vitest): local vendor resolution is applied by `scripts/vendor_source_config.mjs` during config loading.
- `apps/sync-server` and `apps/e2e`: their existing package scripts already wrap Node through `scripts/run_with_vendor_source.mjs`.
- Normal app commands stay the same; you do not manually wrap them yourself.

## Publishing and Roll-forward

For changes that should be available to everyone:
1. publish from the vlcn-js fork with `./scripts/publish_vlcn.sh <dev|myriad> [--dry-run]`;
2. repoint Librocco to the published exact versions:
   - `apps/web-client/package.json`
   - `apps/sync-server/package.json`
   - `apps/e2e/package.json`
   - `common/config/rush/pnpm-config.json`

## Forked Package Inventory

Only the 10 packages below are overridden in source mode.
`3rd-party/js/packages/` contains more directories than Librocco actually consumes; editing other packages will not affect Librocco unless Librocco starts importing them.

| Package | Description |
| --- | --- |
| `@vlcn.io/crsqlite` | CRSQLite native Node.js bindings |
| `@vlcn.io/crsqlite-wasm` | CRSQLite WebAssembly build |
| `@vlcn.io/wa-sqlite` | WebAssembly SQLite |
| `@vlcn.io/logger-provider` | Shared logger bridge |
| `@vlcn.io/ws-server` | WebSocket sync server |
| `@vlcn.io/ws-client` | WebSocket sync client |
| `@vlcn.io/ws-browserdb` | Browser database with sync |
| `@vlcn.io/ws-common` | Shared sync utilities |
| `@vlcn.io/rx-tbl` | Reactive table queries |
| `@vlcn.io/xplat-api` | Cross-platform database API |

## Related Files

- `common/config/rush/pnpm-config.json` – default overrides for registry-only installs
- `common/config/rush/.pnpmfile.cjs` – install-time peer dependency normalization
- `scripts/prepare_vlcn_source.sh` – enables/disables local source mode and prepares builds
- `scripts/publish_vlcn.sh` – publishes forked packages from vlcn-js source
