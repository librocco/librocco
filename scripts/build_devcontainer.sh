#!/bin/bash
# Build the devcontainer image locally
# Usage: ./scripts/build_devcontainer.sh [tag]

set -e

TAG="${1:-ghcr.io/librocco/librocco/devcontainer:latest}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Building devcontainer image: $TAG"
docker build -f "$REPO_ROOT/.devcontainer/Dockerfile" -t "$TAG" "$REPO_ROOT"

echo "Done. To use this image:"
echo "  devcontainer up --workspace-folder $REPO_ROOT"
