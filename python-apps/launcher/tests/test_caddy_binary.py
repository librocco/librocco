"""Tests for Caddy binary download and execution."""

import subprocess
from pathlib import Path
import pytest
from launcher.binary_manager import BinaryManager


def test_caddy_download_and_run(mock_config):
    """Test that we can run 'caddy version' command."""
    manager = BinaryManager(mock_config.caddy_binary_path)

    # Ensure binary is downloaded
    success = manager.ensure_binary()
    assert success, "Binary download should succeed"

    # Run 'caddy version' command
    result = subprocess.run(
        [str(manager.binary_path), "version"],
        capture_output=True,
        text=True,
        timeout=10,
    )

    # Verify command succeeded
    assert result.returncode == 0, f"caddy version failed: {result.stderr}"

    # Verify output contains version info
    output = result.stdout.lower()
    assert (
        "caddy" in output or "v" in output
    ), f"Unexpected version output: {result.stdout}"
