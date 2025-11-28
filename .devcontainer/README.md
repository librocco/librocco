# Librocco Devcontainer

Fast, reproducible development environment for the Librocco monorepo.

## What's Included

- **Node 20.19.2** (matches CI)
- **Rush 5.102.0** (monorepo manager)
- **git-lfs** (for LFS files)
- **VS Code extensions**: Svelte, ESLint, Prettier, GitHub Actions

## Files

- **`Dockerfile`** - Lightweight container image (~3GB). No prebundled dependencies - they're installed on first container creation for reliability.
- **`devcontainer.json`** - VS Code configuration, extensions, and lifecycle hooks
- **`.dockerignore`** - Optimizes Docker build context

## First Time Setup

1. Open repo in VS Code
2. Command Palette → "Dev Containers: Reopen in Container"
3. Wait ~5-7 minutes (image build + `rush update`)
4. Ready to code!

## Subsequent Opens

Container reuses installed dependencies → **instant startup** ⚡

## Common Commands

```bash
rush build          # Build all projects
rush typecheck      # Type check all projects
cd apps/web-client
rushx start         # Start Vite dev server (port 5173)
cd apps/sync-server
rushx start         # Start sync server (port 3000)
```

## Build State Isolation

The `common/temp/` directory (where Rush stores build state and pnpm cache) is mounted as an isolated Docker volume, **not** from your host filesystem.

**Why?**
- ✅ **No host state interference**: Works regardless of what's on your local machine
- ✅ **No path mismatches**: Eliminates "pnpm store path changed" errors
- ✅ **Persists across rebuilds**: Subsequent container opens are instant
- ✅ **True isolation**: Container is self-contained, as it should be

**Trade-off:**
- Can't inspect `common/temp/` from host (this is intentional!)
- Source code and config files (like `common/config/rush/pnpm-lock.yaml`) remain on host as expected

This design ensures the devcontainer works for **everyone**, regardless of local development setup or existing build state.
