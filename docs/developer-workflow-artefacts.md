# Developer Workflow: Artefact Management

This guide explains the workflow for managing build artefacts in Librocco using the Git LFS → R2 migration implementation.

## Overview

Librocco uses version-controlled build artefacts (cr-sqlite WASM binaries) that are large binaries. To avoid Git LFS bandwidth quota issues in CI, we use a hybrid approach:

- **Developers**: Continue using Git LFS for version control and local development
- **CI**: Pulls artefacts from Cloudflare R2 instead of Git LFS
- **Result**: No LFS bandwidth consumption from CI, but developers still get LFS benefits

## When Artefacts Need Updating

Artefacts need updating when:

1. **Submodule changes**: Changes in the cr-sqlite submodule require rebuilding
2. **Upstream updates**: Updates to VL/cr-sqlite dependency
3. **Build system changes**: Changes to the build toolchain (Rust, wasm-pack, etc.)

You'll know artefacts need updating when CI fails with:
- "Required artefacts not found in R2 storage"
- Hash mismatches in artefact verification

## Workflow: Updating Artefacts

### Step 1: Build New Artefacts

```bash
# Pull latest submodules
git submodule update --init --recursive

# Build artefacts
./scripts/build_vlcn.sh
```

This builds the WASM binaries and places them in `3rd-party/artefacts/`.

### Step 2: Check What Changed

```bash
# See which files were created/modified
git status 3rd-party/artefacts/
git add 3rd-party/artefacts/
```

### Step 3: Push Artefacts to R2

```bash
# Set your API key (one-time setup)
export ARTEFACT_API_KEY="your-secret-key"

# Push artefacts to R2
./scripts/artefacts-upload.sh
```

The script will:
- Upload each `.tgz` file to R2
- Skip files already present (idempotent)
- Report success/failure for each file

### Step 4: Verify Upload

```bash
# Verify upload by pulling artefacts to a clean state
rm 3rd-party/artefacts/*.tgz

# This should download all artefacts from R2
./scripts/artefacts-download.sh

# Verify artefacts match
sha256sum 3rd-party/artefacts/*.tgz
```

### Step 5: Commit Changes

```bash
git add 3rd-party/artefacts/
git add 3rd-party/artefacts_version.txt
git commit -m "chore: update cr-sqlite artefacts"
git push
```

## First-Time Setup: Getting Started

### One-Time: Configure Credentials

```bash
# Export your API key (add to ~/.bashrc or ~/.zshrc for persistence)
export ARTEFACT_API_KEY="your-secret-key"
```

The API key is:
- Required for both upload and download scripts
- A shared secret used across all environments (local dev, CI, Cloudflare Worker)
- **DO NOT** update the Cloudflare Worker secret unless absolutely necessary (contact maintainers first)

### One-Time: Verify Setup

```bash
# Test upload to R2
./scripts/artefacts-upload.sh

# Test download from R2
rm 3rd-party/artefacts/*.tgz
./scripts/artefacts-download.sh
```

## Script Details

### artefacts-upload.sh

Uploads artefacts to Cloudflare R2.

**Usage:**
```bash
# Upload all artefacts
./scripts/artefacts-upload.sh

# Upload specific files
./scripts/artefacts-upload.sh vlcn.io-crsqlite-0.16.3.tgz
```

**Environment Variables:**
- `ARTEFACT_API_KEY` (required) - Secret key for API authentication
- `ARTEFACT_WORKER_URL` (optional) - Worker URL, defaults to `https://artefacts.libroc.co`

**Behavior:**
- Skips files already in R2 (HTTP 409 response)
- Returns exit code 1 if any upload fails
- Reports: uploaded count, skipped count, failed count

### artefacts-download.sh

Downloads artefacts from Cloudflare R2 with verification.

**Usage:**
```bash
# Download all missing artefacts
./scripts/artefacts-download.sh
```

**Environment Variables:**
- `ARTEFACT_API_KEY` (required) - Secret key for API authentication
- `ARTEFACT_WORKER_URL` (optional) - Worker URL, defaults to `https://artefacts.libroc.co`

**Behavior:**
- Discovers expected artefacts via `git lfs ls-files` or local files
- Verifies all artefacts exist in R2 before downloading
- Fails immediately if any artefact not found
- Downloads only missing artefacts
- Validates downloaded files with SHA-256 hash

## Common Issues

### Authentication Failed

```
✗ Authentication failed. Check API key.
```

**Cause:** `ARTEFACT_API_KEY` doesn't match the shared Cloudflare Worker secret.

**Fix:** Contact the repository maintainers to get the correct API key. Do not attempt to update the Cloudflare Worker secret yourself.

### Artefacts Not Found in R2

```
❌ ERROR: Required artefacts not found in R2 storage

Missing artefacts:
  - vlcn.io-crsqlite-0.16.3.tgz (hash: 343ac9be...)
```

**Cause:** Artefacts built locally but not pushed to R2.

**Fix:**
```bash
./scripts/artefacts-upload.sh
```

### Hash Mismatch

```
✗ Hash mismatch. Content hash: ..., URL hash: ...
```

**Cause:** File was corrupted during upload/download.

**Fix:** Re-upload the artefact:
```bash
./scripts/artefacts-upload.sh vlcn.io-crsqlite-0.16.3.tgz
```

### Worker Not Deployed

```
Error: No route found for artefacts.libroc.co
```

**Cause:** Cloudflare Worker not deployed or DNS misconfigured.

**Fix:**
```bash
cd .github/cf-worker-artefact
npx wrangler deploy
```

### LFS Pull Still Happening in CI

**Cause:** Workflow template not updated or workflow not regenerated.

**Fix:**
```bash
cd .github
bash build-workflows.sh
git add .github/workflows/*.yml
git commit -m "chore: regenerate workflows for R2 migration"
```

## CI vs Local Development

### Local Development

- Use Git LFS as normal (git pulls/downloads LFS files)
- Make changes to submodules
- Build artefacts with `./scripts/build_vlcn.sh`
- Push to R2 with `./scripts/artefacts-upload.sh`
- Commit changes

### CI (GitHub Actions)

- Uses `lfs: false` in checkout
- Runs `artefacts-download.sh` to pull from R2
- Does not consume Git LFS bandwidth quota
- Fails fast if artefacts missing in R2

## Workflow Diagram

```
Developer Workflow
┌─────────────────────────────────────────────────────────┐
│ 1. Developer makes changes to submodules/build system   │
└──────────────────────┬────────────────────────────────┘
                       │
┌──────────────────────▼────────────────────────────────┐
│ 2. Build artefacts locally                            │
│    ./scripts/build_vlcn.sh                             │
│    → 3rd-party/artefacts/*.tgz                        │
└──────────────────────┬────────────────────────────────┘
                       │
┌──────────────────────▼────────────────────────────────┐
│ 3. Push artefacts to R2                               │
│    ./scripts/artefacts-upload.sh                       │
│    → Cloudflare R2 (librocco-ci bucket)               │
└──────────────────────┬────────────────────────────────┘
                       │
┌──────────────────────▼────────────────────────────────┐
│ 4. Commit changes incl. LFS pointers                  │
│    git add 3rd-party/artefacts/                        │
│    git commit -m "update artefacts"                    │
└──────────────────────┬────────────────────────────────┘
                       │
┌──────────────────────▼────────────────────────────────┐
│ 5. Push to GitHub                                      │
│    git push                                            │
└───────────────────────────────────────────────────────┘

CI Workflow
┌─────────────────────────────────────────────────────────────────┐
│ 1. Checkout (lfs: false)                                        │
│    - No LFS download                                            │
│    - Only gets LFS pointer files                               │
└──────────────────────┬────────────────────────────────────────┘
                       │
┌──────────────────────▼────────────────────────────────────────┐
│ 2. Pull artefacts from R2                                     │
│    ./scripts/artefacts-download.sh                            │
│    - Uses Cloudflare Worker API                               │
│    - Downloads by SHA-256 hash                                │
│    - Verifies integrity                                        │
└──────────────────────┬────────────────────────────────────────┘
                       │
┌──────────────────────▼────────────────────────────────────────┐
│ 3. Build/Run                                                   │
│    - Artefacts available in 3rd-party/artefacts/              │
│    - CI proceeds with build/test                              │
└───────────────────────────────────────────────────────────────┘
```

## Best Practices

1. **Always push to R2 after building artefacts**
   - Don't skip this step or CI will fail
   - Test locally with download script before pushing

2. **Use the same API key everywhere**
    - Get the API key from repository maintainers
    - Set it locally in your shell (`export ARTEFACT_API_KEY="..."`)
    - It should already be configured in GitHub Secrets for CI

3. **Verify before committing**
   - Run `artefacts-download.sh` after upload to verify
   - Check that SHA-256 hashes match locally and in R2

4. **Keep artefact version file current**
   - `3rd-party/artefacts_version.txt` tracks expected artefact versions
   - Updates automatically when you build artefacts

5. **Monitor CI for missing artefacts**
   - CI will fail if artefacts not in R2
   - Contact repo maintainers if you see persistent failures

## Troubleshooting Script Commands

### Debug Upload Issues

```bash
# Enable verbose output
ARTEFACT_WORKER_URL="https://artefacts.libroc.co" \
  ./scripts/artefacts-upload.sh -vv
```

### Test R2 Worker Directly

```bash
# Check worker is deployed
curl https://artefacts.libroc.co/artefact/0000000000000000000000000000000000000000000000000000000000000000 \
  -H "X-API-Key: your-key"

# Try batch-check
curl -X POST https://artefacts.libroc.co/batch-check \
  -H "X-API-Key: your-key" \
  -H "Content-Type: application/json" \
  -d '["hash1","hash2"]'
```

### Check Local vs CI Artefact State

```bash
# Local LFS files
git lfs ls-files

# Expected hashes
cat 3rd-party/artefacts_version.txt

# Actual local files
sha256sum 3rd-party/artefacts/*.tgz
```

## Getting Help

If you encounter issues:

1. Check this guide's troubleshooting section
2. Review Cloudflare Worker logs: `npx wrangler tail`
3. Check CI workflow logs for detailed error messages
4. Contact maintainers or create an issue

## Related Documentation

- [Quick Start: R2 Migration](./QUICKSTART_R2_MIGRATION.md) - Initial setup guide
- [R2 Implementation Summary](./R2_ARTEFACT_MIGRATION_SUMMARY.md) - Technical details
- [Cloudflare Worker README](./.github/cf-worker-artefact/README.md) - API documentation
