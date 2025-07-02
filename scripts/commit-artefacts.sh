#!/bin/bash
set -euo pipefail

# Configure git
git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"

# Stage modified files.
git add -u 3rd-party/artefacts/
git add 3rd-party/artefacts_version.txt

# Exit if there are no changes to commit
if git diff --staged --quiet; then
  echo "No artefact changes to commit."
  exit 0
fi

# Prepare commit message
JS_SHA=$(git -C 3rd-party/js rev-parse --short HEAD)
COMMIT_TITLE="Update assets to $JS_SHA"
COMMIT_BODY=$(cat <<EOF
$(git -C 3rd-party/js show --shortstat HEAD)
---
$(git -C 3rd-party/typed-sql show --shortstat HEAD)
EOF
)

# Commit
git commit -m "$COMMIT_TITLE" -m "$COMMIT_BODY"
