"""Pytest configuration and fixtures for launcher tests."""

import tempfile
import socket
from pathlib import Path
import pytest
from launcher.binary_manager import BinaryManager


@pytest.fixture(scope="session")
def caddy_binary_path():
    """Download Caddy binary once for entire test session.

    This session-scoped fixture ensures the binary is downloaded only once,
    significantly speeding up the test suite (saves ~40-80 seconds).
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        binary_path = Path(tmpdir) / "binaries" / "caddy"
        binary_path.parent.mkdir(parents=True, exist_ok=True)

        manager = BinaryManager(binary_path)
        success = manager.ensure_binary()

        if not success:
            pytest.fail("Failed to download Caddy binary for test session")

        yield binary_path
        # Cleanup happens automatically when tmpdir context exits


@pytest.fixture
def temp_data_dir():
    """Provide a temporary directory for test data."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def mock_config(temp_data_dir, caddy_binary_path, monkeypatch):
    """Provide a mock Config instance with temporary directories.

    Uses the session-scoped caddy_binary_path to avoid redundant downloads.
    """
    from launcher.config import Config

    # Create a Config instance
    config = Config()

    # Override directories to use temp directory
    config.data_dir = temp_data_dir
    config.config_dir = temp_data_dir / "config"
    config.binaries_dir = temp_data_dir / "binaries"
    config.caddy_data_dir = temp_data_dir / "caddy-data"
    config.caddy_config_dir = temp_data_dir / "caddy-config"
    config.logs_dir = temp_data_dir / "logs"

    # Update settings file path to match overridden config_dir
    config.settings_file = config.config_dir / "settings.toml"

    # Create the directories
    config.initialize()

    # Override the caddy_binary_path property to use session-scoped binary
    monkeypatch.setattr(
        type(config),
        "caddy_binary_path",
        property(lambda self: caddy_binary_path)
    )

    return config


@pytest.fixture
def test_port():
    """Find and return an available port for testing."""
    # Create a socket, bind to port 0 (OS will assign free port), then close it
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.bind(('localhost', 0))
    port = sock.getsockname()[1]
    sock.close()
    return port


@pytest.fixture
def simple_caddyfile(temp_data_dir, test_port):
    """Create a minimal Caddyfile for testing with a free port."""
    caddyfile_path = temp_data_dir / "Caddyfile"
    caddyfile_content = f"""
{{
    # Global options
    admin off
}}

:{test_port} {{
    respond "Hello from test Caddy" 200
}}
"""
    caddyfile_path.write_text(caddyfile_content)
    return caddyfile_path
