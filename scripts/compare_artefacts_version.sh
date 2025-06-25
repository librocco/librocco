#!/bin/bash

# This scrpipt checks the current state of assets.
# It's meant to be run in the CI.
# It needs to answer the question:
# Do compiled assets need to be rebuilt? Or are they in sync with the submodules in `3rd-party/`?
# The script will output any info/debug string to stderr. At the end it outputs either
# `rebuild=yes` or `rebuild=no` depending on the result of its investigation


# First: let's check if the file 3rd-party/artefacts_version.txt is up to date.
# To do that we:
#   * first check that `3rd-party/typed-sql` and `3rd-party/js` are checked out and not dirty
#   * also check that `3rd-party/artefacts_version.txt` is not dirty
#   * run compute_artefacts_version.sh
#   * check if `3rd-party/artefacts_version.txt` is dirty
#   * if it's not dirty,  output `rebuild=no` on stdout and exit
#   * If it's dirty do one more check: does the file `3rd-party/artefacts/cached_version.txt` exist? if not output `rebuild=yes` on stdout and exit
#   * If it exists, is it the same as the current (script generated) `3rd-party/artefacts_version.txt`?
#   * if it is not the same, output a bold red error message (this should not happen - if the file is there it should be up to date) and exit non 0
#   * If it is the same, output `rebuild=no` on stdout and exit


SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)  # The script lives in the `scripts/` directory
cd $SCRIPT_DIR/..  # We like to start working in the repository root
