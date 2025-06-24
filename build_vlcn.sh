#!/bin/bash

set -e

# 1. Use script's directory, not the current working directory ($PWD)
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
TRD_PARTY="$SCRIPT_DIR/3rd-party"
VLCN_ROOT="$TRD_PARTY/js"
ARTEFACTS_DIR="$TRD_PARTY/artefacts"

# 2. Check if npx is installed
if ! command -v npx &> /dev/null; then
    echo "npx is required but it's not installed. Aborting." >&2
    exit 1
fi

echo '::group::Init submodules'
git submodule update --init --recursive
echo '::endgroup::'

cd $TRD_PARTY/js
echo '::group::Build WASM'
make
echo '::endgroup::'

echo '::group::Install dependencies to pack up the WASM'
npx --yes 'pnpm@<9' install --frozen-lockfile
echo '::endgroup::'


# 3. Function to process a single package
process_package() {
    local package_path="$1"
    echo "Processing package: $package_path"
    # Use a subshell to avoid changing the script's working directory
    (
        cd "$package_path"
        pnpm install --frozen-lockfile
        pnpm pack
        cp *.tgz "$ARTEFACTS_DIR"
        rm *.tgz # Let's make sure we don't make `git` feel dirty!
    )
}

echo '::group::Building VLCN packages'
process_package "$VLCN_ROOT/packages/crsqlite-wasm"
process_package "$VLCN_ROOT/packages/ws-client"
process_package "$VLCN_ROOT/packages/ws-common"
process_package "$VLCN_ROOT/packages/ws-browserdb"
process_package "$VLCN_ROOT/packages/ws-server"
process_package "$VLCN_ROOT/packages/rx-tbl"
process_package "$VLCN_ROOT/deps/cr-sqlite/core"
echo '::endgroup::'

echo "All packages built and copied to $ARTEFACTS_DIR"
