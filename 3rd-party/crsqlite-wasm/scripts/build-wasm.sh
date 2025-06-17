#!/bin/bash

mkdir -p dist

# This env variable is required by the crsql build process
# (as it's, and I quote, "only meant to be built as a submodule of @vlcn.io/js")
#
# We're providing a dummy value here (this has nothing to do with the underlaying build, but here we are)
export CRSQLITE_COMMIT_SHA="$(git rev-parse HEAD)"

cd ../emsdk
./emsdk install 3.1.45
./emsdk activate 3.1.45
source ./emsdk_env.sh

cd ../wa-sqlite
make
cp dist/crsqlite.wasm ../crsqlite-wasm/dist/crsqlite.wasm
cp dist/crsqlite.mjs ../crsqlite-wasm/src/crsqlite.mjs

