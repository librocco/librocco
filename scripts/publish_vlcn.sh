#!/usr/bin/env bash
#
# Publish forked @vlcn.io packages from the local vlcn-js checkout to
# npm.codemyriad.io under unique versions.
#
# Usage:
#   ./scripts/publish_vlcn.sh dev
#   MYRIAD_N=1 ./scripts/publish_vlcn.sh myriad
#   ./scripts/publish_vlcn.sh dev --dry-run
#
# Environment variables:
#   DRY_RUN=true      Stamp and check versions, then run pnpm publish --dry-run
#   PREPARE=true      Initialize submodules and build the vlcn-js checkout first
#   INSTALL=true      Install vlcn-js workspace dependencies before publishing
#   ALLOW_DIRTY=true  Allow publishing from a dirty vlcn-js worktree
#   MYRIAD_N=1        Required for the "myriad" track
#   VLCN_ROOT=...     Override the vlcn-js checkout path

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"

# shellcheck source=./publish_vlcn_config.sh
source "$SCRIPT_DIR/publish_vlcn_config.sh"

usage() {
	echo "Usage: $0 <dev|myriad> [--dry-run]" >&2
	echo "  --dry-run    Publish with --dry-run" >&2
}

parse_args() {
	local track=""
	DRY_RUN="${DRY_RUN:-false}"

	while [[ $# -gt 0 ]]; do
		case "$1" in
			dev | myriad)
				if [[ -n "$track" ]]; then
					echo "Error: track specified more than once" >&2
					usage
					exit 1
				fi
				track="$1"
				;;
			--dry-run | -n)
				DRY_RUN="true"
				;;
			--help | -h)
				usage
				exit 0
				;;
			*)
				echo "Error: unknown argument '$1'" >&2
				usage
				exit 1
				;;
			esac
			shift
		done

	TRACK="$track"
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
	npx --yes "pnpm@${PNPM_VERSION}" "$@"
}

prepare_checkout() {
	echo "==> Preparing vlcn-js checkout at $VLCN_ROOT"
	git -C "$VLCN_ROOT" submodule update --init --recursive
	(
		cd "$VLCN_ROOT"
		make
	)
}

install_workspace() {
	echo "==> Installing vlcn-js workspace dependencies..."
	(
		cd "$VLCN_ROOT"
		pnpm_cmd install --frozen-lockfile
	)
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
	if [[ ${#STAMPED_FILES[@]} -eq 0 ]]; then
		return
	fi

	echo ""
	echo "==> Restoring package.json files..."
	for i in "${!STAMPED_FILES[@]}"; do
		cp "${BACKUP_FILES[$i]}" "${STAMPED_FILES[$i]}"
	done
}

cleanup() {
	restore_files

	if [[ -d "$BACKUP_DIR" ]]; then
		rm -rf "$BACKUP_DIR"
	fi
}

STAMPED_FILES=()
BACKUP_FILES=()
BACKUP_DIR=""

trap cleanup EXIT

require_cmd git
require_cmd jq
require_cmd npm
require_cmd npx


parse_args "$@"

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

PREPARE="${PREPARE:-false}"
INSTALL="${INSTALL:-true}"
ALLOW_DIRTY="${ALLOW_DIRTY:-false}"
DRY_RUN="${DRY_RUN:-false}"

if [[ "$PREPARE" == "true" ]]; then
	prepare_checkout
elif [[ "$INSTALL" == "true" ]]; then
	install_workspace
fi

for required_pkg in "$VLCN_ROOT/deps/cr-sqlite/core/package.json" "$VLCN_ROOT/deps/wa-sqlite/package.json"; do
	if [[ ! -f "$required_pkg" ]]; then
		echo "Error: missing $required_pkg. Run with PREPARE=true or initialize submodules first." >&2
		exit 1
	fi
done

WORKTREE_STATE="$(git -C "$VLCN_ROOT" status --short --ignore-submodules=none)"
if [[ -n "$WORKTREE_STATE" && "$ALLOW_DIRTY" != "true" ]]; then
	echo "Error: vlcn-js worktree is dirty. Commit the fork state before publishing." >&2
	echo "$WORKTREE_STATE" >&2
	exit 1
fi

SHORT_SHA="$(git -C "$VLCN_ROOT" rev-parse --short=8 HEAD)"

case "$TRACK" in
	dev)
		DATE_STAMP="$(date -u +%Y%m%d%H%M%S)"
		VERSION_SUFFIX="dev.${DATE_STAMP}.${SHORT_SHA}"
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
echo "==> Dry run: $DRY_RUN"
echo ""

STAMPED_FILES=()
BACKUP_FILES=()
BACKUP_DIR="$(mktemp -d)"

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

	backup_path="$BACKUP_DIR/$(printf '%03d.json' "${#STAMPED_FILES[@]}")"
	cp "$pkg_json" "$backup_path"

	new_version="$(stamp_version "$pkg_json")"
	VERSION_MAP["$name"]="$new_version"
	STAMPED_FILES+=("$pkg_json")
	BACKUP_FILES+=("$backup_path")

	echo "  ${name}@${new_version}"
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