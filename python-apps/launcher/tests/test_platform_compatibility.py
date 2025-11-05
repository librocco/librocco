"""Tests for cross-platform compatibility issues."""

import sys
import signal
import platform
import pytest


def test_sigterm_availability_on_windows():
    """
    Test that SIGTERM signal handling is platform-aware.

    This test demonstrates the Windows incompatibility issue where
    signal.SIGTERM is not available on Windows systems.

    On Windows: This test will FAIL (AttributeError) until the code is fixed
    On Linux/macOS: This test will pass
    """
    # This simulates what tray_app.py:42-43 does
    try:
        # Try to register SIGTERM handler like the code does
        def dummy_handler(sig, frame):
            pass

        # SIGINT should work on all platforms
        signal.signal(signal.SIGINT, dummy_handler)

        # SIGTERM is NOT available on Windows - this will raise AttributeError
        signal.signal(signal.SIGTERM, dummy_handler)

        # If we get here on Windows, we should fail the test
        # (because the issue is "fixed" and the code is properly guarded)
        if platform.system() == "Windows":
            pytest.fail(
                "signal.SIGTERM should not be available on Windows. "
                "If this test passes on Windows, the code has been fixed to guard against this."
            )

    except AttributeError as e:
        if platform.system() == "Windows":
            # Expected failure on Windows - this demonstrates the bug
            pytest.fail(
                f"EXPECTED FAILURE on Windows: signal.SIGTERM not available. "
                f"Error: {e}. This demonstrates the bug in tray_app.py:43 that needs fixing."
            )
        else:
            # Unexpected failure on Linux/macOS
            pytest.fail(f"Unexpected AttributeError on {platform.system()}: {e}")


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
    if hasattr(signal, 'SIGTERM'):
        signal.signal(signal.SIGTERM, dummy_handler)
        assert True, "SIGTERM handler registered successfully"
    else:
        # On Windows (or any platform without SIGTERM)
        assert platform.system() == "Windows", "Only Windows should lack SIGTERM"


@pytest.mark.skipif(
    platform.system() != "Windows",
    reason="This test only runs on Windows to validate the fix"
)
def test_tray_app_initialization_on_windows(mock_config):
    """
    Test that TrayApp can initialize on Windows without crashing.

    This test will FAIL on Windows until tray_app.py is fixed.

    Note: This test requires QApplication and may need to skip in headless CI.
    """
    from launcher.daemon_manager import EmbeddedSupervisor
    from launcher.tray_app import TrayApp

    try:
        # Try to create daemon manager
        daemon_manager = EmbeddedSupervisor(
            caddy_binary=mock_config.caddy_binary_path / "caddy.exe",
            caddyfile=mock_config.caddy_config_dir / "Caddyfile",
            caddy_data_dir=mock_config.caddy_data_dir,
            logs_dir=mock_config.logs_dir,
        )

        # Try to create TrayApp - this will crash on Windows due to SIGTERM
        tray_app = TrayApp(mock_config, daemon_manager)

        # If we got here, the app initialized successfully
        assert tray_app is not None, "TrayApp should initialize successfully"

        # Clean up
        daemon_manager.stop()

    except AttributeError as e:
        if "SIGTERM" in str(e):
            pytest.fail(
                f"EXPECTED FAILURE on Windows: TrayApp crashes due to signal.SIGTERM. "
                f"Error: {e}. Fix required in tray_app.py:43"
            )
        else:
            raise

    except Exception as e:
        # Other errors might be expected (e.g., no display for QApplication)
        if "cannot connect to X server" in str(e) or "QSystemTrayIcon" in str(e):
            pytest.skip(f"Skipping GUI test in headless environment: {e}")
        else:
            raise


def test_platform_specific_signal_constants():
    """
    Document which signals are available on different platforms.

    This is informational and should always pass.
    """
    current_platform = platform.system()

    available_signals = {
        "SIGINT": hasattr(signal, "SIGINT"),
        "SIGTERM": hasattr(signal, "SIGTERM"),
        "SIGBREAK": hasattr(signal, "SIGBREAK"),  # Windows-specific
        "SIGHUP": hasattr(signal, "SIGHUP"),      # Unix-specific
        "SIGKILL": hasattr(signal, "SIGKILL"),    # Unix-specific
    }

    # Log what's available on this platform
    print(f"\nPlatform: {current_platform}")
    for sig_name, available in available_signals.items():
        print(f"  {sig_name}: {'✓' if available else '✗'}")

    # Assertions about what we expect
    assert available_signals["SIGINT"], "SIGINT should be available on all platforms"

    if current_platform == "Windows":
        assert not available_signals["SIGTERM"], "SIGTERM should NOT be available on Windows"
        assert available_signals["SIGBREAK"], "SIGBREAK should be available on Windows"
    else:
        assert available_signals["SIGTERM"], "SIGTERM should be available on Unix-like systems"
        assert available_signals["SIGHUP"], "SIGHUP should be available on Unix-like systems"
