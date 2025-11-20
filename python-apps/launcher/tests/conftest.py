"""Pytest configuration and fixtures for launcher tests."""

import tempfile
import socket
import time
from pathlib import Path
import pytest
import requests
from circus.client import CircusClient
from launcher.binary_manager import BinaryManager


# Helper functions for intelligent waiting (replaces fixed time.sleep() calls)


def wait_for_circus_ready(client: CircusClient, timeout: float = 5.0) -> bool:
    """Poll Circus endpoint until ready or timeout.

    Args:
        client: CircusClient instance to poll
        timeout: Maximum time to wait in seconds

    Returns:
        True if Circus is ready, False if timeout
    """
    start = time.time()
    while time.time() - start < timeout:
        try:
            response = client.send_message("list")
            if response.get("status") == "ok":
                return True
        except Exception:
            pass
        time.sleep(0.1)
    return False


def wait_for_caddy_ready(host: str, port: int, timeout: float = 10.0) -> bool:
    """Poll Caddy HTTP endpoint until ready or timeout.

    Args:
        host: Hostname to connect to
        port: Port to connect to
        timeout: Maximum time to wait in seconds

    Returns:
        True if Caddy responds with HTTP 200, False if timeout
    """
    start = time.time()
    while time.time() - start < timeout:
        try:
            response = requests.get(f"http://{host}:{port}", timeout=1.0)
            if response.status_code == 200:
                return True
        except (requests.ConnectionError, requests.Timeout, requests.RequestException):
            pass
        time.sleep(0.1)
    return False


def wait_for_daemon_status(
    daemon_manager, daemon_name: str, expected_status: str, timeout: float = 5.0
) -> bool:
    """Poll daemon status until it reaches expected state or timeout.

    Args:
        daemon_manager: EmbeddedSupervisor instance
        daemon_name: Name of daemon to check
        expected_status: Expected status ('active', 'stopped', etc.)
        timeout: Maximum time to wait in seconds

    Returns:
        True if daemon reaches expected status, False if timeout
    """
    start = time.time()
    while time.time() - start < timeout:
        status = daemon_manager._get_status_sync(daemon_name)
        if status.status == expected_status:
            return True
        time.sleep(0.1)
    return False


def wait_for_port_closed(host: str, port: int, timeout: float = 5.0) -> bool:
    """Poll until port is no longer open or timeout.

    Args:
        host: Hostname to check
        port: Port to check
        timeout: Maximum time to wait in seconds

    Returns:
        True if port closes, False if timeout
    """
    start = time.time()
    while time.time() - start < timeout:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(1.0)
        try:
            result = sock.connect_ex((host, port))
            if result != 0:  # Port is closed
                return True
        except socket.error:
            return True  # Port is closed (connection refused)
        finally:
            sock.close()
        time.sleep(0.1)
    return False


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
    config.db_dir = temp_data_dir / "db"

    # Update settings file path to match overridden config_dir
    config.settings_file = config.config_dir / "settings.toml"

    # Create the directories
    config.initialize()

    # Override the caddy_binary_path property to use session-scoped binary
    monkeypatch.setattr(
        type(config), "caddy_binary_path", property(lambda self: caddy_binary_path)
    )

    # Add mock properties for node and syncserver (tests don't need real ones)
    monkeypatch.setattr(
        type(config),
        "node_binary_path",
        property(lambda self: temp_data_dir / "binaries" / "node"),
    )
    monkeypatch.setattr(
        type(config),
        "syncserver_script_path",
        property(
            lambda self: temp_data_dir / "binaries" / "syncserver" / "syncserver.mjs"
        ),
    )
    monkeypatch.setattr(
        type(config),
        "syncserver_dir_path",
        property(lambda self: temp_data_dir / "binaries" / "syncserver"),
    )

    return config


@pytest.fixture
def test_port():
    """Find and return an available port for testing."""
    # Create a socket, bind to port 0 (OS will assign free port), then close it
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.bind(("localhost", 0))
    port = sock.getsockname()[1]
    sock.close()
    return port


@pytest.fixture
def simple_caddyfile(temp_data_dir, test_port):
    """Create a minimal Caddyfile for testing with a free port."""
    caddyfile_path = temp_data_dir / "Caddyfile"
    caddyfile_content = f"""
:{test_port} {{
    respond "Hello from test Caddy" 200
}}
"""
    caddyfile_path.write_text(caddyfile_content)
    return caddyfile_path
