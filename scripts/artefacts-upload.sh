#!/usr/bin/env bash

set -uo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
REPO_ROOT="${SCRIPT_DIR}/.."
ARTEFACTS_DIR="${REPO_ROOT}/3rd-party/artefacts"

WORKER_URL="${ARTEFACT_WORKER_URL:-https://artefacts.libroc.co}"

if [[ -z "${ARTEFACT_API_KEY:-}" ]]; then
  echo "Error: ARTEFACT_API_KEY environment variable is required" >&2
  echo "Set it with: export ARTEFACT_API_KEY='your-secret-key'" >&2
  exit 1
fi

if [[ ! -d "$ARTEFACTS_DIR" ]]; then
  echo "Error: Artefacts directory not found: $ARTEFACTS_DIR" >&2
  exit 1
fi

cd "$REPO_ROOT"

if [[ $# -gt 0 ]]; then
  SPECIFIC_FILES=("$@")
else
  SPECIFIC_FILES=()
fi

PUSH_COUNT=0
SKIP_COUNT=0
FAIL_COUNT=0

echo "Starting artefact upload to $WORKER_URL"

for file in "$ARTEFACTS_DIR"/*.tgz; do
  if [[ ! -f "$file" ]]; then
    continue
  fi

  filename=$(basename "$file")

  if [[ ${#SPECIFIC_FILES[@]} -gt 0 ]]; then
    is_specified=false
    for spec_file in "${SPECIFIC_FILES[@]}"; do
      if [[ "$filename" == "$spec_file" ]] || [[ "$filename" == "${spec_file##*/}" ]]; then
        is_specified=true
        break
      fi
    done
    if [[ "$is_specified" == false ]]; then
      continue
    fi
  fi

  hash=$(sha256sum "$file" | awk '{print $1}')

  echo "Checking $filename (hash: ${hash:0:16}...)..."

  upload_url="${WORKER_URL}/artefact/${hash}"

  # Use timeout command to prevent hanging when DNS fails
  if ! response=$(timeout 30 curl -s -w "\n%{http_code}" --show-error -X PUT \
    -H "X-API-Key: ${ARTEFACT_API_KEY}" \
    --data-binary @"$file" \
    "$upload_url" 2>&1); then
    echo "  ✗ Upload failed (timeout or network error)"
    ((FAIL_COUNT++))
    continue
  fi

  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')

  case $http_code in
    201)
      echo "  ✓ Uploaded successfully"
      ((PUSH_COUNT++))
      ;;
    409)
      echo "  - Already exists (skipping)"
      ((SKIP_COUNT++))
      ;;
    401)
      echo "  ✗ Authentication failed. Check API key."
      exit 1
      ;;
    *)
      echo "  ✗ Upload failed ($http_code): $body"
      ((FAIL_COUNT++))
      ;;
  esac
done

echo ""
echo "Upload complete:"
echo "  Uploaded: $PUSH_COUNT"
echo "  Skipped (already exists): $SKIP_COUNT"
echo "  Failed: $FAIL_COUNT"

if [[ $FAIL_COUNT -gt 0 ]]; then
  exit 1
fi
