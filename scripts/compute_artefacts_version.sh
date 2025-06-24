#!/bin/bash

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
cd $SCRIPT_DIR/..
git diff --quiet 3rd-party/js || {
    echo Repository 3rd-party/js is dirty - only run this script on clean submodules
    exit 1
}
git diff --quiet 3rd-party/typed-sql || {
    echo Repository 3rd-party/typed-sql is dirty - only run this script on clean submodules
    exit 1
}


echo js repo hash: $(git -C 3rd-party/js log -1 --format=%H)
echo typed-sql repo hash: $(git -C 3rd-party/typed-sql log -1 --format=%H)

echo js repo hash: $(git -C 3rd-party/js log -1 --format=%H) > 3rd-party/artefacts/version.txt
echo typed-sql repo hash: $(git -C 3rd-party/typed-sql log -1 --format=%H) >> 3rd-party/artefacts/version.txt
