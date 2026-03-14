# 3rd-Party Dependencies

This directory contains forked/modified third-party packages used by Librocco, mainly from the [vlcn.io](https://vlcn.io/) ecosystem (cr-sqlite, sync infrastructure, etc.).

Normal dependency delivery is registry-backed via `npm.codemyriad.io`.  
This repo still documents source-mode workflows for unpublished `@vlcn.io/*` changes and for legacy R2 artefact CI paths.

For normal work, use the registry path and the published versions declared in package manifests and `globalOverrides`.

## Local Source Mode

Use local source mode when Librocco needs to run against unpublished `@vlcn.io/*` changes:

1. Prepare the vendor checkout:
   ```bash
   ./scripts/prepare_vlcn_source.sh
   ```
2. Run Librocco with `VLCN_ROOT` pointing at the checkout you want:
   ```bash
   VLCN_ROOT=3rd-party/js cd apps/web-client && rushx start
   VLCN_ROOT=3rd-party/js cd apps/sync-server && rushx test:ci
   VLCN_ROOT=3rd-party/js cd apps/e2e && rushx test:ci
   ```

Notes:
- `VLCN_ROOT` is the preferred switch and can point at either the in-repo submodule or an external checkout.
- Source mode uses the exact checkout you point at. If `3rd-party/js` is behind the current `vlcn-js` source of truth, update that checkout first or point `VLCN_ROOT` at an external worktree.
- `USE_SUBMODULES=1` still works as a legacy shortcut for `VLCN_ROOT=3rd-party/js`.
- This mode is developer-only and should not require committed manifest or lockfile changes.

## Directory Structure

```text
3rd-party/
├── artefacts/                    # Legacy pre-built .tgz artefacts (legacy path only)
│   ├── vlcn.io-*.tgz
│   ├── version-cached.txt
│   └── ...
├── artefacts_version.txt         # Legacy hash marker for legacy R2 workflows
├── js/                           # Git submodule: vlcn.io/js monorepo
│   ├── packages/
│   │   ├── ws-server/
│   │   ├── ws-client/
│   │   └── ...
│   └── deps/
│       ├── cr-sqlite/
│       └── wa-sqlite/
└── typed-sql/                    # Git submodule: typed-sql package
```

## How It Works

### Registry Delivery Path

The default path is registry-based and uses published `@vlcn.io/*` versions from `npm.codemyriad.io`:

- `apps/web-client/package.json`
- `apps/sync-server/package.json`
- `apps/e2e/package.json`
- `common/config/rush/pnpm-config.json`

Do not commit changes to `3rd-party/artefacts` for normal dependency updates.

## Making Changes to 3rd-Party Packages

### Quick Development Workflow

For temporary local validation against unpublished `@vlcn.io/*` changes:

1. **Edit the source** in `3rd-party/js/packages/<package>/src/`
2. Prepare the vendor checkout:
   ```bash
   ./scripts/prepare_vlcn_source.sh
   ```
3. Run Librocco apps/tests with `VLCN_ROOT`:
   ```bash
   VLCN_ROOT=3rd-party/js cd apps/web-client && rushx start
   VLCN_ROOT=3rd-party/js cd apps/sync-server && rushx test:ci
   VLCN_ROOT=3rd-party/js cd apps/e2e && rushx test:ci
   ```

### Permanent Changes

For changes that should be shipped to every clone of Librocco, publish from the vlcn-js source of truth with
`./scripts/publish_vlcn.sh dev` (or `./scripts/publish_vlcn.sh dev --dry-run`) and then retarget Librocco dependencies to the published versions.

### Legacy Artefact Path

The files in `3rd-party/artefacts`, plus scripts like:

- `scripts/build_vlcn.sh`
- `scripts/compare_artefacts_version.sh`
- `scripts/artefacts-download.sh`

are legacy and retained for backward compatibility in some CI jobs. Prefer registry/source-mode workflows for new work.

### Troubleshooting

### Hash mismatch errors in legacy CI

If an old CI job fails on missing or mismatched artefacts, see
[`docs/developer-workflow-artefacts.md`](./../docs/developer-workflow-artefacts.md).

## Package List

| Package | Description |
|---------|-------------|
| `@vlcn.io/crsqlite` | CRSQLite native Node.js bindings |
| `@vlcn.io/crsqlite-wasm` | CRSQLite WebAssembly build |
| `@vlcn.io/wa-sqlite` | WebAssembly SQLite |
| `@vlcn.io/ws-server` | WebSocket sync server |
| `@vlcn.io/ws-client` | WebSocket sync client |
| `@vlcn.io/ws-browserdb` | Browser database with sync |
| `@vlcn.io/ws-common` | Shared sync utilities |
| `@vlcn.io/rx-tbl` | Reactive table queries |
| `@vlcn.io/xplat-api` | Cross-platform database API |

## Related Files

- `common/config/rush/pnpm-config.json` - Contains `globalOverrides` for package resolution
- `common/config/rush/.pnpmfile.cjs` - Normalizes lockfile paths for consistent specifiers
- `scripts/prepare_vlcn_source.sh` - Prepares local source-mode checkouts
- `scripts/publish_vlcn.sh` - Publishes forked packages from vlcn-js source
- `docs/developer-workflow-artefacts.md` - Legacy R2 artefact workflow reference
