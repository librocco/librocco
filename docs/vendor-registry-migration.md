# Vendor Registry Migration

This document records the repo-specific migration plan for retiring committed `3rd-party/artefacts/*.tgz` tarballs in favor of published package versions from `https://npm.codemyriad.io/`.

## Why this migration exists

The current repo uses exact direct dependency versions in consumer manifests, but then replaces the actual delivery path at the root with Rush `globalOverrides` that point to committed tarballs in `3rd-party/artefacts/`.

That creates one critical hazard:

- the same `name@version` can refer to different contents depending on whether Librocco installs from the registry or from committed tarballs

That version reuse is the main mistake to fix first. A registry cutover is only safe once forked package contents are published under unique versions.

## Current repo state

These facts are true in the current tree:

- [`common/config/rush/pnpm-config.json`](../common/config/rush/pnpm-config.json) routes all `@vlcn.io/*` packages to `file:` tarballs under `3rd-party/artefacts/`.
- [`apps/web-client/package.json`](../apps/web-client/package.json), [`apps/sync-server/package.json`](../apps/sync-server/package.json), and [`apps/e2e/package.json`](../apps/e2e/package.json) already pin exact `@vlcn.io/*` dependency versions.
- [`apps/web-client/svelte.config.js`](../apps/web-client/svelte.config.js) and [`apps/web-client/vitest.config.ts`](../apps/web-client/vitest.config.ts) already treat `USE_SUBMODULES` as a local developer override path. That escape hatch can stay, but it must remain local-only.
- [`python-apps/launcher/scripts/package_syncserver_for_build.py`](../python-apps/launcher/scripts/package_syncserver_for_build.py), [`scripts/build_vlcn.sh`](../scripts/build_vlcn.sh), [`scripts/artefacts-download.sh`](../scripts/artefacts-download.sh), and workflow templates under [`.github/workflow.templates`](../.github/workflow.templates) still assume tarballs are the supported delivery format.

## Verified migration blocker

`npm.codemyriad.io` is already reachable and anonymously readable for both public npm packages and the current `@vlcn.io/*` versions Librocco uses.

However, the registry tarballs are not identical to the committed tarballs for at least these packages:

- `@vlcn.io/ws-server@0.2.2`
- `@vlcn.io/crsqlite@0.16.3`

That means Librocco cannot safely replace `file:` overrides with registry installs until forked builds are published under unique versions.

## Rules for the new system

1. Every fork content change must publish a new version.
2. Never publish different bits under an existing `name@version`.
3. Snapshot and integration builds should include the source commit in the prerelease version, for example `0.2.2-dev.20260313.abcd123`, and should publish under a non-`latest` dist-tag such as `dev` or `next`.
4. Do not rely on SemVer build metadata alone for this, for example `0.2.2+abcd123`, because that is too easy to treat as equivalent to `0.2.2` during resolution and review.
5. Publish automation should fail fast if the target version already exists in the registry.
6. Consumer projects should pin exact fork versions in their own `package.json`.
7. Root overrides should be reserved for transitive hotfixes, not for delivering first-class libraries.
8. Any local source alias or patch workflow must stay uncommitted and developer-only.

## Ordered migration

### Phase 1: publish the real forked builds — DONE

All 10 `@vlcn.io/*` packages published to `npm.codemyriad.io` under dev snapshot versions using `3rd-party/js/scripts/publish/publish.sh`:

| Package | Version |
|---------|---------|
| `@vlcn.io/xplat-api` | `0.15.0-dev.20260313.f95a20ad` |
| `@vlcn.io/ws-common` | `0.2.0-dev.20260313.f95a20ad` |
| `@vlcn.io/wa-sqlite` | `0.22.0-dev.20260313.f95a20ad` |
| `@vlcn.io/crsqlite` | `0.16.3-dev.20260313.f95a20ad` |
| `@vlcn.io/logger-provider` | `0.2.0-dev.20260313.f95a20ad` |
| `@vlcn.io/rx-tbl` | `0.15.0-dev.20260313.f95a20ad` |
| `@vlcn.io/ws-client` | `0.2.0-dev.20260313.f95a20ad` |
| `@vlcn.io/crsqlite-wasm` | `0.16.0-dev.20260313.f95a20ad` |
| `@vlcn.io/ws-server` | `0.2.2-dev.20260313.f95a20ad` |
| `@vlcn.io/ws-browserdb` | `0.2.0-dev.20260313.f95a20ad` |

### Phase 2: switch Rush installs to the registry — DONE

1. Pointed [`common/config/rush/.npmrc`](../common/config/rush/.npmrc) at `https://npm.codemyriad.io/` with `${VERDACCIO_TOKEN}` auth.
2. Updated [`common/config/rush/.npmrc-publish`](../common/config/rush/.npmrc-publish) with same registry and auth.
3. Replaced `file:` entries in [`common/config/rush/pnpm-config.json`](../common/config/rush/pnpm-config.json) with exact published dev versions.
4. Ran `rush update` — lockfile now resolves all `@vlcn.io/*` from the registry. `rush build` passes.

### Phase 3: remove tarball delivery assumptions

After Rush installs resolve the correct published fork versions:

1. Update [`python-apps/launcher/scripts/package_syncserver_for_build.py`](../python-apps/launcher/scripts/package_syncserver_for_build.py) to install exact registry versions instead of `file:` tarballs.
2. Remove the R2 artefact transport path from CI and delete the tarball build/download/upload scripts when they are no longer needed.
3. Delete `3rd-party/artefacts/` and retire submodules as a delivery mechanism.

### Phase 4: keep one narrow local escape hatch

Keep `USE_SUBMODULES` as a local-only development mode for fast iteration against sibling checkouts, but do not commit any manifest, lockfile, or Rush override that depends on it.

## Acceptance checklist

The migration is only complete when all of these are true:

- fresh clone works with `rush install` and no committed tarballs
- Librocco resolves forked `@vlcn.io/*` packages only from `npm.codemyriad.io`
- the lockfile contains registry versions, not `file:../../3rd-party/artefacts/...`
- CI no longer downloads or uploads fork tarballs
- PyInstaller packaging no longer depends on local tarball files
- local submodule work remains possible, but only as an explicit developer override
