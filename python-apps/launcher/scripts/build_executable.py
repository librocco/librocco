#!/usr/bin/env python3
"""
Build orchestration script for Librocco Launcher executable.

This script orchestrates the complete build process:
1. Downloads Node.js binary for current platform
2. Downloads Caddy binary for current platform
3. Verifies web client is built
4. Runs PyInstaller to create executable

Usage:
    uv run scripts/build_executable.py

Note: This script must be run with uv from the launcher directory to ensure
all dependencies (including PyQt6, circus, etc.) are available.
"""

import subprocess
import sys
from pathlib import Path


def print_step(step_num: int, total: int, message: str):
    """Print a formatted step message."""
    print(f"\n{'=' * 70}")
    print(f"Step {step_num}/{total}: {message}")
    print('=' * 70)


def run_command(cmd: list, description: str) -> bool:
    """
    Run a command and return True if successful.
    """
    print(f"\n$ {' '.join(cmd)}")
    result = subprocess.run(cmd)

    if result.returncode != 0:
        print(f"\n✗ Failed: {description}", file=sys.stderr)
        return False

    print(f"✓ Success: {description}")
    return True


def main():
    """Run the complete build process."""

    # Paths
    launcher_dir = Path(__file__).parent.parent
    project_root = launcher_dir.parent.parent
    web_client_build = project_root / 'apps' / 'web-client' / 'build'
    spec_file = launcher_dir / 'librocco-launcher.spec'
    download_caddy_script = launcher_dir / 'scripts' / 'download_caddy_for_build.py'
    download_node_script = launcher_dir / 'scripts' / 'download_node_for_build.py'

    print("=" * 70)
    print("Librocco Launcher - Build Executable")
    print("=" * 70)
    print(f"Platform: {sys.platform}")
    print(f"Working directory: {launcher_dir}")

    # Step 1: Download Node.js
    print_step(1, 4, "Downloading Node.js binary")

    if not download_node_script.exists():
        print(f"✗ Download script not found: {download_node_script}", file=sys.stderr)
        return 1

    if not run_command([sys.executable, str(download_node_script)], "Download Node.js binary"):
        return 1

    # Step 2: Download Caddy
    print_step(2, 4, "Downloading Caddy binary")

    if not download_caddy_script.exists():
        print(f"✗ Download script not found: {download_caddy_script}", file=sys.stderr)
        return 1

    # Run with python instead of relying on shebang to use current environment
    if not run_command([sys.executable, str(download_caddy_script)], "Download Caddy binary"):
        return 1

    # Step 3: Verify web client build
    print_step(3, 4, "Verifying web client build")

    if not web_client_build.exists():
        print(f"\n✗ Web client build not found at: {web_client_build}", file=sys.stderr)
        print("\nPlease build the web client first:", file=sys.stderr)
        print("  cd apps/web-client", file=sys.stderr)
        print("  rushx build:prod-rootdir", file=sys.stderr)
        return 1

    # Check if build has files
    build_files = list(web_client_build.iterdir())
    if not build_files:
        print(f"\n✗ Web client build directory is empty: {web_client_build}", file=sys.stderr)
        return 1

    print(f"✓ Web client build found ({len(build_files)} files)")

    # Step 4: Run PyInstaller
    print_step(4, 4, "Building executable with PyInstaller")

    if not spec_file.exists():
        print(f"✗ Spec file not found: {spec_file}", file=sys.stderr)
        return 1

    # Run PyInstaller from the launcher directory
    if not run_command(
        ['pyinstaller', '--clean', str(spec_file)],
        "PyInstaller build"
    ):
        return 1

    # Success!
    print("\n" + "=" * 70)
    print("✓ Build completed successfully!")
    print("=" * 70)

    # Show output location
    dist_dir = launcher_dir / 'dist'
    if dist_dir.exists():
        executables = list(dist_dir.glob('librocco-launcher*'))
        if executables:
            print(f"\nExecutable created at:")
            for exe in executables:
                print(f"  {exe}")
                print(f"  Size: {exe.stat().st_size / (1024*1024):.1f} MB")

    print("\n✓ Ready for distribution!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
