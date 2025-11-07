#!/usr/bin/env -S uv run --quiet --script
# /// script
# dependencies = ["requests"]
# ///
"""Download Node.js binary for PyInstaller bundling."""

import subprocess
import sys
from pathlib import Path

import platform

# Add parent directory to path to import from launcher package
launcher_dir = Path(__file__).parent.parent
sys.path.insert(0, str(launcher_dir))

from launcher.binary_manager import BinaryManager


def main() -> int:
    """Download Node.js for the current platform to bundled_binaries/."""

    binary_name = "node.exe" if platform.system() == "Windows" else "node"

    bundled_binaries_dir = launcher_dir / "bundled_binaries"
    bundled_binaries_dir.mkdir(exist_ok=True)

    node_path = bundled_binaries_dir / binary_name

    print(f"Downloading Node.js {BinaryManager.NODE_VERSION} for bundling...")
    print(f"Platform: {platform.system()} {platform.machine()}")
    print(f"Destination: {node_path}")
    print()

    manager = BinaryManager(node_path, binary_type="node")

    try:
        if manager.ensure_binary():
            version_proc = subprocess.run(
                [str(node_path), "--version"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            version_string = version_proc.stdout.strip() or version_proc.stderr.strip()

            print()
            print("✓ Node.js binary ready for bundling!")
            if version_string:
                print(f"✓ Reported version: {version_string}")
            print(f"✓ Binary available at: {node_path}")
            return 0

        print()
        print("✗ Node.js binary could not be prepared", file=sys.stderr)
        return 1

    except Exception as error:  # noqa: BLE001
        print()
        print(f"✗ Failed to download Node.js: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
