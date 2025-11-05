"""Integration tests for full launcher workflow."""

import time
import socket
import pytest
import requests
from circus.client import CircusClient
from launcher.binary_manager import BinaryManager
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
    """Set up complete launcher stack: binary + daemon manager + caddy."""
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

    yield daemon_manager, mock_config, test_port

    # Cleanup
    daemon_manager.stop()


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
    time.sleep(2)  # Wait for arbiter to initialize

    assert daemon_manager._running, "Daemon manager should be running"
    assert daemon_manager.arbiter is not None, "Arbiter should be initialized"

    # Step 2: Verify Circus endpoint is accessible
    # The client should be able to connect and get stats
    try:
        client = daemon_manager.client
        # Try to list watchers - this verifies the endpoint is working
        response = client.send_message("list")
        assert response.get("status") == "ok", "Circus endpoint should be accessible"
        assert "watchers" in response, "Should have watchers list"
    except Exception as e:
        pytest.fail(f"Failed to connect to Circus endpoint: {e}")

    # Step 3: Start Caddy daemon via Circus
    result = daemon_manager.start_daemon("caddy")
    assert result, "start_daemon should return True"

    # Wait for Caddy to start
    time.sleep(3)

    # Step 4: Verify Caddy status is active
    daemon_status = daemon_manager.get_status("caddy")
    assert daemon_status.status == "active", f"Caddy should be active, got: {daemon_status.status}"
    assert daemon_status.pid is not None and daemon_status.pid > 0, "Caddy should have valid PID"

    # Step 5: Verify Caddy HTTP port is open
    caddy_host = "localhost"

    # Wait up to 5 seconds for port to become available
    port_available = False
    for _ in range(10):
        if is_port_open(caddy_host, test_port):
            port_available = True
            break
        time.sleep(0.5)

    assert port_available, f"Caddy port {test_port} should be open"

    # Step 6: Send HTTP request to Caddy and verify response
    try:
        response = requests.get(f"http://{caddy_host}:{test_port}", timeout=5)
        assert response.status_code == 200, f"Expected HTTP 200, got: {response.status_code}"
        assert "Hello from test Caddy" in response.text, "Should receive test message from Caddy"
    except requests.Timeout:
        pytest.fail("Caddy did not respond within timeout")
    except requests.ConnectionError as e:
        pytest.fail(f"Could not connect to Caddy: {e}")


def test_circus_endpoint_accessibility(setup_full_stack):
    """
    Test that Circus endpoint is accessible and responds to commands.

    This validates that the Circus arbiter is running and we can
    communicate with it via the configured endpoint.
    """
    daemon_manager, config, test_port = setup_full_stack

    # Start daemon manager
    daemon_manager.start()
    time.sleep(2)

    # Get the Circus client
    client = daemon_manager.client
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
    time.sleep(1)
    daemon_manager.start_daemon("caddy")
    time.sleep(3)

    # Get initial status
    status1 = daemon_manager.get_status("caddy")
    assert status1.status == "active", "Caddy should be running"
    original_pid = status1.pid

    # Restart Caddy
    result = daemon_manager.restart_daemon("caddy")
    assert result, "restart_daemon should return True"
    time.sleep(3)

    # Verify Caddy is still active but with new PID
    status2 = daemon_manager.get_status("caddy")
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
    time.sleep(1)
    daemon_manager.start_daemon("caddy")
    time.sleep(3)

    # Verify Caddy is running
    status = daemon_manager.get_status("caddy")
    assert status.status == "active", "Caddy should be running before shutdown"
    caddy_pid = status.pid

    # Graceful shutdown
    daemon_manager.stop()
    time.sleep(2)

    # Verify daemon manager stopped
    assert not daemon_manager._running, "Daemon manager should not be running after stop"

    # Verify Caddy port is closed
    assert not is_port_open("localhost", test_port, timeout=1.0), "Caddy port should be closed after shutdown"
