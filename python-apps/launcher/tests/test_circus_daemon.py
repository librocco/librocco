"""Tests for Circus-based daemon management of Caddy."""

import time
import pytest
import requests
from launcher.binary_manager import BinaryManager
from launcher.daemon_manager import EmbeddedSupervisor


@pytest.fixture
def setup_caddy_and_daemon(mock_config, simple_caddyfile, test_port):
    """Set up BinaryManager and EmbeddedSupervisor with Caddy binary and config."""
    # Download Caddy binary
    binary_manager = BinaryManager(mock_config.caddy_binary_path)
    success = binary_manager.ensure_binary()
    assert success, "Caddy binary download should succeed"

    # Create EmbeddedSupervisor
    daemon_manager = EmbeddedSupervisor(
        caddy_binary=binary_manager.binary_path,
        caddyfile=simple_caddyfile,
        caddy_data_dir=mock_config.caddy_data_dir,
        logs_dir=mock_config.logs_dir,
    )

    yield daemon_manager, test_port

    # Cleanup: stop daemon if running
    daemon_manager.stop()


def test_start_caddy_daemon(setup_caddy_and_daemon):
    """Test that Circus can start the Caddy daemon."""
    daemon_manager, test_port = setup_caddy_and_daemon

    # Start the daemon manager (arbiter)
    daemon_manager.start()

    # Give it a moment to initialize
    time.sleep(1)

    # Start the Caddy process via Circus
    result = daemon_manager.start_daemon("caddy")
    assert result, "start_daemon should return True"

    # Give Caddy time to start
    time.sleep(2)

    # Check status - should be running
    daemon_status = daemon_manager.get_status("caddy")
    assert (
        daemon_status.status == "active"
    ), f"Expected Caddy to be active, got: {daemon_status.status}"


def test_stop_caddy_daemon(setup_caddy_and_daemon):
    """Test that Circus can stop the Caddy daemon."""
    daemon_manager, test_port = setup_caddy_and_daemon

    # Start the daemon manager and Caddy
    daemon_manager.start()
    time.sleep(1)
    daemon_manager.start_daemon("caddy")
    time.sleep(2)

    # Verify it's running
    daemon_status = daemon_manager.get_status("caddy")
    assert daemon_status.status == "active", "Caddy should be running before stop test"

    # Stop the daemon
    result = daemon_manager.stop_daemon("caddy")
    assert result, "stop_daemon should return True"
    time.sleep(1)

    # Check status - should be stopped
    daemon_status = daemon_manager.get_status("caddy")
    assert (
        daemon_status.status == "stopped"
    ), f"Expected Caddy to be stopped, got: {daemon_status.status}"


def test_caddy_working_directory(setup_caddy_and_daemon, mock_config):
    """Test that Caddy runs with correct working directory (catches MacOS path bug)."""
    daemon_manager, test_port = setup_caddy_and_daemon

    # Start the daemon manager and Caddy
    daemon_manager.start()
    time.sleep(1)
    daemon_manager.start_daemon("caddy")
    time.sleep(2)

    # Verify Caddy is running
    daemon_status = daemon_manager.get_status("caddy")
    assert daemon_status.status == "active", "Caddy should be running"

    # Verify the process has a PID (indicates it's actually running)
    assert (
        daemon_status.pid is not None and daemon_status.pid > 0
    ), "Caddy should have a valid PID"

    # Check that the data directory exists (Caddy uses this as working dir)
    assert mock_config.caddy_data_dir.exists(), "Caddy data dir should exist"

    # Check that logs directory exists (Circus should create it)
    assert mock_config.logs_dir.exists(), "Logs dir should exist"


def test_verify_caddy_responds(setup_caddy_and_daemon):
    """Test that Caddy actually serves HTTP requests (integration test)."""
    daemon_manager, test_port = setup_caddy_and_daemon

    # Start the daemon manager and Caddy
    daemon_manager.start()
    time.sleep(1)
    daemon_manager.start_daemon("caddy")
    time.sleep(3)  # Give Caddy extra time to bind to port

    # Verify Caddy is running
    daemon_status = daemon_manager.get_status("caddy")
    assert daemon_status.status == "active"

    # Try to connect to Caddy's test endpoint using requests library
    try:
        response = requests.get(f"http://localhost:{test_port}", timeout=5)
        assert response.status_code == 200, f"Expected HTTP 200, got: {response.status_code}"
    except requests.Timeout:
        pytest.fail("Caddy did not respond within timeout")
    except requests.ConnectionError as e:
        pytest.fail(f"Could not connect to Caddy: {e}")
