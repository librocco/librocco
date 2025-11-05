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

# Logger will be initialized in main() after config is loaded
logger = None


def show_error_dialog(title: str, message: str) -> None:
    """Show an error dialog and exit."""
    app = QApplication(sys.argv)
    msg_box = QMessageBox()
    msg_box.setWindowTitle(title)
    msg_box.setText(message)
    msg_box.setIcon(QMessageBox.Icon.Critical)
    msg_box.exec()
    sys.exit(1)


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
            "Configuration Error",
            f"Failed to initialize configuration:\n\n{e}",
        )
        return 1

    # Ensure Caddy binary exists
    if not initialize_caddy(config):
        ErrorHandler.handle_critical_error(
            "Initialization Error",
            "Failed to download or verify Caddy binary.\n\n"
            "Please check your internet connection and try again.",
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
            "Daemon Manager Error",
            "Failed to initialize the daemon manager.\n\n"
            "Check the logs for details.",
            exception=e,
        )
        return 1

    # Auto-start Caddy if configured
    if config.get("auto_start_caddy", True):
        try:
            logger.info("Auto-starting Caddy...")
            print("Auto-starting Caddy...")
            if daemon_manager.start_daemon("caddy"):
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
                "System Tray Unavailable",
                "System tray is not available on this system.\n\n"
                "The launcher requires a system tray to function.",
            )
            daemon_manager.stop()
            return 1

        logger.info("Tray application started successfully")
        print("✓ Tray application running")
        print(
            f"\nCaddy is configured to listen on http://{config.get('caddy_host')}:{config.get('caddy_port')}"
        )
        print("Right-click the tray icon to access controls.\n")

        # Run the application
        return app.run()

    except Exception as e:
        logger.error("Failed to start tray application", exc_info=e)
        ErrorHandler.handle_critical_error(
            "Application Error",
            "Failed to start the tray application.\n\n" "Check the logs for details.",
            exception=e,
        )
        daemon_manager.stop()
        return 1
    finally:
        logger.info("Librocco Launcher exiting")
        logger.info("=" * 60)


if __name__ == "__main__":
    sys.exit(main())
