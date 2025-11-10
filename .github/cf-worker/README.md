# R2 Proxy Worker

This Cloudflare Worker proxies requests from `test.libroc.co` to the R2 bucket `librocco-ci`.

## Why This Worker Exists

R2 custom domains don't provide directory index handling by default. This worker:
- Serves files directly from R2 with proper MIME types (set by rclone during upload)
- Handles directory index: `/path/` → `/path/index.html`
- Adds CORS and cache headers

## How It Works

1. Receives request for a file on `test.libroc.co`
2. Tries to fetch the exact path from R2
3. If not found and path ends with `/`, tries appending `index.html`
4. Sets proper headers (MIME types, CORS, cache control)
5. Returns the file

### Deployment

```bash
wrangler deploy
```
### Testing

```bash
wrangler dev
```
