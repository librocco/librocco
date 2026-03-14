#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd -- "${SCRIPT_DIR}/.." && pwd)
VENDOR_SOURCE_STATE_DIR="${REPO_ROOT}/.librocco"
VENDOR_SOURCE_STATE_FILE="${VENDOR_SOURCE_STATE_DIR}/vendor-source.json"

VLCN_ROOT="${VLCN_ROOT:-${REPO_ROOT}/3rd-party/js}"
TYPED_SQL_ROOT="${TYPED_SQL_ROOT:-}"
PNPM_INSTALL_ARGS="${PNPM_INSTALL_ARGS:---force --no-frozen-lockfile}"
DISABLE_SOURCE_MODE=0

usage() {
	cat <<'EOF'
Usage:
  ./scripts/prepare_vlcn_source.sh
  ./scripts/prepare_vlcn_source.sh --vlcn-root /path/to/vlcn-js
  ./scripts/prepare_vlcn_source.sh --typed-sql-root /path/to/typed-sql
  ./scripts/prepare_vlcn_source.sh --disable

Notes:
  - Normal Librocco commands stay the same after preparation: use `rush` / `rushx`.
  - `VLCN_ROOT` remains supported as an escape hatch, but `--vlcn-root` is preferred.
EOF
}

while [[ $# -gt 0 ]]; do
	case "$1" in
		--vlcn-root)
			VLCN_ROOT="$2"
			shift 2
			;;
		--typed-sql-root)
			TYPED_SQL_ROOT="$2"
			shift 2
			;;
		--disable)
			DISABLE_SOURCE_MODE=1
			shift
			;;
		-h|--help)
			usage
			exit 0
			;;
		*)
			echo "Error: unknown argument: $1" >&2
			usage >&2
			exit 1
			;;
	esac
done

resolve_path_or_empty() {
	local input_path="$1"
	if [[ "${input_path}" == /* ]]; then
		printf '%s\n' "${input_path}"
		return 0
	fi
	if cd -- "${input_path}" 2>/dev/null; then
		pwd
		return 0
	fi
	return 1
}

if [[ -n "${VLCN_ROOT:-}" && "${VLCN_ROOT}" != /* ]]; then
	VLCN_ROOT="$(resolve_path_or_empty "${VLCN_ROOT}" || true)"
fi

if [[ -z "${VLCN_ROOT}" ]]; then
	echo "Error: could not resolve vlcn-js root" >&2
	exit 1
fi

if [[ ${DISABLE_SOURCE_MODE} -eq 1 ]]; then
	rm -f "${VENDOR_SOURCE_STATE_FILE}"
	rmdir "${VENDOR_SOURCE_STATE_DIR}" 2>/dev/null || true
	echo "==> Source mode disabled; Librocco will use @vlcn.io packages from npm.codemyriad.io"
	exit 0
fi

if [[ ! -d "${VLCN_ROOT}" ]]; then
	echo "Error: vlcn-js checkout does not exist: ${VLCN_ROOT}" >&2
	exit 1
fi

if [[ -n "${TYPED_SQL_ROOT}" && "${TYPED_SQL_ROOT}" != /* ]]; then
	TYPED_SQL_ROOT="$(resolve_path_or_empty "${TYPED_SQL_ROOT}" || true)"
fi

if [[ -z "${TYPED_SQL_ROOT}" ]]; then
	TYPED_SQL_ROOT="$(cd -- "${VLCN_ROOT}/.." && pwd)/typed-sql"
fi

if ! command -v npx >/dev/null 2>&1; then
	echo "Error: npx is required but was not found in PATH." >&2
	exit 1
fi

resolve_pnpm_version() {
	node - "$1" <<'EOF'
const fs = require("fs");
const packageJsonPath = process.argv[2];
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const match = String(packageJson.packageManager || "").match(/^pnpm@(.+)$/);
if (match) {
	const version = match[1];
	const major = Number.parseInt(version.split(".")[0], 10);
	process.stdout.write(Number.isFinite(major) && major >= 9 ? version : "9.15.9");
	process.exit(0);
}
const enginesPnpm = packageJson.engines && packageJson.engines.pnpm;
if (typeof enginesPnpm === "string" && enginesPnpm.trim()) {
	process.stdout.write("9.15.9");
	process.exit(0);
}
process.stdout.write("9.15.9");
EOF
}

echo "==> Preparing local vlcn source mode"
echo "==> VLCN_ROOT: ${VLCN_ROOT}"
echo "==> TYPED_SQL_ROOT: ${TYPED_SQL_ROOT}"

echo "==> Initializing vlcn-js submodules"
git -C "${VLCN_ROOT}" submodule update --init --recursive

if [[ ! -f "${VLCN_ROOT}/package.json" ]]; then
	echo "Error: VLCN_ROOT does not look like a vlcn-js checkout after submodule init: ${VLCN_ROOT}" >&2
	exit 1
fi

VLCN_PNPM_VERSION="${PNPM_VERSION:-${VLCN_PNPM_VERSION:-$(resolve_pnpm_version "${VLCN_ROOT}/package.json")}}"
VLCN_PNPM_CMD=(npx --yes "pnpm@${VLCN_PNPM_VERSION}")

echo "==> vlcn-js pnpm version: ${VLCN_PNPM_VERSION}"
echo "==> pnpm install args: ${PNPM_INSTALL_ARGS}"
echo

if [[ -d "${TYPED_SQL_ROOT}/packages/type-gen" ]]; then
	echo
	echo "==> Preparing typed-sql type-gen package"
	(
		cd "${TYPED_SQL_ROOT}"
		if [[ ! -f "./packages/type-gen/pkg/package.json" && -x "./packages/type-gen/build.sh" ]]; then
			echo "==> Bootstrapping typed-sql type-gen workspace package"
			(
				cd ./packages/type-gen
				./build.sh
			)
		else
			echo "==> typed-sql type-gen package already present"
		fi
	)
else
	echo
	echo "==> typed-sql type-gen checkout not found at ${TYPED_SQL_ROOT}; continuing without it"
fi

echo
echo "==> Installing and building vlcn-js"
(
	cd "${VLCN_ROOT}"
	"${VLCN_PNPM_CMD[@]}" install ${PNPM_INSTALL_ARGS}
	if [[ -x "./build-wasm.sh" ]]; then
		./build-wasm.sh
	fi
	if [[ -d "./tsbuild-all" ]]; then
		(
			cd ./tsbuild-all
			"${VLCN_PNPM_CMD[@]}" build
		)
	fi
)

required_outputs=(
	"deps/cr-sqlite/core/nodejs-helper.js"
	"packages/crsqlite-wasm/dist/index.js"
	"packages/rx-tbl/dist/index.js"
	"packages/logger-provider/dist/index.js"
	"packages/ws-browserdb/dist/index.js"
	"packages/ws-client/dist/index.js"
	"packages/ws-client/dist/worker/worker.js"
	"packages/ws-common/dist/index.js"
	"packages/ws-server/dist/index.js"
	"packages/xplat-api/dist/xplat-api.js"
)

echo
echo "==> Verifying required build outputs"
for relative_path in "${required_outputs[@]}"; do
	if [[ ! -e "${VLCN_ROOT}/${relative_path}" ]]; then
		echo "Error: missing ${VLCN_ROOT}/${relative_path}" >&2
		exit 1
	fi
done

echo
mkdir -p "${VENDOR_SOURCE_STATE_DIR}"
node - "${VENDOR_SOURCE_STATE_FILE}" "${VLCN_ROOT}" "${TYPED_SQL_ROOT}" <<'EOF'
const fs = require("fs");
const [stateFile, vlcnRoot, typedSqlRoot] = process.argv.slice(2);
fs.writeFileSync(
	stateFile,
	`${JSON.stringify({ vlcnRoot, typedSqlRoot }, null, 2)}\n`
);
EOF

echo "==> Source mode enabled"
echo "==> Stored source-mode config at ${VENDOR_SOURCE_STATE_FILE}"
echo
echo "==> Local vlcn source mode is ready"
echo "   Librocco commands now auto-detect local vendor sources."
echo "   Example: cd apps/web-client && rushx start"
echo "   Fast TS rebuilds: cd ${VLCN_ROOT}/tsbuild-all && pnpm build"
echo "   Disable source mode: ./scripts/prepare_vlcn_source.sh --disable"
