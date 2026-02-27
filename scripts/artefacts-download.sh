#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
REPO_ROOT="${SCRIPT_DIR}/.."
ARTEFACTS_DIR="${REPO_ROOT}/3rd-party/artefacts"

WORKER_URL="${ARTEFACT_WORKER_URL:-https://artefacts.libroc.co}"

if [[ -z "${ARTEFACT_API_KEY:-}" ]]; then
  echo "Error: ARTEFACT_API_KEY environment variable is required" >&2
  exit 1
fi

if [[ ! -d "$ARTEFACTS_DIR" ]]; then
  echo "Error: Artefacts directory not found: $ARTEFACTS_DIR" >&2
  exit 1
fi

cd "$REPO_ROOT"

declare -A ARTEFACT_HASHES=()

echo "Discovering expected LFS artefacts..."
while IFS= read -r line; do
  path=$(echo "$line" | awk '{print $3}')

  if [[ "$path" == 3rd-party/artefacts/* && "$path" == *.tgz ]]; then
    local_path="${REPO_ROOT}/${path}"
    if [[ -f "$local_path" ]]; then
      hash=$(sha256sum "$local_path" | awk '{print $1}')
    else
      hash=$(git show HEAD:${path} 2>/dev/null | grep "^oid sha256:" | sed 's/oid sha256://' | tr -d '\r ')
    fi
    [[ -z "$hash" ]] && continue
    ARTEFACT_HASHES["$path"]=$hash
  fi
done < <(git lfs ls-files)

empty=true
for key in "${!ARTEFACT_HASHES[@]}"; do
  empty=false
  break
done
if [[ "$empty" == true ]]; then
  echo "No LFS artefacts found in 3rd-party/artefacts/"
  echo "Ensuring artefacts directory is not empty..."
  if [[ -z $(ls -A "$ARTEFACTS_DIR"/*.tgz 2>/dev/null) ]]; then
    echo "Error: No artefact files found in $ARTEFACTS_DIR" >&2
    exit 1
  fi

  echo "Computing hashes from local files..."
  for file in "$ARTEFACTS_DIR"/*.tgz; do
    if [[ -f "$file" ]]; then
      filepath="${file#$REPO_ROOT/}"
      hash=$(sha256sum "$file" | awk '{print $1}')
      ARTEFACT_HASHES["$filepath"]=$hash
    fi
  done
fi

echo "Found ${#ARTEFACT_HASHES[@]} expected artefact(s)"

if [[ ${#ARTEFACT_HASHES[@]} -gt 0 ]]; then
  CHECK_HASHES=()
  for path in "${!ARTEFACT_HASHES[@]}"; do
    hash="${ARTEFACT_HASHES[$path]}"
    CHECK_HASHES+=("$hash")
  done

  echo "Checking artefact availability via batch-check endpoint..."
  json_array="["
  first=true
  for hash in "${CHECK_HASHES[@]}"; do
    if [[ "$first" == true ]]; then
      json_array+="\"$hash\""
      first=false
    else
      json_array+=",\"$hash\""
    fi
  done
  json_array+="]"

  check_response=$(curl -s -X POST \
    -H "X-API-Key: ${ARTEFACT_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "$json_array" \
    "${WORKER_URL}/batch-check")

  check_result=$(echo "$check_response" | jq -r '.')

  if [[ "$check_result" == "null" ]] || [[ -z "$check_result" ]]; then
    echo "Error: Invalid response from batch-check endpoint" >&2
    exit 1
  fi

  MISSING_HASHES=()
  MISSING_PATHS=()

  for path in "${!ARTEFACT_HASHES[@]}"; do
    hash="${ARTEFACT_HASHES[$path]}"
    filename=$(basename "$path")
    exists=$(echo "$check_result" | jq -r --arg h "$hash" '.[$h]')

    if [[ "$exists" != "true" ]]; then
      MISSING_HASHES+=("$hash")
      MISSING_PATHS+=("$path")
    else
      echo "  ✓ $filename (hash: ${hash:0:16}...) - available"
    fi
  done

  if [[ ${#MISSING_HASHES[@]} -gt 0 ]]; then
    echo ""
    echo "❌ ERROR: Required artefacts not found in R2 storage"
    echo ""
    echo "Missing artefacts:"
    for i in "${!MISSING_PATHS[@]}"; do
      path="${MISSING_PATHS[$i]}"
      hash="${MISSING_HASHES[$i]}"
      filename=$(basename "$path")
      echo "  - $filename (hash: ${hash:0:16}...)"
    done
    echo ""
    echo "To fix this issue:"
    echo "1. Build the artefacts locally: ./scripts/build_vlcn.sh"
    echo "2. Push them to R2: ./scripts/artefacts-upload.sh"
    echo ""
    exit 1
  fi
fi

echo ""
echo "All expected artefacts are available in R2 storage"

for path in "${!ARTEFACT_HASHES[@]}"; do
  hash="${ARTEFACT_HASHES[$path]}"
  filename=$(basename "$path")
  local_path="${REPO_ROOT}/${path}"

  if [[ -f "$local_path" ]]; then
    local_hash=$(sha256sum "$local_path" | awk '{print $1}')
    if [[ "$local_hash" == "$hash" ]]; then
      echo "  ✓ $filename - already present (verified)"
      continue
    fi
  fi

  echo "  ↓ $filename (hash: ${hash:0:16}...) - downloading..."

  download_url="${WORKER_URL}/artefact/${hash}"

  tmp_file=$(mktemp)
  http_code=$(curl -s -w "%{http_code}" -X GET \
    -H "X-API-Key: ${ARTEFACT_API_KEY}" \
    -o "$tmp_file" \
    "$download_url")

  if [[ $http_code -ne 200 ]]; then
    echo "  ✗ Failed to download $filename (HTTP $http_code)" >&2
    rm "$tmp_file"
    exit 1
  fi

  mv "$tmp_file" "$local_path"
  echo "  ✓ Downloaded $filename"
done

echo ""
echo "Artefact pull complete"
