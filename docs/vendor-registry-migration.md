# Vendor Registry Migration

This document tracks the repo-specific migration to published package versions from `https://npm.codemyriad.io/`.

Current default behavior is registry-first with `3rd-party/artefacts` retained only for explicit legacy flows.
Source-mode workflow details for local unpublished edits live in [`3rd-party/README.md`](../3rd-party/README.md).

## Why this migration exists

The current repo uses exact direct dependency versions in consumer manifests and uses Rush `globalOverrides` to keep registry versions consistent across the monorepo.

That creates one critical hazard:

- the same `name@version` now maps to a single published artifact in default install paths

That requirement is now enforced by always publishing forked content under unique versions.

## Current repo state

These facts are true in the current tree:

- [`common/config/rush/pnpm-config.json`](../common/config/rush/pnpm-config.json) routes all `@vlcn.io/*` packages to published versions on `npm.codemyriad.io`.
- [`apps/web-client/package.json`](../apps/web-client/package.json), [`apps/sync-server/package.json`](../apps/sync-server/package.json), and [`apps/e2e/package.json`](../apps/e2e/package.json) already pin exact `@vlcn.io/*` dependency versions.
- [`apps/web-client/svelte.config.js`](../apps/web-client/svelte.config.js) and [`apps/web-client/vitest.config.ts`](../apps/web-client/vitest.config.ts) keep `USE_SUBMODULES` as a local-only legacy shortcut.
- [`python-apps/launcher/scripts/package_syncserver_for_build.py`](../python-apps/launcher/scripts/package_syncserver_for_build.py) uses registry versions.
- [`scripts/build_vlcn.sh`](../scripts/build_vlcn.sh), [`scripts/artefacts-download.sh`](../scripts/artefacts-download.sh), and some workflow templates under [`.github/workflow.templates`](../.github/workflow.templates) remain for legacy lanes only.

## Verified migration blocker

`npm.codemyriad.io` is already reachable and anonymously readable for both public npm packages and the current `@vlcn.io/*` versions Librocco uses.

Legacy tarball flows are intentionally retained only for explicit workflows (`vfs-benchmark`, `playwright-matrix`, `fix-playwright`, `ci-debug`).

## Rules for the new system

1. Every fork content change must publish a new version.
2. Never publish different bits under an existing `name@version`.
3. Snapshot and integration builds should include the source commit in the prerelease version, for example `0.2.2-dev.20260313.abcd123`, and should publish under a non-`latest` dist-tag such as `dev` or `next`.
4. Do not rely on SemVer build metadata alone for this, for example `0.2.2+abcd123`, because that is too easy to treat as equivalent to `0.2.2` during resolution and review.
5. Publish automation should fail fast if the target version already exists in the registry.
6. Consumer projects should pin exact fork versions in their own `package.json` where practical.
7. For this migration, `globalOverrides` is the short-lived delivery mechanism for the `@vlcn.io/*` set while we finish that full dependency migration; it is not intended to stay a long-term steady-state.
8. Any local source alias or patch workflow must stay uncommitted and developer-only.

## Ordered migration

### Phase 1: publish the real forked builds — DONE

All 10 `@vlcn.io/*` packages published to `npm.codemyriad.io` under dev snapshot versions using `3rd-party/js/scripts/publish/publish.sh`:

| Package | Version |
|---------|---------|
| `@vlcn.io/xplat-api` | `0.15.0-dev.20260313223404.c7ddf79f` |
| `@vlcn.io/ws-common` | `0.2.0-dev.20260313223404.c7ddf79f` |
| `@vlcn.io/wa-sqlite` | `0.22.0-dev.20260313223404.c7ddf79f` |
| `@vlcn.io/crsqlite` | `0.16.3-dev.20260313223404.c7ddf79f` |
| `@vlcn.io/logger-provider` | `0.2.0-dev.20260313223404.c7ddf79f` |
| `@vlcn.io/rx-tbl` | `0.15.0-dev.20260313223404.c7ddf79f` |
| `@vlcn.io/ws-client` | `0.2.0-dev.20260313223404.c7ddf79f` |
| `@vlcn.io/crsqlite-wasm` | `0.16.0-dev.20260313223404.c7ddf79f` |
| `@vlcn.io/ws-server` | `0.2.2-dev.20260313223404.c7ddf79f` |
| `@vlcn.io/ws-browserdb` | `0.2.0-dev.20260313223404.c7ddf79f` |

### Phase 2: switch Rush installs to the registry — DONE

1. Pointed [`common/config/rush/.npmrc`](../common/config/rush/.npmrc) at `https://npm.codemyriad.io/` with `${VERDACCIO_TOKEN}` auth.
2. Updated [`common/config/rush/.npmrc-publish`](../common/config/rush/.npmrc-publish) with same registry and auth.
3. Replaced `file:` entries in [`common/config/rush/pnpm-config.json`](../common/config/rush/pnpm-config.json) with exact published dev versions.
4. Ran `rush update` — lockfile now resolves all `@vlcn.io/*` from the registry. `rush build` passes.

### Phase 3: remove tarball delivery assumptions in default paths

After Rush installs resolve the correct published fork versions:

1. Update [`python-apps/launcher/scripts/package_syncserver_for_build.py`](../python-apps/launcher/scripts/package_syncserver_for_build.py) to install exact registry versions.
2. Remove `./scripts/artefacts-download.sh` calls from default CI workflows. Legacy lanes remain explicit:
   - `.github/workflows/web-client-ci.yml` (10 references)
   - `.github/workflows/pyinstaller-build.yml`
   - `.github/workflows/vfs-benchmark.yml` (legacy lane)
   - `.github/workflows/fix-playwright.yml` (legacy lane)
   - `.github/workflows/playwright-matrix.yml` (legacy lane)
   - `.github/workflow.templates/build-crsqlite.lib.yml`
   - `.github/workflow.templates/github.lib.yml`
   - `.github/workflow.templates/pyinstaller-build.yml`
3. Keep R2 artifact cache paths only in legacy lanes.
4. Keep legacy artifacts scripts/files until those lanes are retired.
5. Cosmetic log messages are now aligned to registry-first behavior; legacy-only paths remain explicitly documented.

### Phase 4: keep one narrow local escape hatch

Keep `USE_SUBMODULES` as a local-only development mode for fast iteration against sibling checkouts, but do not commit any manifest, lockfile, or Rush override that depends on it.

## Acceptance checklist

The migration is only complete when all of these are true:

- fresh clone works with `rush install` and registry-first defaults
- Librocco resolves forked `@vlcn.io/*` packages only from `npm.codemyriad.io`
- the lockfile contains registry versions in default paths, not `file:../../3rd-party/artefacts/...`
- default CI no longer downloads or uploads fork tarballs
- PyInstaller packaging uses registry packages in default flow
- local submodule work remains possible, but only as an explicit developer override
