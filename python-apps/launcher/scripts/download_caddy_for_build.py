#!/usr/bin/env -S uv run --quiet
"""
Download Caddy binary for the current platform for PyInstaller bundling.

This script downloads Caddy to bundled_binaries/ for inclusion in PyInstaller builds.
It reuses the download and verification logic from binary_manager.py.
"""

import sys
from pathlib import Path

# Add parent directory to path to import from launcher package
launcher_dir = Path(__file__).parent.parent
sys.path.insert(0, str(launcher_dir))

from launcher.binary_manager import BinaryManager
import platform


def main():
    """Download Caddy for the current platform to bundled_binaries/."""

    # Determine binary name
    binary_name = "caddy.exe" if platform.system() == "Windows" else "caddy"

    # Set up destination path
    bundled_binaries_dir = launcher_dir / "bundled_binaries"
    bundled_binaries_dir.mkdir(exist_ok=True)

    caddy_path = bundled_binaries_dir / binary_name

    print(f"Downloading Caddy {BinaryManager.CADDY_VERSION} for bundling...")
    print(f"Platform: {platform.system()} {platform.machine()}")
    print(f"Destination: {caddy_path}")
    print()

    # Create binary manager and download
    manager = BinaryManager(caddy_path)

    try:
        # Download and extract
        manager.download_and_extract()

        # Verify it works
        if manager.verify_binary():
            print()
            print("✓ Caddy downloaded and verified successfully!")
            print(f"✓ Binary ready for PyInstaller at: {caddy_path}")
            return 0
        else:
            print()
            print("✗ Downloaded binary failed verification", file=sys.stderr)
            return 1

    except Exception as e:
        print()
        print(f"✗ Failed to download Caddy: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
