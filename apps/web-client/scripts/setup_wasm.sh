#!/bin/bash

# NOTE: This script is intended to be run from the 'web-client' package root (as part of postinstall script)

# Make the wasm binary
cd ../../3rd-party/wa-sqlite
make
WASM_DIR="$(pwd)/dist/wa-sqlite-async.wasm"

# Symlink the built binary into 'web-client's 'static' directory (for static serving)
cd ../../apps/web-client/static
# Remove the old symlink if exists
rm -f wa-sqlite-async.wasm
# Create a new symlink to the built wasm binary
ln -s "$WASM_DIR" wa-sqlite-async.wasm
