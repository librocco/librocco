"""Tests for cross-platform compatibility issues."""

import sys
import signal
import platform
import pytest


def test_sigterm_availability_on_windows():
    """
    Test that SIGTERM signal handling works on all platforms.

    As of Python 3.13, SIGTERM is available on Windows, so this test
    verifies that signal.SIGTERM can be registered successfully on all platforms.
    """

    def dummy_handler(sig, frame):
        pass

    # SIGINT should work on all platforms
    signal.signal(signal.SIGINT, dummy_handler)

    # SIGTERM is now available on Windows in Python 3.13+
    # This should work on all platforms
    signal.signal(signal.SIGTERM, dummy_handler)

    # If we got here, signal registration worked correctly
    assert True, "Both SIGINT and SIGTERM handlers registered successfully"


def test_sigterm_proper_handling():
    """
    Test that demonstrates the CORRECT way to handle SIGTERM cross-platform.

    This test shows how the code SHOULD be written to avoid the Windows crash.
    """

    def dummy_handler(sig, frame):
        pass

    # SIGINT should work everywhere
    signal.signal(signal.SIGINT, dummy_handler)

    # SIGTERM should be conditionally registered
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, dummy_handler)
        assert True, "SIGTERM handler registered successfully"
    else:
        # On Windows (or any platform without SIGTERM)
        assert platform.system() == "Windows", "Only Windows should lack SIGTERM"


@pytest.mark.skipif(
    platform.system() != "Windows",
    reason="This test only runs on Windows to validate the fix",
)
def test_tray_app_initialization_on_windows(mock_config):
    """
    Test that TrayApp can initialize on Windows without crashing.

    Note: This test requires QApplication and may need to skip in headless CI.
    """
    from launcher.daemon_manager import EmbeddedSupervisor
    from launcher.tray_app import TrayApp
    from launcher.i18n import setup_i18n

    try:
        # Initialize i18n system (required for TrayApp)
        setup_i18n()

        # Try to create daemon manager
        daemon_manager = EmbeddedSupervisor(
            caddy_binary=mock_config.caddy_binary_path / "caddy.exe",
            caddyfile=mock_config.caddy_config_dir / "Caddyfile",
            caddy_data_dir=mock_config.caddy_data_dir,
            logs_dir=mock_config.logs_dir,
            node_binary=mock_config.node_binary_path,
            syncserver_script=mock_config.syncserver_script_path,
            syncserver_dir=mock_config.syncserver_dir_path,
            db_dir=mock_config.db_dir,
        )

        # Try to create TrayApp
        tray_app = TrayApp(mock_config, daemon_manager)

        # If we got here, the app initialized successfully
        assert tray_app is not None, "TrayApp should initialize successfully"

        # Clean up
        daemon_manager.stop()

    except Exception as e:
        # Other errors might be expected (e.g., no display for QApplication)
        if "cannot connect to X server" in str(e) or "QSystemTrayIcon" in str(e):
            pytest.skip(f"Skipping GUI test in headless environment: {e}")
        else:
            raise


def test_platform_specific_signal_constants():
    """
    Document which signals are available on different platforms.

    As of Python 3.13, SIGTERM is now available on Windows as well.
    This is informational and should always pass.
    """
    current_platform = platform.system()

    available_signals = {
        "SIGINT": hasattr(signal, "SIGINT"),
        "SIGTERM": hasattr(signal, "SIGTERM"),
        "SIGBREAK": hasattr(signal, "SIGBREAK"),  # Windows-specific
        "SIGHUP": hasattr(signal, "SIGHUP"),  # Unix-specific
        "SIGKILL": hasattr(signal, "SIGKILL"),  # Unix-specific
    }

    # Log what's available on this platform
    print(f"\nPlatform: {current_platform}")
    for sig_name, available in available_signals.items():
        print(f"  {sig_name}: {'✓' if available else '✗'}")

    # Assertions about what we expect
    assert available_signals["SIGINT"], "SIGINT should be available on all platforms"

    # SIGTERM is now available on all platforms (Python 3.13+)
    assert available_signals[
        "SIGTERM"
    ], "SIGTERM should be available on all platforms (Python 3.13+)"

    if current_platform == "Windows":
        assert available_signals["SIGBREAK"], "SIGBREAK should be available on Windows"
    else:
        assert available_signals[
            "SIGHUP"
        ], "SIGHUP should be available on Unix-like systems"
        assert available_signals[
            "SIGKILL"
        ], "SIGKILL should be available on Unix-like systems"
