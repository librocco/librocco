#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
REPO_ROOT="${SCRIPT_DIR}/.."
ARTEFACTS_DIR="${REPO_ROOT}/3rd-party/artefacts"

WORKER_URL="${ARTEFACT_WORKER_URL:-https://artefacts.libroc.co}"
CURL_COMMON_ARGS=(
  --silent
  --show-error
  --http1.1
  --retry 5
  --retry-delay 2
  --retry-all-errors
  --connect-timeout 10
  --max-time 300
)

IS_MAC=false
if [[ "${OSTYPE:-}" == darwin* ]]; then
  IS_MAC=true
fi

supports_associative_arrays=true
if [[ "$IS_MAC" == true && ${BASH_VERSINFO[0]:-0} -lt 4 ]]; then
  supports_associative_arrays=false
fi

if [[ ! -d "$ARTEFACTS_DIR" ]]; then
  echo "Error: Artefacts directory not found: $ARTEFACTS_DIR" >&2
  exit 1
fi

cd "$REPO_ROOT"

if [[ "$supports_associative_arrays" == true ]]; then
  declare -A ARTEFACT_HASHES=()
else
  ARTEFACT_PATHS=()
  ARTEFACT_VALUES=()
fi

set_artefact_hash() {
  local path="$1"
  local hash="$2"

  if [[ "$supports_associative_arrays" == true ]]; then
    ARTEFACT_HASHES["$path"]="$hash"
    return
  fi

  local i
  for i in "${!ARTEFACT_PATHS[@]}"; do
    if [[ "${ARTEFACT_PATHS[$i]}" == "$path" ]]; then
      ARTEFACT_VALUES[$i]="$hash"
      return
    fi
  done

  ARTEFACT_PATHS+=("$path")
  ARTEFACT_VALUES+=("$hash")
}

get_artefact_hash() {
  local path="$1"

  if [[ "$supports_associative_arrays" == true ]]; then
    printf '%s' "${ARTEFACT_HASHES[$path]-}"
    return
  fi

  local i
  for i in "${!ARTEFACT_PATHS[@]}"; do
    if [[ "${ARTEFACT_PATHS[$i]}" == "$path" ]]; then
      printf '%s' "${ARTEFACT_VALUES[$i]}"
      return
    fi
  done
}

artefact_hash_count() {
  if [[ "$supports_associative_arrays" == true ]]; then
    printf '%s' "${#ARTEFACT_HASHES[@]}"
  else
    printf '%s' "${#ARTEFACT_PATHS[@]}"
  fi
}

list_artefact_paths() {
  if [[ "$supports_associative_arrays" == true ]]; then
    printf '%s\n' "${!ARTEFACT_HASHES[@]}"
  else
    printf '%s\n' "${ARTEFACT_PATHS[@]}"
  fi
}

sha256_file() {
  local local_path="$1"

  if [[ "$IS_MAC" == true ]]; then
    shasum -a 256 "$local_path" | awk '{print $1}'
  else
    sha256sum "$local_path" | awk '{print $1}'
  fi
}

extract_lfs_oid_from_input() {
  sed -n 's/^oid sha256://p' | tr -d '\r '
}

compute_local_hash() {
  local local_path="$1"
  if is_lfs_pointer_file "$local_path"; then
    extract_lfs_oid_from_input <"$local_path"
  else
    sha256_file "$local_path"
  fi
}

is_lfs_pointer_file() {
  local local_path="$1"
  grep -q '^version https://git-lfs.github.com/spec/v1' "$local_path" 2>/dev/null
}

echo "Discovering expected artefacts..."
while IFS= read -r path; do
  [[ -z "$path" ]] && continue
  [[ "$path" != 3rd-party/artefacts/*.tgz ]] && continue

  hash=$(git show "HEAD:${path}" 2>/dev/null | extract_lfs_oid_from_input || true)
  if [[ -z "$hash" ]]; then
    local_path="${REPO_ROOT}/${path}"
    if [[ -f "$local_path" ]]; then
      hash=$(compute_local_hash "$local_path")
    fi
  fi
  [[ -z "$hash" ]] && continue
  set_artefact_hash "$path" "$hash"
done < <(git ls-files '3rd-party/artefacts/*.tgz')

if [[ $(artefact_hash_count) -eq 0 ]]; then
  echo "No tracked artefacts found in git index; falling back to local files..."
  shopt -s nullglob
  local_files=("$ARTEFACTS_DIR"/*.tgz)
  shopt -u nullglob
  if [[ ${#local_files[@]} -eq 0 ]]; then
    echo "Error: No artefact files found in $ARTEFACTS_DIR" >&2
    exit 1
  fi

  for file in "${local_files[@]}"; do
    filepath="${file#$REPO_ROOT/}"
    hash=$(compute_local_hash "$file")
    [[ -z "$hash" ]] && continue
    set_artefact_hash "$filepath" "$hash"
  done
fi

echo "Found $(artefact_hash_count) expected artefact(s)"

SORTED_PATHS=()
if type mapfile >/dev/null 2>&1; then
  mapfile -t SORTED_PATHS < <(list_artefact_paths | sort)
else
  while IFS= read -r path; do
    SORTED_PATHS+=("$path")
  done < <(list_artefact_paths | sort)
fi

batch_check_ready=false
if [[ -n "${ARTEFACT_API_KEY:-}" ]] && command -v jq >/dev/null 2>&1; then
  CHECK_HASHES=()
  for path in "${SORTED_PATHS[@]}"; do
    CHECK_HASHES+=("$(get_artefact_hash "$path")")
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

  check_tmp=$(mktemp)
  if check_http_code=$(curl "${CURL_COMMON_ARGS[@]}" -w "%{http_code}" -X POST \
    -H "X-API-Key: ${ARTEFACT_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "$json_array" \
    -o "$check_tmp" \
    "${WORKER_URL}/batch-check"); then
    if [[ "$check_http_code" == "200" ]] && jq -e 'type=="object"' "$check_tmp" >/dev/null 2>&1; then
      check_result=$(cat "$check_tmp")
      batch_check_ready=true
    else
      echo "Warning: batch-check returned HTTP $check_http_code; falling back to direct downloads."
    fi
  else
    echo "Warning: batch-check request failed; falling back to direct downloads."
  fi
  rm -f "$check_tmp"
elif [[ -z "${ARTEFACT_API_KEY:-}" ]]; then
  echo "ARTEFACT_API_KEY is not set; skipping authenticated batch-check."
else
  echo "jq is not available; skipping batch-check."
fi

if [[ "$batch_check_ready" == true ]]; then
  MISSING_HASHES=()
  MISSING_PATHS=()

  for path in "${SORTED_PATHS[@]}"; do
    hash=$(get_artefact_hash "$path")
    filename=$(basename "$path")
    exists=$(echo "$check_result" | jq -r --arg h "$hash" '.[$h] // "false"')

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
echo "Downloading/validating artefacts..."

curl_get_headers=()
if [[ -n "${ARTEFACT_API_KEY:-}" ]]; then
  curl_get_headers=(-H "X-API-Key: ${ARTEFACT_API_KEY}")
fi

for path in "${SORTED_PATHS[@]}"; do
  hash=$(get_artefact_hash "$path")
  filename=$(basename "$path")
  local_path="${REPO_ROOT}/${path}"

  if [[ -f "$local_path" ]]; then
    if is_lfs_pointer_file "$local_path"; then
      echo "  ↻ $filename - LFS pointer detected, downloading binary artefact..."
    else
      local_hash=$(sha256_file "$local_path")
      if [[ "$local_hash" == "$hash" ]]; then
        echo "  ✓ $filename - already present (verified)"
        continue
      fi
    fi
  fi

  echo "  ↓ $filename (hash: ${hash:0:16}...) - downloading..."
  download_url="${WORKER_URL}/artefact/${hash}"
  tmp_file=$(mktemp)

  if ! curl "${CURL_COMMON_ARGS[@]}" --fail -X GET \
    "${curl_get_headers[@]}" \
    -o "$tmp_file" \
    "$download_url"; then
    echo "  ✗ Failed to download $filename" >&2
    rm -f "$tmp_file"
    exit 1
  fi

  downloaded_hash=$(sha256_file "$tmp_file")
  if [[ "$downloaded_hash" != "$hash" ]]; then
    echo "  ✗ Hash mismatch for $filename (expected $hash, got $downloaded_hash)" >&2
    rm -f "$tmp_file"
    exit 1
  fi

  mv "$tmp_file" "$local_path"
  echo "  ✓ Downloaded $filename"
done

echo ""
echo "Artefact pull complete"
