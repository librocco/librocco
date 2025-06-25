#!/usr/bin/env bash
#
#   compare_artefacts_version.sh
#
#   CI helper – decides whether compiled artefacts must be rebuilt.
#
#   ──────────────────────────────────────────────────────────────────────────
#   Decision matrix (see README-ci.md for the big picture)
#
#   1.  If the *submodules* (3rd-party/js, 3rd-party/typed-sql) OR the file
#       3rd-party/artefacts_version.txt are dirty            ⇒ hard fail.
#
#   2.  Re-compute artefacts_version.txt with compute_artefacts_version.sh.
#
#   3.  If the file did **not** change                        ⇒ rebuild=no
#
#   4.  Else, look for 3rd-party/artefacts/cached_version.txt
#           a.  Missing                                       ⇒ rebuild=yes
#           b.  Present but mismatch                          ⇒ **CI ERROR**
#           c.  Present and identical                         ⇒ rebuild=no
#
#   This script prints *only*  one line to STDOUT:  rebuild=yes|no
#   Everything else goes to STDERR for CI logs.
#   ──────────────────────────────────────────────────────────────────────────
#
#   IMPLEMENTATION NOTES
#   --------------------
#   • `set -euo pipefail`  – safer shell defaults.
#   • All user-visible errors funnel through `fatal` helper for consistency.
#   • Colours are TTY-gated; avoids `tput` failures in dumb terminals.
#   • Stick to repo-root-relative paths after a single `cd` for predictability.
#

set -euo pipefail

# ───────────────────────────── helpers ──────────────────────────────
fatal() { echo "ERROR: $*" >&2; exit 1; }

# Colours only if we’re on a tty (tput may explode in dumb terminals)
if [[ -t 2 ]]; then
    BOLD=$(tput bold); RED=$(tput setaf 1); RESET=$(tput sgr0)
else
    BOLD=""; RED=""; RESET=""
fi

# ─────────────────── enter repo root so paths are stable ────────────
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
cd "${SCRIPT_DIR}/.."  # repo root

# ───────────────────── step 1: sanity-check repo ────────────────────
echo "🔍 Verifying cleanliness of submodules / version file…" >&2

for path in 3rd-party/js 3rd-party/typed-sql 3rd-party/artefacts_version.txt; do
    git diff --quiet -- "$path" || fatal "$path is dirty – run only on clean working tree"
done

# ────────────────── step 2: (re)generate version file ───────────────
echo "🔄 Recomputing artefacts_version.txt…" >&2
"${SCRIPT_DIR}/compute_artefacts_version.sh" >/dev/null

# ────────────────── step 3: did anything actually change? ───────────
if git diff --quiet -- 3rd-party/artefacts_version.txt; then
    echo "🟢 artefacts_version.txt already up-to-date" >&2
    echo "rebuild=no"
    exit 0
fi

# ────────────────── step 4: consult the cache ───────────────────────
CACHE_FILE=3rd-party/artefacts/cached_version.txt
WORK_FILE=3rd-party/artefacts_version.txt

echo "⚠️  artefacts_version.txt changed – probing cache…" >&2

if [[ ! -f "$CACHE_FILE" ]]; then
    echo "ℹ️  Cache file missing → artefacts must be rebuilt" >&2
    echo "rebuild=yes"
    exit 0
fi

if cmp -s "$CACHE_FILE" "$WORK_FILE"; then
    echo "🟢 Cache matches current submodule hashes – rebuild not required" >&2
    echo "rebuild=no"
    exit 0
fi

# ────────────────── inconsistency!  cache ≠ expected ────────────────
echo "${BOLD}${RED}❌ Inconsistent cache detected!${RESET}" >&2
echo "    $CACHE_FILE differs from freshly computed $WORK_FILE" >&2
echo "    CI cache is stale or corrupted – manual intervention required." >&2
exit 1
