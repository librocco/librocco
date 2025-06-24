#!/bin/bash

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
cd $SCRIPT_DIR/..
echo Note that this script will happily misreport on a dirty repo:
echo "don't commit after running on a dirty repo"
echo js repo hash: $(git -C 3rd-party/js log -1 --format=%H)
echo typed-sql repo hash: $(git -C 3rd-party/typed-sql log -1 --format=%H)

echo js repo hash: $(git -C 3rd-party/js log -1 --format=%H) > 3rd-party/artefacts/version.txt
echo typed-sql repo hash: $(git -C 3rd-party/typed-sql log -1 --format=%H) >> 3rd-party/artefacts/version.txt
