# 3rd-Party Dependencies

Librocco uses `@vlcn.io/*` packages from `npm.codemyriad.io` by default.  
Source mode is only for unpublished local changes and is never meant to be committed in manifests or lockfiles.

## Quick Start (Source Mode)

```bash
cd /path/to/librocco
./scripts/prepare_vlcn_source.sh
VLCN_ROOT=3rd-party/js cd apps/web-client && rushx start
```

Use `VLCN_ROOT` to point to the exact vlcn-js checkout you want to test:
- `VLCN_ROOT=3rd-party/js` for the in-repo submodule.
- `VLCN_ROOT=/absolute/path/to/worktree` for an external `vlcn-js` worktree.

`USE_SUBMODULES` is intentionally kept as a legacy shortcut (`USE_SUBMODULES=1`) and maps to `VLCN_ROOT=3rd-party/js`. Prefer explicit `VLCN_ROOT`.

## Edit-Test Loop (important)

1. Edit a package source file under `3rd-party/js/packages/<name>/src/...`.
2. Rebuild the changed package (plus any local dependencies it imports).

```bash
cd 3rd-party/js/packages/<package>
pnpm build

# example: ws-server edits often need logger-provider first
cd ../logger-provider && pnpm build
cd ../ws-server && pnpm build
```

3. Restart the target app/test with `VLCN_ROOT`:

```bash
VLCN_ROOT=3rd-party/js cd apps/web-client && rushx start
VLCN_ROOT=3rd-party/js cd apps/sync-server && rushx test:ci
VLCN_ROOT=3rd-party/js cd apps/e2e && rushx test:ci
```

`prepare_vlcn_source.sh` is required when you first enter source mode or after dependency graph setup changes; it is not required after every single source edit.

## Resolution Paths by App

- `apps/web-client` (Vite config + vitest): uses `./scripts/vendor_source_config.mjs` Vite aliases.
- `apps/sync-server` and `apps/e2e` (runtime tests/tools): use `node --import` hooks via `run_with_vendor_source.mjs`.

## Publishing and Roll-forward

For changes that should be available to everyone:
1. publish from the vlcn-js fork with `./scripts/publish_vlcn.sh <dev|myriad> [--dry-run]`;
2. repoint Librocco to the published exact versions:
   - `apps/web-client/package.json`
   - `apps/sync-server/package.json`
   - `apps/e2e/package.json`
   - `common/config/rush/pnpm-config.json`

## Legacy Artefact Path (Legacy / CI-only)

`3rd-party/artefacts` and scripts under `scripts/` (`build_vlcn.sh`, `compare_artefacts_version.sh`, `artefacts-download.sh`, `artefacts-upload.sh`) remain for legacy R2 lanes only and are not part of normal developer flow.
If one of those lanes is failing, use [`docs/developer-workflow-artefacts.md`](../docs/developer-workflow-artefacts.md).

## Forked Package Inventory

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
- `common/config/rush/.pnpmfile.cjs` – lockfile specifier normalization
- `scripts/prepare_vlcn_source.sh` – bootstraps local source mode
- `scripts/publish_vlcn.sh` – publishes forked packages from vlcn-js source
- `docs/developer-workflow-artefacts.md` – legacy R2 workflow reference
