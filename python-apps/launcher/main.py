#!/usr/bin/env -S uv run
"""
Librocco Launcher - GUI entry point with system tray.
"""
import sys
import logging
from pathlib import Path
from PyQt6.QtWidgets import QApplication, QSystemTrayIcon, QMessageBox

from launcher.startup import (
    initialize_i18n,
    setup_logging_for_mode,
    initialize_config,
    download_binaries,
    create_daemon_manager,
    auto_start_daemons,
    setup_ca_certificate,
)
from launcher.tray_app import TrayApp
from launcher.error_handler import ErrorHandler
from launcher.i18n import _

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


def main():
    """Main entry point for GUI launcher."""
    global logger

    # Initialize i18n
    initialize_i18n()

    # Determine app directory (sibling of main.py)
    app_dir = Path(__file__).parent / "app"

    # Initialize configuration
    try:
        config = initialize_config(app_dir)

        # Setup logging to files
        logger = setup_logging_for_mode(config.logs_dir, logging.INFO, to_file=True)
        logger.info("=" * 60)
        logger.info("Librocco Launcher starting (GUI mode)")
        logger.info(f"Data directory: {config.data_dir}")
        logger.info(f"Config directory: {config.config_dir}")
        logger.info(f"Logs directory: {config.logs_dir}")
        logger.info(f"App directory: {app_dir}")

    except (OSError, PermissionError, ValueError, FileNotFoundError) as e:
        show_error_dialog(
            _("Configuration Error"),
            _("Failed to initialize configuration:\n\n{0}").format(e),
        )
        return 1

    # Download required binaries
    try:
        caddy_binary_path, node_binary_path = download_binaries(config)
    except RuntimeError as e:
        ErrorHandler.handle_critical_error(
            _("Initialization Error"),
            str(e),
        )
        return 1

    # Create daemon manager (GUI mode)
    daemon_manager = None
    try:
        daemon_manager = create_daemon_manager(config, caddy_binary_path, gui_mode=True)
    except (RuntimeError, OSError, ValueError) as e:
        logger.error("Failed to initialize daemon manager", exc_info=e)
        ErrorHandler.handle_critical_error(
            _("Daemon Manager Error"),
            _("Failed to initialize the daemon manager.\n\n"
            "Check the logs for details."),
            exception=e,
        )
        return 1

    # Auto-start daemons
    auto_start_daemons(daemon_manager, config)

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

    except (RuntimeError, OSError, ValueError) as e:
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
