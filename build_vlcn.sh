#!/bin/bash

TRD_PARTY="$(pwd)/3rd-party"
VLCN_ROOT="$TRD_PARTY/js"

cd $VLCN_ROOT/packages/crsqlite-wasm && pnpm pack && cp *.tgz $TRD_PARTY/artefacts
cd $VLCN_ROOT/packages/ws-client && pnpm pack && cp *.tgz $TRD_PARTY/artefacts
cd $VLCN_ROOT/packages/ws-common && pnpm pack && cp *.tgz $TRD_PARTY/artefacts
cd $VLCN_ROOT/packages/ws-browserdb && pnpm pack && cp *.tgz $TRD_PARTY/artefacts
cd $VLCN_ROOT/packages/ws-server && pnpm pack && cp *.tgz $TRD_PARTY/artefacts
cd $VLCN_ROOT/packages/rx-tbl && pnpm pack && cp *.tgz $TRD_PARTY/artefacts
cd $VLCN_ROOT/deps/cr-sqlite/core && pnpm pack && cp *.tgz $TRD_PARTY/artefacts
