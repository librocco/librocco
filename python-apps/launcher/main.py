#!/usr/bin/env -S uv run
"""
Librocco Launcher - Main entry point for the daemon manager.
"""
import sys
import logging
from PyQt6.QtWidgets import QApplication, QSystemTrayIcon, QMessageBox

from launcher.config import Config
from launcher.binary_manager import BinaryManager
from launcher.daemon_manager import EmbeddedSupervisor
from launcher.tray_app import TrayApp
from launcher.logging_config import setup_logging
from launcher.error_handler import ErrorHandler
from launcher.i18n import setup_i18n, _
from launcher.network_utils import (
    get_caddy_root_ca_path,
    install_ca_certificate,
    check_ca_installed,
)

# Logger will be initialized in main() after config is loaded
logger = None


def show_error_dialog(title: str, message: str) -> None:
    """Show an error dialog and exit."""
    # Check if QApplication instance already exists
    app = QApplication.instance()
    if app is None:
        app = QApplication(sys.argv)
    msg_box = QMessageBox()
    msg_box.setWindowTitle(title)
    msg_box.setText(message)
    msg_box.setIcon(QMessageBox.Icon.Critical)
    msg_box.exec()
    sys.exit(1)


def setup_ca_certificate(config: Config) -> None:
    """
    Check if Caddy's CA certificate needs to be installed and show info.

    This should be called after Caddy has started at least once, so the CA
    certificate has been generated.
    """
    # Only relevant if HTTPS is enabled
    if not config.get("https_enabled", True):
        return

    ca_path = get_caddy_root_ca_path(config.caddy_data_dir)

    # Wait for Caddy to generate the certificate (usually happens quickly)
    import time
    max_wait = 5  # seconds
    poll_interval = 0.1  # seconds
    waited = 0
    attempts = 0
    while not ca_path.exists() and waited < max_wait:
        attempts += 1
        if attempts == 1:
            logger.info("Waiting for Caddy to generate CA certificate...")
        time.sleep(poll_interval)
        waited += poll_interval

    if not ca_path.exists():
        logger.warning("Caddy CA certificate not found yet. It will be created on first HTTPS request.")
        print("⚠ Caddy CA certificate not generated yet (will be created on first HTTPS request)")
        return

    # Check if already installed
    if check_ca_installed(ca_path):
        logger.info("Caddy CA certificate is already installed in system trust store")
        print("✓ Caddy CA certificate already trusted by system")
        return

    # Just inform the user about the certificate
    logger.info("Caddy CA certificate available for installation")
    print("\n" + "=" * 60)
    print("HTTPS Certificate Setup")
    print("=" * 60)
    print(f"\nTo access the application over HTTPS without browser warnings,")
    print(f"you can install Caddy's CA certificate to your system trust store.")
    print(f"\nCertificate location: {ca_path}")
    print(f"Application URL: {config.get_web_url()}")
    print(f"\nTo install the certificate, run:")
    print(f"  sudo cp {ca_path} /usr/local/share/ca-certificates/librocco-launcher.crt")
    print(f"  sudo update-ca-certificates")
    print("=" * 60 + "\n")


def initialize_caddy(config: Config) -> bool:
    """
    Ensure Caddy binary is available.
    Returns True if successful, False otherwise.
    """
    binary_manager = BinaryManager(config.caddy_binary_path)

    if binary_manager.verify_binary():
        logger.info(f"Caddy binary found at {config.caddy_binary_path}")
        print(f"✓ Caddy binary found at {config.caddy_binary_path}")
        return True

    logger.info("Caddy binary not found. Starting download...")
    print("Caddy binary not found. Downloading...")

    try:
        binary_manager.download_and_extract(
            progress_callback=lambda downloaded, total: print(
                f"  Downloaded: {downloaded / 1024 / 1024:.1f} MB / {total / 1024 / 1024:.1f} MB",
                end="\r",
            )
        )
        print()  # New line after progress

        if binary_manager.verify_binary():
            logger.info("Caddy binary downloaded and verified successfully")
            print("✓ Caddy binary downloaded and verified")
            return True
        else:
            logger.error("Caddy binary verification failed after download")
            print("✗ Failed to verify Caddy binary")
            return False

    except Exception as e:
        logger.error("Failed to download Caddy", exc_info=e)
        print(f"✗ Failed to download Caddy: {e}")
        return False


def main():
    """Main entry point."""
    global logger

    # Initialize i18n (must be done before any UI strings are used)
    setup_i18n()

    print("Librocco Launcher starting...")

    # Determine app directory (sibling of main.py)
    from pathlib import Path

    app_dir = Path(__file__).parent / "app"

    # Initialize configuration
    print("Initializing configuration...")
    try:
        config = Config()
        config.initialize()
        config.ensure_caddyfile(app_dir)

        # Initialize logging now that we have the config and logs directory
        logger = setup_logging(config.logs_dir, logging.INFO)
        logger.info("=" * 60)
        logger.info("Librocco Launcher starting")
        logger.info(f"Data directory: {config.data_dir}")
        logger.info(f"Config directory: {config.config_dir}")
        logger.info(f"Logs directory: {config.logs_dir}")
        logger.info(f"App directory: {app_dir}")

        print(f"✓ Data directory: {config.data_dir}")
        print(f"✓ Config directory: {config.config_dir}")
        print(f"✓ App directory: {app_dir}")

    except Exception as e:
        print(f"✗ Failed to initialize configuration: {e}")
        show_error_dialog(
            _("Configuration Error"),
            _("Failed to initialize configuration:\n\n{0}").format(e),
        )
        return 1

    # Ensure Caddy binary exists
    if not initialize_caddy(config):
        ErrorHandler.handle_critical_error(
            _("Initialization Error"),
            _("Failed to download or verify Caddy binary.\n\n"
            "Please check your internet connection and try again."),
        )
        return 1

    # Create daemon manager
    try:
        logger.info("Initializing daemon manager...")
        print("Initializing daemon manager...")
        daemon_manager = EmbeddedSupervisor(
            caddy_binary=config.caddy_binary_path,
            caddyfile=config.caddyfile_path,
            caddy_data_dir=config.caddy_data_dir,
            logs_dir=config.logs_dir,
        )

        # Start daemon manager
        daemon_manager.start()
        logger.info("Daemon manager started successfully")
        print("✓ Daemon manager started")

    except Exception as e:
        logger.error("Failed to initialize daemon manager", exc_info=e)
        ErrorHandler.handle_critical_error(
            _("Daemon Manager Error"),
            _("Failed to initialize the daemon manager.\n\n"
            "Check the logs for details."),
            exception=e,
        )
        return 1

    # Auto-start Caddy if configured
    if config.get("auto_start_caddy", True):
        try:
            logger.info("Auto-starting Caddy...")
            print("Auto-starting Caddy...")
            # Use synchronous method during startup to wait for result
            if daemon_manager._start_daemon_sync("caddy"):
                logger.info("Caddy auto-started successfully")
                print("✓ Caddy started")
            else:
                logger.warning("Failed to auto-start Caddy")
                print("⚠ Failed to auto-start Caddy (will retry later)")
        except Exception as e:
            logger.error("Exception during Caddy auto-start", exc_info=e)
            print("⚠ Error auto-starting Caddy (will retry later)")

    # Create and run tray application
    try:
        logger.info("Starting tray application...")
        print("Starting tray application...")
        app = TrayApp(config, daemon_manager)

        # Check if system tray is available (must be done after QApplication is created)
        if not QSystemTrayIcon.isSystemTrayAvailable():
            logger.error("System tray is not available on this system")
            ErrorHandler.handle_critical_error(
                _("System Tray Unavailable"),
                _("System tray is not available on this system.\n\n"
                "The launcher requires a system tray to function."),
            )
            daemon_manager.stop()
            return 1

        logger.info("Tray application started successfully")
        print("✓ Tray application running")

        # Setup CA certificate after tray icon is visible
        # This prevents the CA cert polling from blocking tray icon display
        if config.get("auto_start_caddy", True):
            setup_ca_certificate(config)

        print(f"\nApplication URL: {config.get_web_url()}")
        print("Left-click the tray icon to open in browser.")
        print("Right-click the tray icon to access controls.\n")

        # Run the application
        return app.run()

    except Exception as e:
        logger.error("Failed to start tray application", exc_info=e)
        ErrorHandler.handle_critical_error(
            _("Application Error"),
            _("Failed to start the tray application.\n\n"
            "Check the logs for details."),
            exception=e,
        )
        daemon_manager.stop()
        return 1
    finally:
        logger.info("Librocco Launcher exiting")
        logger.info("=" * 60)


if __name__ == "__main__":
    sys.exit(main())
