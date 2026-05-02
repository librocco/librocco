---
title: Development Guide
description: Day-to-day development workflow in the Librocco monorepo.
---

## Monorepo structure

```
librocco/
├── apps/
│   ├── web-client/     # SvelteKit frontend
│   ├── sync-server/    # WebSocket sync server
│   ├── e2e/            # Playwright end-to-end tests
│   └── site/           # This documentation site
├── pkg/
│   ├── shared/         # Shared utilities and types
│   └── scaffold/       # Shared tooling config
└── plugins/
    ├── book-data-extension/     # Plugin interface definition
    ├── google-books-api/        # Google Books plugin
    └── open-library-api/        # Open Library plugin
```

## Common commands

| Command | Description |
|---|---|
| `rush update` | Install/update all dependencies |
| `rush build` | Build all packages |
| `rush typecheck` | Run TypeScript checks across all packages |
| `rush lint:strict` | Run strict linting across all packages |
| `rush format` | Format all source files with Prettier |
| `rushx dev` | Start dev server (run from a package directory) |

## Adding a dependency

Navigate to the package that needs it and use `rush add`:

```bash
cd pkg/shared
rush add -p some-package
```

For dev dependencies:

```bash
rush add -p some-package --dev
```

Or add it manually to `package.json` and run `rush update`.

## Running tests

```bash
# Unit tests (from a package directory)
rushx test

# E2E tests
cd apps/e2e
rushx test
```

## Storybook

Component development uses Storybook:

```bash
cd apps/web-client
rushx story:dev
```

## Internationalisation

i18n is managed in `pkg/shared`. To regenerate type-safe i18n files:

```bash
cd pkg/shared
rushx typesafe-i18n
```
