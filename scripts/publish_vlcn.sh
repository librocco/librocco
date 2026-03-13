#!/usr/bin/env bash
#
# Publish forked @vlcn.io packages from the local vlcn-js checkout to
# npm.codemyriad.io under unique versions.
#
# Usage:
#   ./scripts/publish_vlcn.sh dev
#   MYRIAD_N=1 ./scripts/publish_vlcn.sh myriad
#
# Environment variables:
#   DRY_RUN=true      Stamp and check versions, then run pnpm publish --dry-run
#   PREPARE=true      Initialize submodules and run the vlcn-js build pipeline first
#   INSTALL=true      Install vlcn-js workspace dependencies when PREPARE=false
#   ALLOW_DIRTY=true  Allow publishing from a dirty vlcn-js worktree
#   MYRIAD_N=1        Required for the "myriad" track
#   PNPM_INSTALL_ARGS Pass extra arguments to pnpm install (for example "--force")
#   PNPM_VERSION=...  Override the pnpm version used for the target checkout
#   VLCN_ROOT=...     Override the vlcn-js checkout path

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"

# shellcheck source=./publish_vlcn_config.sh
source "$SCRIPT_DIR/publish_vlcn_config.sh"

usage() {
	echo "Usage: $0 <dev|myriad>" >&2
}

require_cmd() {
	local cmd="$1"
	if ! command -v "$cmd" >/dev/null 2>&1; then
		echo "Error: required command '$cmd' is not available" >&2
		exit 1
	fi
}

pkg_name() {
	echo "${1%%:*}"
}

pkg_dir() {
	echo "$VLCN_ROOT/${1##*:}"
}

pnpm_cmd() {
	npx --yes "pnpm@${EFFECTIVE_PNPM_VERSION}" "$@"
}

backup_file() {
	local target="$1"
	local backup_path="$BACKUP_DIR/$(printf '%03d-%s' "${#RESTORE_TARGETS[@]}" "$(basename "$target")")"

	cp "$target" "$backup_path"
	RESTORE_TARGETS+=("$target")
	RESTORE_BACKUPS+=("$backup_path")
}

track_created_path() {
	local target="$1"
	CREATED_PATHS+=("$target")
}

resolve_crsqlite_host_platform() {
	local host_os
	local host_arch
	local binary_ext

	host_os="$(uname -s)"
	host_arch="$(uname -m)"

	case "$host_os" in
		Linux)
			host_os="linux"
			binary_ext="so"
			;;
		Darwin)
			host_os="darwin"
			binary_ext="dylib"
			;;
		MINGW* | MSYS* | CYGWIN*)
			host_os="win"
			binary_ext="dll"
			;;
		*)
			echo "Error: unsupported crsqlite publish host OS: $host_os" >&2
			exit 1
			;;
	esac

	case "$host_arch" in
		x86_64 | amd64)
			host_arch="x86_64"
			;;
		arm64 | aarch64)
			host_arch="aarch64"
			;;
		*)
			echo "Error: unsupported crsqlite publish host architecture: $host_arch" >&2
			exit 1
			;;
	esac

	echo "$host_os $host_arch $binary_ext"
}

append_json_array_value() {
	local json_path="$1"
	local value="$2"

	jq --arg value "$value" '
		.files = (((.files // []) + [$value]) | unique)
	' "$json_path" > "${json_path}.tmp"
	mv "${json_path}.tmp" "$json_path"
}

prepare_crsqlite_publish_payload() {
	local pkg_dir="$1"
	local pkg_json="$2"
	local helper_path="$pkg_dir/nodejs-install-helper.js"
	local host_os
	local host_arch
	local binary_ext
	local source_binary
	local binaries_root
	local platform_dir
	local packaged_binary

	read -r host_os host_arch binary_ext < <(resolve_crsqlite_host_platform)

	source_binary="$pkg_dir/dist/crsqlite.${binary_ext}"
	if [[ ! -f "$source_binary" ]]; then
		echo "Error: missing crsqlite binary at $source_binary" >&2
		echo "Run with PREPARE=true on a supported host before publishing." >&2
		exit 1
	fi

	binaries_root="$pkg_dir/binaries"
	platform_dir="$binaries_root/${host_os}-${host_arch}"
	packaged_binary="$platform_dir/crsqlite.${binary_ext}"

	if [[ ! -d "$binaries_root" ]]; then
		track_created_path "$binaries_root"
	elif [[ ! -d "$platform_dir" ]]; then
		track_created_path "$platform_dir"
	fi

	mkdir -p "$platform_dir"
	cp "$source_binary" "$packaged_binary"
	track_created_path "$packaged_binary"

	backup_file "$helper_path"
	cp "$SCRIPT_DIR/publish_vlcn_crsqlite_nodejs_install_helper.js" "$helper_path"
	append_json_array_value "$pkg_json" "binaries/**/*"

	echo "  bundled crsqlite ${host_os}-${host_arch} binary from ${source_binary}"
}

prepare_crsqlite_prebuilt_install() {
	local pkg_dir="$VLCN_ROOT/deps/cr-sqlite/core"
	local dist_dir="$pkg_dir/dist"
	local host_os
	local host_arch
	local binary_ext
	local dist_binary
	local dist_zip

	read -r host_os host_arch binary_ext < <(resolve_crsqlite_host_platform)

	dist_binary="$dist_dir/crsqlite.${binary_ext}"
	dist_zip="$dist_dir/crsqlite.zip"

	for target in "$dist_binary" "$dist_zip"; do
		if [[ -e "$target" ]]; then
			backup_file "$target"
			rm -f "$target"
		else
			track_created_path "$target"
		fi
	done
}

pnpm_install_cmd() {
	local install_args=(install --frozen-lockfile --link-workspace-packages=true)

	if [[ -n "${PNPM_INSTALL_ARGS:-}" ]]; then
		local extra_install_args
		# shellcheck disable=SC2206
		extra_install_args=($PNPM_INSTALL_ARGS)
		install_args+=("${extra_install_args[@]}")
	fi

	pnpm_cmd "${install_args[@]}"
}

resolve_pnpm_version() {
	if [[ -n "${PNPM_VERSION:-}" ]]; then
		echo "$PNPM_VERSION"
		return
	fi

	if [[ -f "$VLCN_ROOT/package.json" ]]; then
		local package_manager
		package_manager="$(jq -r '.packageManager // empty' "$VLCN_ROOT/package.json")"
		if [[ "$package_manager" == pnpm@* ]]; then
			echo "${package_manager#pnpm@}"
			return
		fi
	fi

	echo "$DEFAULT_PNPM_VERSION"
}

prepare_checkout() {
	echo "==> Preparing vlcn-js checkout at $VLCN_ROOT"
	git -C "$VLCN_ROOT" submodule update --init --recursive

	if [[ ! -x "$VLCN_TYPED_SQL_ROOT/packages/type-gen/build.sh" ]]; then
		echo "Error: typed-sql build script not found at $VLCN_TYPED_SQL_ROOT/packages/type-gen/build.sh" >&2
		echo "Create a sibling typed-sql checkout or override VLCN_TYPED_SQL_ROOT." >&2
		exit 1
	fi

	(
		cd "$VLCN_ROOT"
		cd "$VLCN_TYPED_SQL_ROOT/packages/type-gen"
		./build.sh
		cd "$VLCN_ROOT"
		# Force crsqlite's install helper to refresh the host binary from the
		# release asset path instead of reusing a stale locally built dist file.
		prepare_crsqlite_prebuilt_install
		pnpm_install_cmd
		./build-wasm.sh
		cd tsbuild-all
		pnpm_cmd run build
	)
}

install_workspace() {
	echo "==> Installing vlcn-js workspace dependencies..."
	(
		cd "$VLCN_ROOT"
		pnpm_install_cmd
	)
}

verify_publish_outputs() {
	local required_paths=(
		"$VLCN_ROOT/deps/cr-sqlite/core/package.json"
		"$VLCN_ROOT/deps/cr-sqlite/core/nodejs-install-helper.js"
		"$VLCN_ROOT/deps/cr-sqlite/core/nodejs-helper.js"
		"$VLCN_ROOT/deps/wa-sqlite/package.json"
		"$VLCN_ROOT/packages/xplat-api/dist/xplat-api.js"
		"$VLCN_ROOT/packages/xplat-api/dist/xplat-api.d.ts"
		"$VLCN_ROOT/packages/ws-common/dist/index.js"
		"$VLCN_ROOT/packages/ws-client/dist/index.js"
		"$VLCN_ROOT/packages/ws-server/dist/index.js"
		"$VLCN_ROOT/packages/crsqlite-wasm/dist/index.js"
		"$VLCN_ROOT/packages/crsqlite-wasm/dist/crsqlite.wasm"
	)

	for path in "${required_paths[@]}"; do
		if [[ ! -f "$path" ]]; then
			echo "Error: missing publish output $path" >&2
			echo "Run with PREPARE=true or prepare the vlcn-js checkout before publishing." >&2
			exit 1
		fi
	done
}

stamp_version() {
	local pkg_json="$1"
	local base_version
	local new_version

	base_version="$(jq -r '.version' "$pkg_json")"
	new_version="${base_version}-${VERSION_SUFFIX}"
	jq --arg v "$new_version" '.version = $v' "$pkg_json" > "${pkg_json}.tmp"
	mv "${pkg_json}.tmp" "$pkg_json"
	echo "$new_version"
}

check_registry() {
	local name="$1"
	local version="$2"

	if npm view "${name}@${version}" version --registry "$REGISTRY_URL" >/dev/null 2>&1; then
		echo "Error: ${name}@${version} already exists on ${REGISTRY_URL}" >&2
		return 1
	fi
}

restore_files() {
	if [[ ${#CREATED_PATHS[@]} -gt 0 ]]; then
		echo ""
		echo "==> Removing temporary publish payloads..."
		for ((i=${#CREATED_PATHS[@]} - 1; i>=0; --i)); do
			rm -rf "${CREATED_PATHS[$i]}"
		done
	fi

	if [[ ${#RESTORE_TARGETS[@]} -eq 0 ]]; then
		return
	fi

	echo ""
	echo "==> Restoring publish files..."
	for i in "${!RESTORE_TARGETS[@]}"; do
		cp "${RESTORE_BACKUPS[$i]}" "${RESTORE_TARGETS[$i]}"
	done
}

cleanup() {
	restore_files

	if [[ -n "$BACKUP_DIR" && -d "$BACKUP_DIR" ]]; then
		rm -rf "$BACKUP_DIR"
	fi
}

RESTORE_TARGETS=()
RESTORE_BACKUPS=()
CREATED_PATHS=()
BACKUP_DIR=""
trap cleanup EXIT

require_cmd git
require_cmd jq
require_cmd npm
require_cmd npx

TRACK="${1:-}"
if [[ -z "$TRACK" ]]; then
	usage
	exit 1
fi

case "$TRACK" in
	dev | myriad)
		;;
	*)
		echo "Error: track must be 'dev' or 'myriad', got '$TRACK'" >&2
		usage
		exit 1
		;;
esac

if [[ ! -d "$VLCN_ROOT/.git" && ! -f "$VLCN_ROOT/.git" ]]; then
	echo "Error: vlcn-js checkout not found at $VLCN_ROOT" >&2
	exit 1
fi

EFFECTIVE_PNPM_VERSION="$(resolve_pnpm_version)"

PREPARE="${PREPARE:-true}"
INSTALL="${INSTALL:-true}"
ALLOW_DIRTY="${ALLOW_DIRTY:-false}"
DRY_RUN="${DRY_RUN:-false}"

SOURCE_WORKTREE_STATE="$(git -C "$VLCN_ROOT" status --short --ignore-submodules=none)"
if [[ -n "$SOURCE_WORKTREE_STATE" && "$ALLOW_DIRTY" != "true" ]]; then
	echo "Error: vlcn-js worktree is dirty. Commit the fork state before publishing." >&2
	echo "$SOURCE_WORKTREE_STATE" >&2
	exit 1
fi

BACKUP_DIR="$(mktemp -d)"

if [[ "$PREPARE" == "true" ]]; then
	prepare_checkout
elif [[ "$INSTALL" == "true" ]]; then
	install_workspace
fi

verify_publish_outputs

SHORT_SHA="$(git -C "$VLCN_ROOT" rev-parse --short=8 HEAD)"

case "$TRACK" in
	dev)
		TIMESTAMP_UTC="$(date -u +%Y%m%d%H%M%S)"
		VERSION_SUFFIX="dev.${TIMESTAMP_UTC}.${SHORT_SHA}"
		DIST_TAG="$DEV_DIST_TAG"
		;;
	myriad)
		if [[ -z "${MYRIAD_N:-}" ]]; then
			echo "Error: MYRIAD_N must be set for the myriad track" >&2
			exit 1
		fi
		VERSION_SUFFIX="myriad.${MYRIAD_N}"
		DIST_TAG="$MYRIAD_DIST_TAG"
		;;
esac

echo "==> Track: $TRACK"
echo "==> vlcn-js root: $VLCN_ROOT"
echo "==> Source SHA: $SHORT_SHA"
echo "==> Version suffix: $VERSION_SUFFIX"
echo "==> Registry: $REGISTRY_URL"
echo "==> Dist tag: $DIST_TAG"
echo "==> pnpm version: $EFFECTIVE_PNPM_VERSION"
echo "==> pnpm install args: ${PNPM_INSTALL_ARGS:-<none>}"
echo "==> Dry run: $DRY_RUN"
echo ""

declare -A VERSION_MAP

echo "==> Stamping versions..."
for entry in "${PUBLISH_PACKAGES[@]}"; do
	name="$(pkg_name "$entry")"
	dir="$(pkg_dir "$entry")"
	pkg_json="$dir/package.json"

	if [[ ! -f "$pkg_json" ]]; then
		echo "Error: $pkg_json not found" >&2
		exit 1
	fi

	backup_file "$pkg_json"

	new_version="$(stamp_version "$pkg_json")"
	VERSION_MAP["$name"]="$new_version"

	echo "  ${name}@${new_version}"

	if [[ "$name" == "@vlcn.io/crsqlite" ]]; then
		prepare_crsqlite_publish_payload "$dir" "$pkg_json"
	fi
done

echo ""
echo "==> Checking registry for existing versions..."
for entry in "${PUBLISH_PACKAGES[@]}"; do
	name="$(pkg_name "$entry")"
	version="${VERSION_MAP[$name]}"
	check_registry "$name" "$version"
	echo "  ${name}@${version} - available"
done

echo ""
echo "==> Publishing..."
for entry in "${PUBLISH_PACKAGES[@]}"; do
	name="$(pkg_name "$entry")"
	dir="$(pkg_dir "$entry")"
	version="${VERSION_MAP[$name]}"

	echo "  Publishing ${name}@${version}..."
	args=(publish "$dir" --registry "$REGISTRY_URL" --tag "$DIST_TAG" --no-git-checks)
	if [[ "$DRY_RUN" == "true" ]]; then
		args+=(--dry-run)
	fi
	pnpm_cmd "${args[@]}"
done

echo ""
echo "==> Done"
