"""Tests for Circus-based daemon management of Caddy."""

import time
import pytest
import requests
from launcher.daemon_manager import EmbeddedSupervisor


@pytest.fixture
def setup_caddy_and_daemon(mock_config, simple_caddyfile, test_port):
    """Set up EmbeddedSupervisor with Caddy binary and config.

    Uses session-scoped caddy_binary_path from mock_config (already downloaded).
    """
    # Create EmbeddedSupervisor with pre-downloaded binary
    daemon_manager = EmbeddedSupervisor(
        caddy_binary=mock_config.caddy_binary_path,
        caddyfile=simple_caddyfile,
        caddy_data_dir=mock_config.caddy_data_dir,
        logs_dir=mock_config.logs_dir,
        node_binary=mock_config.node_binary_path,
        syncserver_script=mock_config.syncserver_script_path,
        syncserver_dir=mock_config.syncserver_dir_path,
        db_dir=mock_config.db_dir,
    )

    yield daemon_manager, test_port

    # Cleanup: stop daemon if running
    daemon_manager.stop()


@pytest.mark.slow
@pytest.mark.integration
def test_start_caddy_daemon(setup_caddy_and_daemon):
    """Test that Circus can start the Caddy daemon."""
    daemon_manager, test_port = setup_caddy_and_daemon

    # Start the daemon manager (arbiter)
    daemon_manager.start()

    # Wait for arbiter to initialize (intelligent polling)
    from conftest import wait_for_circus_ready, wait_for_caddy_ready

    if not wait_for_circus_ready(daemon_manager.client, timeout=5.0):
        pytest.fail("Circus arbiter failed to initialize")

    # Start the Caddy process via Circus (using sync method for tests)
    result = daemon_manager._start_daemon_sync("caddy")
    assert result, "start_daemon should return True"

    # Wait for Caddy to be ready
    if not wait_for_caddy_ready("localhost", test_port, timeout=10.0):
        pytest.fail("Caddy failed to start")

    # Check status - should be running (using sync method for tests)
    daemon_status = daemon_manager._get_status_sync("caddy")
    assert (
        daemon_status.status == "active"
    ), f"Expected Caddy to be active, got: {daemon_status.status}"


@pytest.mark.slow
@pytest.mark.integration
def test_stop_caddy_daemon(setup_caddy_and_daemon):
    """Test that Circus can stop the Caddy daemon."""
    daemon_manager, test_port = setup_caddy_and_daemon

    # Start the daemon manager and Caddy
    daemon_manager.start()

    # Wait for arbiter and Caddy (intelligent polling)
    from conftest import wait_for_circus_ready, wait_for_caddy_ready

    if not wait_for_circus_ready(daemon_manager.client, timeout=5.0):
        pytest.fail("Circus arbiter failed to initialize")

    daemon_manager._start_daemon_sync("caddy")

    if not wait_for_caddy_ready("localhost", test_port, timeout=10.0):
        pytest.fail("Caddy failed to start")

    # Verify it's running (using sync method for tests)
    daemon_status = daemon_manager._get_status_sync("caddy")
    assert daemon_status.status == "active", "Caddy should be running before stop test"

    # Stop the daemon (using sync method for tests)
    result = daemon_manager._stop_daemon_sync("caddy")
    assert result, "stop_daemon should return True"

    # Wait for daemon to reach stopped status
    from conftest import wait_for_daemon_status

    if not wait_for_daemon_status(daemon_manager, "caddy", "stopped", timeout=5.0):
        pytest.fail("Caddy failed to stop within 5 seconds")

    # Check status - should be stopped (using sync method for tests)
    daemon_status = daemon_manager._get_status_sync("caddy")
    assert (
        daemon_status.status == "stopped"
    ), f"Expected Caddy to be stopped, got: {daemon_status.status}"


@pytest.mark.slow
@pytest.mark.integration
def test_caddy_working_directory(setup_caddy_and_daemon, mock_config):
    """Test that Caddy runs with correct working directory (catches MacOS path bug)."""
    daemon_manager, test_port = setup_caddy_and_daemon

    # Start the daemon manager and Caddy
    daemon_manager.start()

    # Wait for arbiter and Caddy (intelligent polling)
    from conftest import wait_for_circus_ready, wait_for_caddy_ready

    if not wait_for_circus_ready(daemon_manager.client, timeout=5.0):
        pytest.fail("Circus arbiter failed to initialize")

    daemon_manager._start_daemon_sync("caddy")

    if not wait_for_caddy_ready("localhost", test_port, timeout=10.0):
        pytest.fail("Caddy failed to start")

    # Verify Caddy is running (using sync method for tests)
    daemon_status = daemon_manager._get_status_sync("caddy")
    assert daemon_status.status == "active", "Caddy should be running"

    # Verify the process has a PID (indicates it's actually running)
    assert (
        daemon_status.pid is not None and daemon_status.pid > 0
    ), "Caddy should have a valid PID"

    # Check that the data directory exists (Caddy uses this as working dir)
    assert mock_config.caddy_data_dir.exists(), "Caddy data dir should exist"

    # Check that logs directory exists (Circus should create it)
    assert mock_config.logs_dir.exists(), "Logs dir should exist"


@pytest.mark.slow
@pytest.mark.integration
def test_verify_caddy_responds(setup_caddy_and_daemon):
    """Test that Caddy actually serves HTTP requests (integration test)."""
    daemon_manager, test_port = setup_caddy_and_daemon

    # Start the daemon manager and Caddy
    daemon_manager.start()

    # Wait for arbiter and Caddy (intelligent polling)
    from conftest import wait_for_circus_ready, wait_for_caddy_ready

    if not wait_for_circus_ready(daemon_manager.client, timeout=5.0):
        pytest.fail("Circus arbiter failed to initialize")

    daemon_manager._start_daemon_sync("caddy")

    # Wait for Caddy to be ready (this also verifies HTTP response)
    if not wait_for_caddy_ready("localhost", test_port, timeout=10.0):
        pytest.fail("Caddy failed to start and respond on HTTP")

    # Verify Caddy is running (using sync method for tests)
    daemon_status = daemon_manager._get_status_sync("caddy")
    assert daemon_status.status == "active"

    # Try to connect to Caddy's test endpoint using requests library
    try:
        response = requests.get(f"http://localhost:{test_port}", timeout=5)
        assert (
            response.status_code == 200
        ), f"Expected HTTP 200, got: {response.status_code}"
    except requests.Timeout:
        pytest.fail("Caddy did not respond within timeout")
    except requests.ConnectionError as e:
        pytest.fail(f"Could not connect to Caddy: {e}")
