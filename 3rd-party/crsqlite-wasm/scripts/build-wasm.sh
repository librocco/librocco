#!/bin/bash

mkdir -p dist

cd ../emsdk
./emsdk install 3.1.45
./emsdk activate 3.1.45
source ./emsdk_env.sh

cd ../wa-sqlite
make
cp dist/crsqlite.wasm ../crsqlite-wasm/dist/crsqlite.wasm
cp dist/crsqlite.mjs ../crsqlite-wasm/src/crsqlite.mjs

