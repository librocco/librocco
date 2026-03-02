#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
cd "$SCRIPT_DIR"

RED=$(tput setaf 1)
GREEN=$(tput setaf 2)
YELLOW=$(tput setaf 3)
BLUE=$(tput setaf 4)
NC=$(tput sgr0)

success() {
    echo "${GREEN}✓${NC} $1"
}

error() {
    echo "${RED}✗${NC} $1"
}

warn() {
    echo "${YELLOW}⚠${NC} $1"
}

info() {
    echo "${BLUE}ℹ${NC} $1"
}

check_command() {
    if command -v "$1" &>/dev/null; then
        return 0
    else
        return 1
    fi
}

echo "======================================"
echo "Cloudflare Worker Setup Diagnosis"
echo "======================================"
echo ""

# 1. Check wrangler is installed
info "Checking wrangler installation..."
if ! check_command npx wrangler; then
    error "wrangler not found. Install with: npx create-cloudflare"
    exit 1
fi
success "wrangler is installed"
echo ""

# 2. Check wrangler login
info "Checking wrangler authentication..."
if ! npx wrangler whoami &>/dev/null; then
    error "Not logged in to Cloudflare"
    info "Run: npx wrangler login"
    exit 1
fi
success "Logged in to Cloudflare"
echo ""

# 3. Check worker deployment
info "Checking worker deployment..."
DEPLOYMENT_OUTPUT=$(npx wrangler deployments list 2>&1)
if echo "$DEPLOYMENT_OUTPUT" | grep -q "Created:"; then
    success "Worker is deployed"
    echo "Recent deployments:"
    echo "$DEPLOYMENT_OUTPUT" | head -5
else
    error "Worker not deployed"
    info "Run: npx wrangler deploy"
    exit 1
fi
echo ""

# 4. Check if wrangler.toml exists and has routes configured
info "Checking wrangler.toml configuration..."
if [ ! -f wrangler.toml ]; then
    error "wrangler.toml not found"
    exit 1
fi

DOMAIN=""
ZONE=""
DOMAIN=$(sed -n 's/^pattern[[:space:]]*=[[:space:]]*"\([^*/]*\)\/\*".*/\1/p' wrangler.toml | head -1 || true)
ZONE=$(sed -n 's/^zone_name[[:space:]]*=[[:space:]]*"\([^"]*\)".*/\1/p' wrangler.toml || true)

if [ -n "$DOMAIN" ]; then
    success "Routes configured for $DOMAIN *"
else
    warn "No custom routes found in wrangler.toml"
fi
echo ""

# 5. Check DNS resolution
info "Checking DNS resolution..."
if [ -n "$DOMAIN" ]; then
    DNS_OUTPUT=$(nslookup "$DOMAIN" 2>&1 || true)
    if echo "$DNS_OUTPUT" | grep -q "No answer\|NXDOMAIN"; then
        error "DNS does not resolve for $DOMAIN"
        echo ""
        info "Setup required:"
        echo "1. Go to Cloudflare Dashboard > DNS > $ZONE zone"
        echo "2. Create record:"
        echo "   - Type: CNAME"
        echo "   - Name: ${DOMAIN%%.*} (everything before first dot)"
        echo "   - Target: (Cloudflare will auto-assign or use worker URL)"
        echo "   - Proxy: Proxied (orange cloud)"
        echo "3. Wait 5-10 minutes for DNS propagation"
        echo ""
        exit 1
    else
        success "DNS resolves for $DOMAIN"
    fi
fi
echo ""

# 6. Check R2 buckets
info "Checking R2 bucket configuration..."
if grep -q "r2_buckets" wrangler.toml; then
    success "R2 bucket binding configured"
    grep -A2 "r2_buckets" wrangler.toml | grep "bucket_name" || warn "No bucket_name found"
else
    warn "R2 bucket binding not found in wrangler.toml"
fi
echo ""

# 7. Test API endpoint
info "Testing API endpoint..."
if [ -n "$DOMAIN" ]; then
    TEST_URL="https://$DOMAIN/artefact/test"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$TEST_URL" 2>&1 || echo "000")
    
    if [ "$HTTP_CODE" = "000" ]; then
        warn "Could not connect to $TEST_URL"
        info "This might be due to:"
        echo "  - DNS not yet propagated (wait 5-10 minutes)"
        echo "  - Network connectivity issues"
        echo "  - Firewall blocking HTTPS"
    elif [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "404" ]; then
        success "API endpoint responding (HTTP $HTTP_CODE - expected for test endpoint)"
    else
        success "API endpoint responding (HTTP $HTTP_CODE)"
    fi
fi
echo ""

# 8. Check Secrets
info "Checking Cloudflare secrets..."
info "To verify ARTEFACT_API_KEY is set:"
echo "  npx wrangler secret list"
echo ""
info "To set ARTEFACT_API_KEY:"
echo "  npx wrangler secret put ARTEFACT_API_KEY"
echo ""

echo "======================================"
echo "Diagnosis Complete"
echo "======================================"
echo ""
info "Next steps:"
echo "1. Ensure DNS record is created in Cloudflare Dashboard (see Step 5 above)"
echo "2. Wait 5-10 minutes for DNS propagation"
echo "3. Test upload script:"
echo "   export ARTEFACT_API_KEY='your-key'"
echo "   ./scripts/artefacts-upload.sh"
