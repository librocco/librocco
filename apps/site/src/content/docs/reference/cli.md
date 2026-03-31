---
title: CLI Reference
description: Rush and rushx commands for working with the Librocco monorepo.
---

## Rush commands

These commands are run from anywhere in the monorepo root.

### `rush update`

Installs and links all dependencies across the monorepo. Run this after:
- Cloning the repo for the first time
- Adding or removing a dependency in any `package.json`
- Pulling changes that modify `package.json` files

```bash
rush update
```

### `rush build`

Builds all packages that have a `build` script. Incremental — only rebuilds packages whose inputs have changed.

```bash
rush build
```

### `rush typecheck`

Runs TypeScript type checking (`tsc --noEmit`) across all packages.

```bash
rush typecheck
```

### `rush lint:strict`

Runs ESLint with `--max-warnings=0` across all packages. Used in CI.

```bash
rush lint:strict
```

### `rush format`

Runs Prettier across all packages.

```bash
rush format
```

### `rush check-workspace-projects`

Validates that all directories in `apps/`, `pkg/`, and `plugins/` are registered in `rush.json`. Run automatically as a pre-commit hook.

```bash
rush check-workspace-projects
```

---

## rushx commands

These commands are run from within a specific package directory.

### Web client (`apps/web-client`)

| Command | Description |
|---|---|
| `rushx start` | Start the dev server |
| `rushx build:prod` | Production build |
| `rushx test` | Run unit tests (Vitest) |
| `rushx test:ci` | Run unit tests in CI mode |
| `rushx story:dev` | Start Storybook |
| `rushx typecheck` | TypeScript check |

### Sync server (`apps/sync-server`)

| Command | Description |
|---|---|
| `rushx start` | Start the sync server |
| `rushx build` | Build the server |

### E2E tests (`apps/e2e`)

| Command | Description |
|---|---|
| `rushx test` | Run Playwright tests |
| `rushx test:ui` | Run tests with Playwright UI |
