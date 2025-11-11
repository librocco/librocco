#!/usr/bin/env bash
# check-pr.sh  —  detect add→delete, large, and binary files in a PR
# Usage:
#   BASE_BRANCH=origin/main TARGET_REF=my-feature ./check-pr.sh

set -euo pipefail

BASE_BRANCH="${BASE_BRANCH:-origin/main}"   # branch you will merge into
TARGET_REF="${TARGET_REF:-HEAD}"            # tip of the PR (HEAD in CI)

cd "$(dirname $0)/.."
git fetch --quiet origin "$(echo "$BASE_BRANCH" | cut -d/ -f2-)"

echo "🔍 scanning commits between $BASE_BRANCH and $TARGET_REF …"

##########################
# 1. files added AND deleted somewhere in the range
##########################
mapfile -t added_deleted_files < <(
  git log --pretty=format: --name-status "$BASE_BRANCH".."$TARGET_REF" |
  awk '$1=="A"{add[$2]=1} $1=="D"{del[$2]=1} END{for(f in add) if(f in del) print f}'
)

if ((${#added_deleted_files[@]})); then
  echo "❌ files added *and* removed in this PR:"
  printf '%s\n' "${added_deleted_files[@]}"
  exit 1
fi

##########################
# 2. fresh additions (persisting in HEAD) — size & binary checks
##########################
mapfile -t added_files < <(
  git diff --diff-filter=A --name-only "$BASE_BRANCH".."$TARGET_REF"
)

BINARY_DETECTED=0
LARGE_DETECTED=0

for f in "${added_files[@]}"; do
  [[ -f "$f" ]] || continue

  size=$(stat -c%s -- "$f")
  if (( size > 1048576 )); then      # >1 MiB
    echo "❌ file too large: $f ($size bytes)"
    LARGE_DETECTED=1
  fi

  mime=$(file -b --mime -- "$f")
  if ! grep -Eq '^(text/|application/(javascript|json|x-gettext-translation)(; charset=.*)?|inode/x-empty|image/svg\+xml)' <<< "$mime"; then
    echo "❌ binary/blob file detected: $f ($mime)"
    BINARY_DETECTED=1
  fi
done

if (( LARGE_DETECTED || BINARY_DETECTED )); then
  echo "❌ PR contains large or binary files. Refactor before merging."
  exit 1
fi

echo "✅ all checks passed."
