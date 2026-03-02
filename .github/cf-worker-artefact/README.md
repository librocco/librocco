# Git LFS to R2 Migration

## Problem

GitHub has egress rate limits for Git LFS, and CI jobs (GitHub CI servers pulling from GitHub LFS) count toward these limits. Frequent CI runs can hit these limits.

## Solution

Store Git LFS artefacts in Cloudflare R2 and serve them via a custom Cloudflare Worker API. Devs still use Git LFS in their workflow, but CI pulls artefacts from R2 instead.

## Architecture

1. **Cloudflare Worker API** (`artefacts.libroc.co`)
   - `PUT /artefact/{hash}` - Upload artefact by LFS hash
   - `GET /artefact/{hash}` - Download artefact by LFS hash
   - `POST /batch-check` - Check if multiple hashes exist
   - All requests require `X-API-Key` header

2. **R2 Storage** (`librocco-ci` bucket)
   - Stores artefacts keyed by their Git LFS hash (64-character SHA-256)
   - Flat key structure for simplicity

3. **Local Scripts**
   - `scripts/ci-artefacts-push.sh` - Push artefacts to R2
   - `scripts/ci-artefacts-pull.sh` - Pull artefacts from R2 (used by CI)

4. **CI Workflows**
   - Checkout with `lfs: false` (no Git LFS download)
   - Pull artefacts from R2 after checkout
   - Fail if any artefact not found in R2

## Developer Workflow

### Initial Setup

1. Configure environment variables:
    ```bash
    export ARTEFACT_API_KEY="your-secret-key"  # Get from repository maintainers
    export ARTEFACT_WORKER_URL="https://artefacts.libroc.co"
    ```

2. Build artefacts:
   ```bash
   ./scripts/build_vlcn.sh
   ```

3. Push to R2:
   ```bash
   ./scripts/ci-artefacts-push.sh
   ```

### After Updating Submodules

1. Build new artefacts:
   ```bash
   ./scripts/build_vlcn.sh
   ```

2. Push to R2:
   ```bash
   ./scripts/ci-artefacts-pull.sh
   ```

3. Commit changes:
   ```bash
   git add -u 3rd-party/artefacts/
   git add 3rd-party/artefacts_version.txt
   git commit
   ```

## CI Configuration

### Secrets to Add

Add to repository settings > Secrets and variables > Actions:

**Secrets:**
- `ARTEFACT_API_KEY` - Secret key for Cloudflare Worker API

**Variables:**
- `ARTEFACT_WORKER_URL` - URL of artefact worker (default: `https://artefacts.libroc.co`)

### Workflow Templates

The following workflow templates have been updated:
- `.github/workflow.templates/github.lib.yml` - Added `pull_artefacts()` macro
- `.github/workflow.templates/build-crsqlite.lib.yml` - Added artefact pull step
- `.github/workflow.templates/test-job.lib.yml` - Loads and uses artefact pull

After modifying templates, regenerate workflows:
```bash
cd .github && bash build-workflows.sh
```

## Cloudflare Worker Setup

### Quick Diagnosis

Run the setup check script to verify your configuration:

```bash
cd .github/cf-worker-artefact
./setup-check.sh
```

This script will:
- Verify wrangler installation and authentication
- Check worker deployment status
- Validate wrangler.toml configuration
  ⚠️ **DNS Record Step (Manual)**
- Check R2 bucket binding
- Test API endpoint availability
- Show next steps if issues are found

### 1. Deploy the Worker

```bash
cd .github/cf-worker-artefact
npx wrangler login
npx wrangler deploy
```

### 2. Configure DNS Record ⚠️ MANUAL STEP REQUIRED

**This is a critical manual step** - DNS records cannot be created via scripts. You must do this in the Cloudflare Dashboard:

1. Go to **Cloudflare Dashboard** > **Compute** > **Workers & Pages** -> **artefact-api-worker** -> **Domains & Routes**
2. Click **+ Add** > **Custom domain**
3. Type in the worker domain (same as wokrer route for basic setup)
4. Click **Add domain**

**Verify DNS works:**
```bash
nslookup artefacts.libroc.co

# Should return Cloudflare IP addresses
# If it shows "Can't find" or "No answer", DNS isn't ready yet
```

### 3. Secrets Configuration

The `ARTEFACT_API_KEY` secret is already configured. Contact repository maintainers if you need to update it.

**To verify secret is set:**
```bash
npx wrangler secret list
```

**To update the secret:**
```bash
npx wrangler secret put ARTEFACT_API_KEY
```

## Testing the Setup

### Dev Testing

```bash
# Build artefacts
./scripts/build_vlcn.sh

# Push to R2
export ARTEFACT_API_KEY="test-key"
export ARTEFACT_WORKER_URL="https://artefacts.libroc.co"
./scripts/ci-artefacts-push.sh

# Verify pull works
rm 3rd-party/artefacts/*.tgz
./scripts/ci-artefacts-pull.sh
```

### CI Testing

1. Push workflow changes to a test branch
2. Run CI on that branch
3. Verify:
   - Checkout does not pull LFS (`git lfs ls-files` should show pointer files)
   - Pull script downloads all artefacts
   - Build succeeds
   - No LFS egress in GitHub Actions logs

## Troubleshooting

### Artefacts Not Found in R2

Error message: `❌ ERROR: Required artefacts not found in R2 storage`

**Fix:** Run push script:
```bash
./scripts/ci-artefacts-push.sh
```

### Authentication Failed

Error: `✗ Authentication failed. Check API key.`

**Fix:**
1. Verify `ARTEFACT_API_KEY` matches the shared Cloudflare secret
2. Contact repository maintainers if you need the correct API key

### Network Errors

Pull fails with HTTP 5xx errors.

**Fix:** Run diagnostic script:
```bash
cd .github/cf-worker-artefact
./setup-check.sh
```

Or check manually:
1. Worker is deployed: `npx wrangler deployments list`
2. Route is configured in `wrangler.toml`
3. DNS resolves `artefacts.libroc.co`: `nslookup artefacts.libroc.co`
4. DNS record exists in Cloudflare Dashboard > DNS > libroc.co

**If DNS fails to resolve:**
- Check DNS record exists in Cloudflare Dashboard for `artefacts.libroc.co`
- Wait 5-10 minutes for DNS propagation if record was just created
- Verify CNAME record is configured correctly (see Setup section above)

### LFS Pull Still Happening in CI

Check that workflow has:
- `.github/workflows/web-client-ci.yml` line 21 `lfs: false`
- Checkout step includes `Pull artefacts from R2`

## Rollback Plan

If R2 solution fails, revert workflow changes:
1. Revert `github.lib.yml` templates to use `lfs: true`
2. Remove `pull_artefacts()` calls from workflow templates
3. Regenerate workflows

## Out of Scope

- Optimising artefact build caching
- Updating build-cr-sqlite job
- Implementing LFS pointer file format migration
- Adding rate limiting or query parameters to API
