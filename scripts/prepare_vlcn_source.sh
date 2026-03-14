#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd -- "${SCRIPT_DIR}/.." && pwd)

VLCN_ROOT="${VLCN_ROOT:-${REPO_ROOT}/3rd-party/js}"
TYPED_SQL_ROOT="${TYPED_SQL_ROOT:-$(cd -- "${VLCN_ROOT}/.." && pwd)/typed-sql}"
PNPM_INSTALL_ARGS="${PNPM_INSTALL_ARGS:---force --no-frozen-lockfile}"

if ! command -v npx >/dev/null 2>&1; then
	echo "Error: npx is required but was not found in PATH." >&2
	exit 1
fi

if [[ ! -d "${VLCN_ROOT}" ]]; then
	echo "Error: VLCN_ROOT does not exist: ${VLCN_ROOT}" >&2
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
echo "==> Local vlcn source mode is ready"
echo "   Example: VLCN_ROOT=${VLCN_ROOT} rushx start"
