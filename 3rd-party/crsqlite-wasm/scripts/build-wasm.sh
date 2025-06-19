#!/bin/bash

cd "$(dirname "$0")"/..

[ -f ./dist/crsqlite.wasm ] && {
  echo ./dist/crsqlite.wasm file found - skipping compilation
  exit 0
}

mkdir -p dist

# This env variable is required by the crsql build process
# (as it's, and I quote, "only meant to be built as a submodule of @vlcn.io/js")
#
# We're providing a dummy value here (this has nothing to do with the underlaying build, but here we are)
export CRSQLITE_COMMIT_SHA="$(git rev-parse HEAD)"

cd ../emsdk
# We redirect stderr to stout (with `2>&1`) so that rush doesn't think there were any warnings:
# in case it detects any it will fail the build
./emsdk install 3.1.45 2>&1
./emsdk activate 3.1.45
export PATH=$PWD/upstream/emscripten:$PATH

cd ../wa-sqlite
# We redirect stderr to stout (with `2>&1`) so that rush doesn't think there were any warnings:
# in case it detects any it will fail the build
make 2>&1
cp dist/crsqlite.wasm ../crsqlite-wasm/dist/crsqlite.wasm
cp dist/crsqlite.mjs ../crsqlite-wasm/src/crsqlite.mjs
