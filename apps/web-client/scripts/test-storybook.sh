#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="${STORYBOOK_OUTPUT_DIR:-/tmp/librocco-web-client-storybook}"
HOST="${STORYBOOK_HOST:-127.0.0.1}"
PORT="${STORYBOOK_PORT:-6006}"
URL="http://${HOST}:${PORT}"
CONFIG_DIR="${ROOT_DIR}/.storybook"

server_pid=""

cleanup() {
	if [[ -n "${server_pid}" ]]; then
		kill "${server_pid}" >/dev/null 2>&1 || true
		wait "${server_pid}" >/dev/null 2>&1 || true
	fi
}

trap cleanup EXIT

cd "${ROOT_DIR}"

npx storybook build --output-dir "${OUTPUT_DIR}"
npx http-server "${OUTPUT_DIR}" --host "${HOST}" --port "${PORT}" --silent &
server_pid=$!
npx wait-on "tcp:${HOST}:${PORT}"
STORYBOOK_PROJECT_ROOT="${ROOT_DIR}" npx test-storybook --config-dir "${CONFIG_DIR}" --index-json --url "${URL}" --includeTags=test-only
