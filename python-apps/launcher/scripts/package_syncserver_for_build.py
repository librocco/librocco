#!/usr/bin/env -S uv run --quiet --script
# /// script
# dependencies = []
# ///
"""
Package sync server for PyInstaller bundling.

This script:
1. Builds the sync server with esbuild (TypeScript → JavaScript)
2. Copies the bundled server to bundled_syncserver/
3. Installs production dependencies with npm (no dev dependencies)
4. Copies database schemas

The bundled sync server includes platform-specific native binaries:
- better-sqlite3.node (SQLite3 bindings)
- crsqlite.so/.dylib/.dll (CR-SQLite extension)
"""

import sys
import shutil
import subprocess
import json
import os
from pathlib import Path

# Project paths
launcher_dir = Path(__file__).parent.parent
sync_server_dir = launcher_dir.parent.parent / "apps" / "sync-server"
bundled_dir = launcher_dir / "bundled_syncserver"


def run_command(cmd: list[str], cwd: Path = None, description: str = ""):
    """Run a command and handle errors."""
    print(f"→ {description or ' '.join(cmd)}")
    try:
        subprocess.run(cmd, cwd=cwd, check=True, capture_output=True, text=True)
    except subprocess.CalledProcessError as e:
        print(f"✗ Command failed: {' '.join(cmd)}", file=sys.stderr)
        print(f"  Error: {e.stderr}", file=sys.stderr)
        raise


def main():
    """Package sync server for PyInstaller."""

    print("Packaging sync server for PyInstaller build...")
    print(f"Sync server dir: {sync_server_dir}")
    print(f"Bundled dir: {bundled_dir}")
    print()

    # Step 1: Build sync server with esbuild
    print("[1/4] Building sync server with esbuild...")
    run_command(
        ["npm", "run", "build"], cwd=sync_server_dir, description="Building sync server"
    )

    # Verify build output
    compiled_server = sync_server_dir / "dist" / "syncserver.mjs"
    if not compiled_server.exists():
        print(f"✗ Build failed: {compiled_server} not found", file=sys.stderr)
        return 1
    print(
        f"✓ Built: {compiled_server} ({compiled_server.stat().st_size / 1024:.0f} KB)"
    )
    print()

    # Step 2: Create bundled directory structure
    print("[2/4] Creating bundled directory...")
    if bundled_dir.exists():
        print(f"  Removing existing {bundled_dir}")
        shutil.rmtree(bundled_dir)
    bundled_dir.mkdir(parents=True)

    # Copy compiled server
    dest_server = bundled_dir / "syncserver.mjs"
    shutil.copy2(compiled_server, dest_server)
    print(f"✓ Copied: {dest_server}")
    print()

    # Step 3: Install production dependencies with npm
    print("[3/4] Installing production dependencies with npm...")

    artefacts_dir = launcher_dir.parent.parent / "3rd-party" / "artefacts"
    custom_packages = {
        "@vlcn.io/crsqlite": "vlcn.io-crsqlite-0.16.3.tgz",
        "@vlcn.io/ws-server": "vlcn.io-ws-server-0.2.2.tgz",
        "@vlcn.io/ws-common": "vlcn.io-ws-common-0.2.0.tgz",
        "@vlcn.io/ws-client": "vlcn.io-ws-client-0.2.0.tgz",
        "@vlcn.io/ws-browserdb": "vlcn.io-ws-browserdb-0.2.0.tgz",
        "@vlcn.io/rx-tbl": "vlcn.io-rx-tbl-0.15.0.tgz",
        "@vlcn.io/wa-sqlite": "vlcn.io-wa-sqlite-0.22.0.tgz",
        "@vlcn.io/crsqlite-wasm": "vlcn.io-crsqlite-wasm-0.16.0.tgz",
        "@vlcn.io/xplat-api": "vlcn.io-xplat-api-0.15.0.tgz",
    }

    resolved_custom = {}
    for pkg, filename in custom_packages.items():
        tgz_path = artefacts_dir / filename
        if not tgz_path.exists():
            print(f"✗ Custom package tarball not found: {tgz_path}", file=sys.stderr)
            return 1
        resolved_custom[pkg] = f"file:{os.path.relpath(tgz_path, bundled_dir)}"

    # Create a minimal package.json for bundling
    # Only runtime dependencies, no devDependencies
    package_json = {
        "name": "librocco-syncserver-bundled",
        "version": "0.0.1",
        "type": "module",
        "private": True,
        "dependencies": {
            "@vlcn.io/ws-server": resolved_custom["@vlcn.io/ws-server"],
            "@vlcn.io/crsqlite": resolved_custom["@vlcn.io/crsqlite"],
            "@vlcn.io/logger-provider": "0.2.0",
            "@vlcn.io/ws-common": resolved_custom["@vlcn.io/ws-common"],
            "better-sqlite3": "~11.4.0",
        },
        "overrides": {
            **resolved_custom,
        },
    }

    # Write package.json
    package_json_path = bundled_dir / "package.json"
    with open(package_json_path, "w") as f:
        json.dump(package_json, f, indent=2)
    print(f"✓ Created: {package_json_path}")

    # Run npm install (production only, no optional deps)
    print(f"  Running npm install (this may take a moment)...")
    run_command(
        ["npm", "install", "--production", "--no-optional"],
        cwd=bundled_dir,
        description="Installing dependencies with npm",
    )

    # Count packages installed
    node_modules_dest = bundled_dir / "node_modules"
    if node_modules_dest.exists():
        package_count = len(
            [
                d
                for d in node_modules_dest.iterdir()
                if d.is_dir() and not d.name.startswith(".")
            ]
        )
        node_modules_size = sum(
            f.stat().st_size for f in node_modules_dest.rglob("*") if f.is_file()
        )
        print(
            f"✓ Installed {package_count} top-level packages (~{node_modules_size / 1024 / 1024:.0f} MB)"
        )
    else:
        print(f"✗ node_modules not created", file=sys.stderr)
        return 1
    print()

    # Step 4: Copy database schemas
    print("[4/4] Copying database schemas...")
    schemas_source = sync_server_dir / "schemas"
    schemas_dest = bundled_dir / "schemas"

    if schemas_source.exists():
        shutil.copytree(schemas_source, schemas_dest)
        schema_files = list(schemas_dest.rglob("*"))
        print(f"✓ Copied {len(schema_files)} schema files")
    else:
        print(f"  Warning: Schemas not found at {schemas_source}", file=sys.stderr)
    print()

    # Summary
    print("=" * 60)
    print("✓ Sync server packaged successfully!")
    print(f"✓ Output: {bundled_dir}")

    # Calculate size
    total_size = sum(f.stat().st_size for f in bundled_dir.rglob("*") if f.is_file())
    print(f"✓ Total size: {total_size / 1024 / 1024:.1f} MB")
    print("=" * 60)

    return 0


if __name__ == "__main__":
    sys.exit(main())
