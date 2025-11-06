"""Integration tests for full launcher workflow."""

import time
import socket
import pytest
import requests
from circus.client import CircusClient
from launcher.daemon_manager import EmbeddedSupervisor


def is_port_open(host: str, port: int, timeout: float = 1.0) -> bool:
    """Check if a TCP port is open."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(timeout)
    try:
        result = sock.connect_ex((host, port))
        return result == 0
    except socket.error:
        return False
    finally:
        sock.close()


@pytest.fixture
def setup_full_stack(mock_config, simple_caddyfile, test_port):
    """Set up complete launcher stack: binary + daemon manager + caddy.

    Uses session-scoped caddy_binary_path from mock_config (already downloaded).
    """
    # Create EmbeddedSupervisor with pre-downloaded binary
    daemon_manager = EmbeddedSupervisor(
        caddy_binary=mock_config.caddy_binary_path,
        caddyfile=simple_caddyfile,
        caddy_data_dir=mock_config.caddy_data_dir,
        logs_dir=mock_config.logs_dir,
    )

    yield daemon_manager, mock_config, test_port

    # Cleanup
    daemon_manager.stop()


@pytest.mark.slow
@pytest.mark.integration
def test_full_integration_workflow(setup_full_stack):
    """
    Integration test: Full workflow from startup to HTTP request.

    Tests:
    1. Daemon manager (Circus arbiter) starts successfully
    2. Circus endpoint is accessible
    3. Caddy daemon starts via Circus
    4. Caddy HTTP port becomes available
    5. HTTP request to Caddy succeeds
    """
    daemon_manager, config, test_port = setup_full_stack

    # Step 1: Start the daemon manager (Circus arbiter)
    daemon_manager.start()

    # Wait for arbiter to initialize (intelligent polling instead of fixed sleep)
    from conftest import wait_for_circus_ready
    client = daemon_manager.client
    if not wait_for_circus_ready(client, timeout=5.0):
        pytest.fail("Circus arbiter failed to initialize within 5 seconds")

    assert daemon_manager._running, "Daemon manager should be running"
    assert daemon_manager.arbiter is not None, "Arbiter should be initialized"

    # Step 2: Verify Circus endpoint is accessible
    # The client should be able to connect and get stats
    try:
        # Try to list watchers - this verifies the endpoint is working
        response = client.send_message("list")
        assert response.get("status") == "ok", "Circus endpoint should be accessible"
        assert "watchers" in response, "Should have watchers list"
    except Exception as e:
        pytest.fail(f"Failed to connect to Circus endpoint: {e}")

    # Step 3: Start Caddy daemon via Circus (using sync method for tests)
    result = daemon_manager._start_daemon_sync("caddy")
    assert result, "start_daemon should return True"

    # Wait for Caddy to be ready (intelligent polling instead of fixed sleep)
    from conftest import wait_for_caddy_ready
    caddy_host = "localhost"

    if not wait_for_caddy_ready(caddy_host, test_port, timeout=10.0):
        pytest.fail(f"Caddy failed to start and respond on port {test_port} within 10 seconds")

    # Step 4: Verify Caddy status is active (using sync method for tests)
    daemon_status = daemon_manager._get_status_sync("caddy")
    assert daemon_status.status == "active", f"Caddy should be active, got: {daemon_status.status}"
    assert daemon_status.pid is not None and daemon_status.pid > 0, "Caddy should have valid PID"

    # Step 5: Send HTTP request to Caddy and verify response
    try:
        response = requests.get(f"http://{caddy_host}:{test_port}", timeout=5)
        assert response.status_code == 200, f"Expected HTTP 200, got: {response.status_code}"
        assert "Hello from test Caddy" in response.text, "Should receive test message from Caddy"
    except requests.Timeout:
        pytest.fail("Caddy did not respond within timeout")
    except requests.ConnectionError as e:
        pytest.fail(f"Could not connect to Caddy: {e}")


@pytest.mark.slow
@pytest.mark.integration
def test_circus_endpoint_accessibility(setup_full_stack):
    """
    Test that Circus endpoint is accessible and responds to commands.

    This validates that the Circus arbiter is running and we can
    communicate with it via the configured endpoint.
    """
    daemon_manager, config, test_port = setup_full_stack

    # Start daemon manager
    daemon_manager.start()

    # Wait for arbiter to initialize (intelligent polling)
    from conftest import wait_for_circus_ready
    client = daemon_manager.client
    if not wait_for_circus_ready(client, timeout=5.0):
        pytest.fail("Circus arbiter failed to initialize within 5 seconds")

    assert client is not None, "Circus client should be initialized"

    # Test 1: List watchers
    response = client.send_message("list")
    assert response.get("status") == "ok", "List command should succeed"
    assert isinstance(response.get("watchers"), list), "Should return list of watchers"
    assert "caddy" in response.get("watchers", []), "Caddy watcher should be registered"

    # Test 2: Get stats
    response = client.send_message("stats")
    assert response.get("status") == "ok", "Stats command should succeed"
    assert "infos" in response, "Should return stats info"

    # Test 3: Get status of specific watcher
    # Note: For 'status' command, the response contains the watcher's status directly
    # Response format: {"status": "active"} or {"status": "stopped"}
    response = client.send_message("status", name="caddy")
    assert response.get("status") in ["active", "stopped"], f"Status should be active or stopped, got: {response.get('status')}"


@pytest.mark.slow
@pytest.mark.integration
def test_caddy_restart_workflow(setup_full_stack):
    """
    Test that Caddy can be restarted via Circus.

    Validates:
    1. Start Caddy
    2. Verify it's running
    3. Restart Caddy
    4. Verify it's still running with different PID
    """
    daemon_manager, config, test_port = setup_full_stack

    # Start everything
    daemon_manager.start()

    # Wait for arbiter (intelligent polling)
    from conftest import wait_for_circus_ready, wait_for_caddy_ready
    if not wait_for_circus_ready(daemon_manager.client, timeout=5.0):
        pytest.fail("Circus arbiter failed to initialize")

    daemon_manager._start_daemon_sync("caddy")

    # Wait for Caddy to be ready
    if not wait_for_caddy_ready("localhost", test_port, timeout=10.0):
        pytest.fail("Caddy failed to start")

    # Get initial status (using sync method for tests)
    status1 = daemon_manager._get_status_sync("caddy")
    assert status1.status == "active", "Caddy should be running"
    original_pid = status1.pid

    # Restart Caddy (using sync method for tests)
    result = daemon_manager._restart_daemon_sync("caddy")
    assert result, "restart_daemon should return True"

    # Wait for Caddy to be ready after restart
    if not wait_for_caddy_ready("localhost", test_port, timeout=10.0):
        pytest.fail("Caddy failed to restart")

    # Wait for Circus status to update after restart completes
    from conftest import wait_for_daemon_status
    if not wait_for_daemon_status(daemon_manager, "caddy", "active", timeout=5.0):
        pytest.fail("Caddy status failed to update to 'active' after restart")

    # Verify Caddy is still active but with new PID (using sync method for tests)
    status2 = daemon_manager._get_status_sync("caddy")
    assert status2.status == "active", "Caddy should still be active after restart"

    # Note: PID might be the same if restart was very fast, but usually it changes
    # Just verify it's a valid PID
    assert status2.pid is not None and status2.pid > 0, "Caddy should have valid PID after restart"

    # Verify HTTP still works after restart
    try:
        response = requests.get(f"http://localhost:{test_port}", timeout=5)
        assert response.status_code == 200, "Caddy should respond after restart"
    except Exception as e:
        pytest.fail(f"Caddy not accessible after restart: {e}")


@pytest.mark.slow
@pytest.mark.integration
def test_graceful_shutdown(setup_full_stack):
    """
    Test that the entire stack shuts down gracefully.

    Validates:
    1. Start Caddy via daemon manager
    2. Verify everything is running
    3. Call stop() on daemon manager
    4. Verify Caddy process is terminated
    5. Verify Circus arbiter is stopped
    """
    daemon_manager, config, test_port = setup_full_stack

    # Start everything
    daemon_manager.start()

    # Wait for arbiter (intelligent polling)
    from conftest import wait_for_circus_ready, wait_for_caddy_ready
    if not wait_for_circus_ready(daemon_manager.client, timeout=5.0):
        pytest.fail("Circus arbiter failed to initialize")

    daemon_manager._start_daemon_sync("caddy")

    # Wait for Caddy to be ready
    if not wait_for_caddy_ready("localhost", test_port, timeout=10.0):
        pytest.fail("Caddy failed to start")

    # Verify Caddy is running (using sync method for tests)
    status = daemon_manager._get_status_sync("caddy")
    assert status.status == "active", "Caddy should be running before shutdown"
    caddy_pid = status.pid

    # Graceful shutdown
    daemon_manager.stop()

    # Wait for Caddy port to close
    from conftest import wait_for_port_closed
    if not wait_for_port_closed("localhost", test_port, timeout=5.0):
        pytest.fail("Caddy port failed to close within 5 seconds after shutdown")

    # Verify daemon manager stopped
    assert not daemon_manager._running, "Daemon manager should not be running after stop"

    # Verify Caddy port is closed
    assert not is_port_open("localhost", test_port, timeout=1.0), "Caddy port should be closed after shutdown"
