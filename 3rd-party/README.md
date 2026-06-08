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

## Emergency Vendor Fix (Runbook)

When a production bug needs a fork change shipped fast (e.g. the D-302 sync gap-recovery fix):

1. Fix and commit in the `vlcn-js` fork (`3rd-party/js`); push to `codemyriad/vlcn-js` `librocco/main`.
2. Publish: `./scripts/publish_vlcn.sh dev` (requires publish auth, see [Registry Access](#registry-access)).
   Versions are stamped `<base>-dev.<yyyymmdd>.<shortsha>` under the `dev` dist-tag.
3. Re-pin the exact new versions in all four places:
   - `common/config/rush/pnpm-config.json` (`globalOverrides`)
   - `apps/web-client/package.json`, `apps/sync-server/package.json`, `apps/e2e/package.json`
4. `rush update` — regenerates `common/config/rush/pnpm-lock.yaml` and `repo-state.json`; commit both, never hand-edit them.
5. Validate against the *installed* packages (not the submodule source):
   - `cd apps/sync-server && rushx test:ci` (plain `rushx test` is vitest watch mode and never exits)
   - `cd apps/web-client && rushx typecheck`
6. Deploy the sync server.

### Publish gotcha: `@vlcn.io/crsqlite` prebuilt binary

`@vlcn.io/crsqlite` publishes from `deps/cr-sqlite/core` (the `codemyriad/cr-sqlite` fork). The
packaged-binary install helper and the `"binaries/**/*"` `files` entry are committed in the fork, but the
binary itself is a build artifact that must exist before publishing:

```bash
cd 3rd-party/js/deps/cr-sqlite/core
make loadable                                  # needs a rust toolchain
mkdir -p binaries/linux-x86_64 && cp dist/crsqlite.so binaries/linux-x86_64/
```

Without it the published package attempts a from-source build at install time and breaks `rush update`
on any machine without cargo. `publish_vlcn.sh` refuses to publish without the linux-x86_64 binary
(escape hatch: `ALLOW_MISSING_CRSQLITE_BINARY=true`). After publishing, always verify:

```bash
curl -s https://npm.codemyriad.io/@vlcn.io/crsqlite/-/crsqlite-<version>.tgz | tar tz | grep binaries
```

## Registry Access

- **Installs/reads are anonymous.** `rush update` needs no token: the `.npmrc` auth line references
  `${VERDACCIO_TOKEN}` and Rush omits lines whose environment variables are undefined.
- **Publishing requires auth**: an `//npm.codemyriad.io/:_authToken=...` entry in `~/.npmrc` (or
  `VERDACCIO_TOKEN` exported in the environment). Ask a maintainer for a token.
- **Registry down?** `rush update` fails fetching `@vlcn.io/*` metadata or tarballs from
  `npm.codemyriad.io` (fetch/meta errors, ECONNREFUSED, 5xx). Escape hatch: source mode builds the
  vendor packages locally — `./scripts/prepare_vlcn_source.sh`, see [Quick Start](#quick-start-source-mode).

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
