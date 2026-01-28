# 3rd-Party Dependencies

This directory contains forked/modified third-party packages that are used by the librocco project. The packages are from the [vlcn.io](https://vlcn.io/) ecosystem (cr-sqlite, sync infrastructure, etc.).

## Directory Structure

```text
3rd-party/
├── artefacts/                    # Pre-built .tgz packages (committed to git)
│   ├── vlcn.io-crsqlite-*.tgz
│   ├── vlcn.io-ws-server-*.tgz
│   ├── ... other packages
│   └── version-cached.txt        # Hash marker for CI cache validation
├── artefacts_version.txt         # Current submodule hashes (for cache invalidation)
├── js/                           # Git submodule: vlcn.io/js monorepo
│   ├── packages/
│   │   ├── ws-server/            # WebSocket sync server
│   │   ├── ws-client/            # WebSocket sync client
│   │   └── ...
│   └── deps/
│       ├── cr-sqlite/            # CRSQLite extension
│       └── wa-sqlite/            # WebAssembly SQLite
└── typed-sql/                    # Git submodule: typed-sql package
```

## How It Works

### Package Resolution

Rush/pnpm uses `globalOverrides` in `common/config/rush/pnpm-config.json` to redirect all `@vlcn.io/*` package requests to the pre-built `.tgz` files in `artefacts/`:

```json
"globalOverrides": {
  "@vlcn.io/ws-server": "file:../../3rd-party/artefacts/vlcn.io-ws-server-0.2.2.tgz",
  ...
}
```

This means:
- All projects in the monorepo use the same version of vlcn packages
- The packages are installed from local tarballs, not from npm registry
- Changes to the source require rebuilding the tarballs

### CI/CD Workflow

1. **Cache Check**: CI runs `scripts/compare_artefacts_version.sh` to check if artefacts need rebuilding
2. **Version Tracking**: `artefacts_version.txt` contains git hashes of the submodules
3. **Rebuild Trigger**: If submodule hashes change, `scripts/build_vlcn.sh` rebuilds all packages
4. **Cache Storage**: Built artefacts are cached and shared across CI jobs

## Making Changes to 3rd-Party Packages

### Quick Development Workflow

For temporary changes during development:

1. **Edit the source** in `3rd-party/js/packages/<package>/src/`

2. **Build the package**:
   ```bash
   cd 3rd-party/js/packages/ws-server  # or whichever package
   pnpm install
   pnpm build
   ```

3. **Rebuild the tarball**:
   ```bash
   # From repo root
   ./scripts/build_vlcn.sh
   ```

   Or manually for a single package:
   ```bash
   cd 3rd-party/js/packages/ws-server
   pnpm pack
   cp *.tgz ../../artefacts/
   rm *.tgz
   ```

4. **Reinstall dependencies**:
   ```bash
   rush update --purge
   ```

### Permanent Changes

For changes that should persist:

1. Make changes in the submodule (`3rd-party/js/`)
2. Commit those changes in the submodule
3. Run `./scripts/build_vlcn.sh` to rebuild artefacts
4. Commit both the submodule reference and the new `.tgz` files

**Note**: The submodule points to a fork. If you need to update the upstream vlcn.io code:
1. Update the submodule to the desired commit
2. Rebuild artefacts
3. Commit the submodule reference change

### Troubleshooting

### "workspace:* dependency not found" errors during rush update

This happens when `npm pack` is run without first resolving workspace dependencies. The `build_vlcn.sh` script handles this by running `pnpm install` in the vlcn.io monorepo before packing.

### Changes not picked up after editing source

1. Make sure you ran `pnpm build` in the package directory
2. Make sure you regenerated the `.tgz` file
3. Run `rush update --purge` to force reinstall

### Hash mismatch errors in CI

This indicates the `artefacts_version.txt` doesn't match `artefacts/version-cached.txt`. This can happen if:
- Submodules were updated without rebuilding artefacts
- Artefacts were rebuilt without updating the version file
- CI cache is stale

Resolution: Run `./scripts/build_vlcn.sh` locally and commit both the new tarballs and updated version files.

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
- `scripts/build_vlcn.sh` - Builds all packages and updates artefacts
- `scripts/compute_artefacts_version.sh` - Computes version hash from submodule state
- `scripts/compare_artefacts_version.sh` - CI script to check if rebuild is needed
