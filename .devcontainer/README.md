# Librocco Devcontainer

## Quick Start

### Prerequisites
- [Docker](https://www.docker.com/products/docker-desktop/)

### IDEs with Dev Container support (VS Code, Zed, etc.)

Just open the repo and use the "Reopen in Container" command.

### Any other editor

Use the devcontainer CLI:

```bash
npm install -g @devcontainers/cli

# Start the container
devcontainer up --workspace-folder .

# Get a shell
devcontainer exec --workspace-folder . bash

# Or run commands directly
devcontainer exec --workspace-folder . rush build
```

Edit files with your editor on the host, run build commands in the container.

### What Happens
- **First time (~2-3 min)**: Downloads pre-built image from GHCR (~3GB), copies cached dependencies
- **Subsequent opens**: Instant startup (dependencies already in place)
- **Different branch with different deps**: Automatically detected and reconciled via `rush update`

### Common Commands
```bash
rush build              # Build all projects
rush typecheck          # Type check all projects
cd apps/web-client && rushx start    # Start web client (port 5173)
cd apps/sync-server && rushx start   # Start sync server (port 3000)
```

### Ports
| Port | Service |
|------|---------|
| 5173 | Web Client (Vite) |
| 3000 | Sync Server |
| 6006 | Storybook |

---

## Image Maintenance

This section is for contributors working on the devcontainer image itself.

### How It Works

1. **Image source**: Pre-built from `main` branch, hosted at `ghcr.io/librocco/librocco/devcontainer:latest`
2. **Developers pull, never build**: `devcontainer.json` uses `image:` not `build:`
3. **Branch compatibility**: The `init-workspace.sh` script detects lockfile changes and runs `rush update` if your branch has different dependencies

### CI Workflow

The workflow (`.github/workflows/devcontainer.yml`) rebuilds the image when:
- Push to `main` touches `.devcontainer/**` OR `common/config/rush/pnpm-lock.yaml`
- Any branch with `[build-devcontainer]` in the commit message (for testing before merge)
- Manual trigger via workflow dispatch

We keep a single `latest` tag to minimize GHCR storage quota.

### Testing Changes Locally

Before merging devcontainer changes, build the image the same way CI does:

```bash
# Build with devcontainer CLI (includes features from devcontainer.json)
devcontainer build --workspace-folder . --image-name ghcr.io/librocco/librocco/devcontainer:latest

# Test it
devcontainer up --workspace-folder .
devcontainer exec --workspace-folder . bash
```

This builds locally and tags as `ghcr.io/librocco/librocco/devcontainer:latest`, so `devcontainer up` uses your local image instead of trying to pull from GHCR.

Note: Plain `docker build` only builds the Dockerfile. The `devcontainer build` command also layers in the "features" (git-lfs, zsh) specified in `devcontainer.json`.

### Manual Rebuild

Go to Actions → "Devcontainer Build" → "Run workflow" on `main`.

### Dockerfile Architecture

Multi-stage build:
1. **Builder stage**: Installs Rush, runs `rush update --purge`, caches deps in `/prebuilt-cache/`
2. **Final stage**: Minimal image with Rush + git-lfs, copies only the cached deps

Key files:
- `Dockerfile` - Multi-stage build
- `init-workspace.sh` - First-run initialization (copies cache, detects lockfile changes)
- `devcontainer.json` - Config for IDEs and devcontainer CLI
- `../.dockerignore` - Excludes unnecessary files from build context
