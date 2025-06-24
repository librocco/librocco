#!/bin/bash

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
cd $SCRIPT_DIR/..
echo built crsqlite-wasm hash: $(git log -1 --format=%H 3rd-party/artefacts/vlcn.io-crsqlite-wasm-0.16.0.tgz)
echo js repo hash: $(git -C 3rd-party/js log -1 --format=%H)

echo built crsqlite-wasm hash: $(git log -1 --format=%H 3rd-party/artefacts/vlcn.io-crsqlite-wasm-0.16.0.tgz) > 3rd-party/artefacts/version.txt
echo js repo hash: $(git -C 3rd-party/js log -1 --format=%H) >> 3rd-party/artefacts/version.txt
