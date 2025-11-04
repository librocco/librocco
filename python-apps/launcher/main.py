#!/usr/bin/env -S uv run
"""
Librocco Launcher - Main entry point for the daemon manager.
"""
import sys
from PyQt6.QtWidgets import QApplication, QSystemTrayIcon, QMessageBox

from launcher.config import Config
from launcher.binary_manager import BinaryManager
from launcher.daemon_manager import EmbeddedSupervisor
from launcher.tray_app import TrayApp


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
        print(f"✓ Caddy binary found at {config.caddy_binary_path}")
        return True

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
            print("✓ Caddy binary downloaded and verified")
            return True
        else:
            print("✗ Failed to verify Caddy binary")
            return False

    except Exception as e:
        print(f"✗ Failed to download Caddy: {e}")
        return False


def main():
    """Main entry point."""
    print("Librocco Launcher starting...")

    # Determine app directory (sibling of main.py)
    from pathlib import Path
    app_dir = Path(__file__).parent / "app"

    # Initialize configuration
    print("Initializing configuration...")
    config = Config()
    config.initialize()
    config.ensure_caddyfile(app_dir)
    print(f"✓ Data directory: {config.data_dir}")
    print(f"✓ Config directory: {config.config_dir}")
    print(f"✓ App directory: {app_dir}")

    # Ensure Caddy binary exists
    if not initialize_caddy(config):
        show_error_dialog(
            "Initialization Error",
            "Failed to download or verify Caddy binary.\n\n"
            "Please check your internet connection and try again.",
        )
        return 1

    # Create daemon manager
    print("Initializing daemon manager...")
    daemon_manager = EmbeddedSupervisor(
        caddy_binary=config.caddy_binary_path,
        caddyfile=config.caddyfile_path,
        caddy_data_dir=config.caddy_data_dir,
        logs_dir=config.logs_dir,
    )

    # Start daemon manager
    daemon_manager.start()
    print("✓ Daemon manager started")

    # Auto-start Caddy if configured
    if config.get("auto_start_caddy", True):
        print("Auto-starting Caddy...")
        daemon_manager.start_daemon("caddy")
        print("✓ Caddy started")

    # Create and run tray application
    print("Starting tray application...")
    app = TrayApp(config, daemon_manager)

    # Check if system tray is available (must be done after QApplication is created)
    if not QSystemTrayIcon.isSystemTrayAvailable():
        show_error_dialog(
            "System Tray Unavailable",
            "System tray is not available on this system.\n\n"
            "The launcher requires a system tray to function.",
        )
        daemon_manager.stop()
        return 1

    print("✓ Tray application running")
    print(f"\nCaddy is configured to listen on http://{config.get('caddy_host')}:{config.get('caddy_port')}")
    print("Right-click the tray icon to access controls.\n")

    # Run the application
    return app.run()


if __name__ == "__main__":
    sys.exit(main())
