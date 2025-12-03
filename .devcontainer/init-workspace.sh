#!/bin/bash
# Initialize workspace with pre-built dependencies from image cache
set -e

WORKSPACE="${1:-/workspaces/librocco}"
MARKER="$WORKSPACE/common/temp/.devcontainer-initialized"
LOCKFILE_CACHE="/prebuilt-cache/pnpm-lock.yaml"
LOCKFILE_LOCAL="$WORKSPACE/common/config/rush/pnpm-lock.yaml"

# Ensure the volume is writable by the current user
if [ ! -w "${WORKSPACE_FOLDER}/common/temp" ]; then
    echo "Fixing volume permissions..."
    sudo chown -R $(whoami) "${WORKSPACE_FOLDER}/common/temp"
fi

if [ ! -f "$MARKER" ]; then
    echo "⏳ First run: initializing dependencies from pre-built cache..."

    # Ensure target exists and is writable
    mkdir -p "$WORKSPACE/common/temp"

    # Copy pre-built common/temp to workspace volume
    if [ -d "/prebuilt-cache/temp" ]; then
        cp -a /prebuilt-cache/temp/. "$WORKSPACE/common/temp/"
        echo "✅ Dependencies copied from cache"
    else
        echo "⚠️ No pre-built cache found, running rush update..."
        cd "$WORKSPACE" && rush update
    fi

    touch "$MARKER"
fi

# Check if local lockfile differs from cached version
# If deps changed, run rush update to reconcile (incremental, fast)
if [ -f "$LOCKFILE_CACHE" ] && [ -f "$LOCKFILE_LOCAL" ]; then
    if ! diff -q "$LOCKFILE_CACHE" "$LOCKFILE_LOCAL" > /dev/null 2>&1; then
        echo "📦 Dependencies changed, running rush update..."
        cd "$WORKSPACE" && rush update
        echo "✅ Dependencies updated"
    fi
fi

echo "✅ Workspace ready!"
