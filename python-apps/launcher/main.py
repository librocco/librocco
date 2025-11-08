#!/usr/bin/env -S uv run
"""
Librocco Launcher - Main entry point for the daemon manager.
"""
import sys
import logging
from pathlib import Path
from typing import Optional
from PyQt6.QtWidgets import QApplication, QSystemTrayIcon, QMessageBox
from circus import exc as circus_exc

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
    ca_path = get_caddy_root_ca_path(config.caddy_data_dir)

    # Caddy generates its internal CA certificate lazily - only when it needs to
    # issue a certificate for an HTTPS request. We need to make a request to trigger this.
    if not ca_path.exists():
        import urllib.request
        import ssl
        import time

        # Wait a bit for Caddy to fully start up before making the request
        logger.info("Waiting for Caddy to fully start before triggering CA generation...")
        time.sleep(2)

        logger.info("Triggering Caddy CA certificate generation with HTTPS request...")
        try:
            # Create SSL context that accepts self-signed certificates
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE

            # Make request to trigger CA certificate generation
            url = config.get_web_url()
            req = urllib.request.Request(url, method='HEAD')
            with urllib.request.urlopen(req, context=ssl_context, timeout=10) as response:
                logger.info(f"Made request to {url}, status: {response.status}")
        except Exception as e:
            logger.debug(f"Request to trigger CA generation: {e}")
            # This is expected - Caddy may still be starting or the request may fail
            # The important thing is that the request was attempted

        # Now wait for CA certificate to be created
        max_wait = 3  # seconds
        poll_interval = 0.1  # seconds
        waited = 0
        while not ca_path.exists() and waited < max_wait:
            time.sleep(poll_interval)
            waited += poll_interval

    if not ca_path.exists():
        logger.warning("Caddy CA certificate not found yet. It will be created on first HTTPS request.")
        return

    # Check if already installed
    if check_ca_installed(ca_path):
        logger.info("Caddy CA certificate is already installed in system trust store")
        return

    # Just inform the user about the certificate
    logger.info("Caddy CA certificate available for installation")


def initialize_caddy(config: Config) -> Optional[Path]:
    """
    Ensure Caddy binary is available, using bundled binary if packaged.
    Returns the path to the Caddy binary if successful, None otherwise.
    """
    binary_manager = BinaryManager(config.caddy_binary_path)
    if binary_manager.ensure_binary():
        return binary_manager.binary_path
    return None


def initialize_node(config: Config) -> Optional[Path]:
    """Ensure Node.js binary is available for use by the launcher."""
    node_manager = BinaryManager(config.node_binary_path, binary_type="node")
    if node_manager.ensure_binary():
        return node_manager.binary_path
    return None


def main():
    """Main entry point."""
    global logger

    # Initialize i18n (must be done before any UI strings are used)
    setup_i18n()


    # Determine app directory (sibling of main.py)
    app_dir = Path(__file__).parent / "app"

    # Initialize configuration
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

    except Exception as e:
        show_error_dialog(
            _("Configuration Error"),
            _("Failed to initialize configuration:\n\n{0}").format(e),
        )
        return 1

    # Ensure Caddy binary exists
    caddy_binary_path = initialize_caddy(config)
    if not caddy_binary_path:
        ErrorHandler.handle_critical_error(
            _("Initialization Error"),
            _("Failed to download or verify Caddy binary.\n\n"
            "Please check your internet connection and try again."),
        )
        return 1

    # Ensure Node.js binary is available (non-fatal if missing for now)
    node_binary_path = initialize_node(config)
    if node_binary_path:
        logger.info(f"Node.js binary ready at {node_binary_path}")
    else:
        warning_message = (
            "Node.js binary is not available. Node-powered features will be disabled."
        )
        logger.warning(warning_message)

    # Create daemon manager
    daemon_manager = None
    try:
        logger.info("Initializing daemon manager...")
        daemon_manager = EmbeddedSupervisor(
            caddy_binary=caddy_binary_path,
            caddyfile=config.caddyfile_path,
            caddy_data_dir=config.caddy_data_dir,
            logs_dir=config.logs_dir,
            node_binary=config.node_binary_path,
            syncserver_script=config.syncserver_script_path,
            syncserver_dir=config.syncserver_dir_path,
            db_dir=config.db_dir,
        )

        # Start daemon manager
        daemon_manager.start()
        logger.info("Daemon manager started successfully")

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
            # Use synchronous method during startup to wait for result
            if daemon_manager._start_daemon_sync("caddy"):
                logger.info("Caddy auto-started successfully")
            else:
                logger.warning("Failed to auto-start Caddy")
        except (RuntimeError, OSError, circus_exc.CallError, circus_exc.MessageError) as e:
            logger.error("Exception during Caddy auto-start", exc_info=e)

    # Auto-start sync server
    try:
        logger.info("Auto-starting sync server...")
        if daemon_manager._start_daemon_sync("syncserver"):
            logger.info("Sync server auto-started successfully")
        else:
            logger.warning("Failed to auto-start sync server")
    except (RuntimeError, OSError, circus_exc.CallError, circus_exc.MessageError) as e:
        logger.error("Exception during sync server auto-start", exc_info=e)

    # Create and run tray application
    try:
        logger.info("Starting tray application...")
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

        # Setup CA certificate after tray icon is visible
        # This prevents the CA cert polling from blocking tray icon display
        if config.get("auto_start_caddy", True):
            setup_ca_certificate(config)

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
        # Always stop daemon manager on exit to clean up child processes
        if daemon_manager:
            logger.info("Stopping daemon manager...")
            daemon_manager.stop()
        logger.info("Librocco Launcher exiting")
        logger.info("=" * 60)


if __name__ == "__main__":
    sys.exit(main())
