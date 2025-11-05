"""
System tray application with daemon management controls.
"""

import sys
import signal
import logging
from PyQt6.QtWidgets import QApplication, QSystemTrayIcon, QMenu, QStyle, QMessageBox
from PyQt6.QtGui import QAction
from PyQt6.QtCore import QCoreApplication, QTimer

from .log_viewer import LogViewerDialog
from .error_handler import ErrorHandler
from .i18n import _

logger = logging.getLogger("launcher")


class TrayApp:
    """Main tray application with daemon management."""

    def __init__(self, config, daemon_manager):
        self.config = config
        self.daemon_manager = daemon_manager

        # Get or create QApplication instance
        self.app = QApplication.instance()
        if self.app is None:
            self.app = QApplication(sys.argv)
        self.app.setQuitOnLastWindowClosed(False)

        # Create the tray icon
        self.tray_icon = QSystemTrayIcon()
        icon = self.app.style().standardIcon(QStyle.StandardPixmap.SP_ComputerIcon)
        self.tray_icon.setIcon(icon)

        # Create menu
        self.menu = QMenu()
        self._create_menu()

        self.tray_icon.setContextMenu(self.menu)
        self.tray_icon.show()

        # Set up signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, self.signal_handler)
        # SIGTERM is not available on Windows
        if hasattr(signal, 'SIGTERM'):
            signal.signal(signal.SIGTERM, self.sigterm_handler)

        # Timer to allow Python to process signals
        self.signal_timer = QTimer()
        self.signal_timer.timeout.connect(lambda: None)
        self.signal_timer.start(100)

        # Timer to update status
        self.status_timer = QTimer()
        self.status_timer.timeout.connect(self.update_status)
        self.status_timer.start(2000)  # Update every 2 seconds

        # Log viewer window reference
        self.log_viewer = None

        # Initial status update
        self.update_status()

    def _create_menu(self):
        """Create the tray menu."""
        # Status label (will be updated dynamically)
        self.status_action = QAction(_("Caddy: Checking..."), self.menu)
        self.status_action.setEnabled(False)
        self.menu.addAction(self.status_action)

        self.menu.addSeparator()

        # Daemon controls
        self.start_action = QAction(_("Start Caddy"), self.menu)
        self.start_action.triggered.connect(self.start_caddy)
        self.menu.addAction(self.start_action)

        self.stop_action = QAction(_("Stop Caddy"), self.menu)
        self.stop_action.triggered.connect(self.stop_caddy)
        self.menu.addAction(self.stop_action)

        self.restart_action = QAction(_("Restart Caddy"), self.menu)
        self.restart_action.triggered.connect(self.restart_caddy)
        self.menu.addAction(self.restart_action)

        self.menu.addSeparator()

        # View logs
        self.logs_action = QAction(_("View Logs..."), self.menu)
        self.logs_action.triggered.connect(self.show_logs)
        self.menu.addAction(self.logs_action)

        self.menu.addSeparator()

        # Quit
        quit_action = QAction(_("Quit"), self.menu)
        quit_action.triggered.connect(self.quit_app)
        self.menu.addAction(quit_action)

    def update_status(self):
        """Update the status display and enable/disable menu items."""
        try:
            status = self.daemon_manager.get_status("caddy")

            # Update status text
            if status.status == "active":
                status_text = _("Caddy: ● Running")
                if status.pid:
                    status_text += f" (PID {status.pid})"
                self.status_action.setText(status_text)

                # Enable/disable controls
                self.start_action.setEnabled(False)
                self.stop_action.setEnabled(True)
                self.restart_action.setEnabled(True)

            elif status.status == "stopped":
                self.status_action.setText(_("Caddy: ○ Stopped"))
                self.start_action.setEnabled(True)
                self.stop_action.setEnabled(False)
                self.restart_action.setEnabled(False)

            elif status.status == "starting":
                self.status_action.setText(_("Caddy: ◐ Starting..."))
                self.start_action.setEnabled(False)
                self.stop_action.setEnabled(True)
                self.restart_action.setEnabled(False)

            elif status.status == "error":
                self.status_action.setText(_("Caddy: ⚠ Error"))
                self.start_action.setEnabled(True)
                self.stop_action.setEnabled(False)
                self.restart_action.setEnabled(False)
                # Log error but don't show dialog - status updates happen frequently
                logger.warning("Caddy status check returned error state")

            else:
                self.status_action.setText(f"Caddy: ⚠ {status.status}")
                self.start_action.setEnabled(True)
                self.stop_action.setEnabled(False)
                self.restart_action.setEnabled(False)
                logger.warning(f"Unknown Caddy status: {status.status}")

        except Exception as e:
            self.status_action.setText(_("Caddy: ⚠ Error"))
            # Log but don't show dialog - status checks are frequent background operations
            ErrorHandler.log_exception("status update", e)

    def start_caddy(self):
        """Start the Caddy daemon."""
        try:
            success = self.daemon_manager.start_daemon("caddy")
            if success:
                logger.info("User initiated: Start Caddy")
                self.show_message(_("Caddy Started"), _("Caddy daemon is starting..."))
            else:
                logger.error("Failed to start Caddy daemon")
                ErrorHandler.handle_error(
                    _("Start Failed"),
                    _("Failed to start Caddy daemon. Check the logs for details."),
                    show_dialog=True,
                    parent=None,
                )
        except Exception as e:
            ErrorHandler.handle_critical_error(
                _("Start Error"),
                _("An unexpected error occurred while starting Caddy."),
                exception=e,
                parent=None,
            )
        finally:
            self.update_status()

    def stop_caddy(self):
        """Stop the Caddy daemon."""
        try:
            success = self.daemon_manager.stop_daemon("caddy")
            if success:
                logger.info("User initiated: Stop Caddy")
                self.show_message(_("Caddy Stopped"), _("Caddy daemon is stopping..."))
            else:
                logger.error("Failed to stop Caddy daemon")
                ErrorHandler.handle_error(
                    _("Stop Failed"),
                    _("Failed to stop Caddy daemon. Check the logs for details."),
                    show_dialog=True,
                    parent=None,
                )
        except Exception as e:
            ErrorHandler.handle_critical_error(
                _("Stop Error"),
                _("An unexpected error occurred while stopping Caddy."),
                exception=e,
                parent=None,
            )
        finally:
            self.update_status()

    def restart_caddy(self):
        """Restart the Caddy daemon."""
        try:
            success = self.daemon_manager.restart_daemon("caddy")
            if success:
                logger.info("User initiated: Restart Caddy")
                self.show_message(_("Caddy Restarted"), _("Caddy daemon is restarting..."))
            else:
                logger.error("Failed to restart Caddy daemon")
                ErrorHandler.handle_error(
                    _("Restart Failed"),
                    _("Failed to restart Caddy daemon. Check the logs for details."),
                    show_dialog=True,
                    parent=None,
                )
        except Exception as e:
            ErrorHandler.handle_critical_error(
                _("Restart Error"),
                _("An unexpected error occurred while restarting Caddy."),
                exception=e,
                parent=None,
            )
        finally:
            self.update_status()

    def show_logs(self):
        """Show the log viewer window."""
        try:
            if self.log_viewer is None or not self.log_viewer.isVisible():
                self.log_viewer = LogViewerDialog(self.daemon_manager, "caddy")
                self.log_viewer.show()
            else:
                self.log_viewer.activateWindow()
                self.log_viewer.raise_()
        except Exception as e:
            ErrorHandler.handle_error(
                _("Log Viewer Error"),
                _("Failed to open log viewer window."),
                exception=e,
                show_dialog=True,
                parent=None,
            )

    def show_message(self, title: str, message: str, error: bool = False):
        """Show a system tray message."""
        icon = (
            QSystemTrayIcon.MessageIcon.Critical
            if error
            else QSystemTrayIcon.MessageIcon.Information
        )
        self.tray_icon.showMessage(title, message, icon, 3000)

    def signal_handler(self, signum, frame):
        """Handle SIGINT (ctrl-c) for graceful shutdown."""
        logger.info(f"Received signal {signum}, shutting down gracefully...")
        self.quit_app()

    def sigterm_handler(self, signum, frame):
        """Handle SIGTERM for immediate exit."""
        logger.info(f"Received signal {signum}, exiting immediately...")
        sys.exit(0)

    def quit_app(self):
        """Quit the application."""
        try:
            # Stop daemon manager
            logger.info("Stopping daemon manager...")
            self.daemon_manager.stop()

            # Hide tray icon
            self.tray_icon.hide()

            # Quit Qt
            QCoreApplication.quit()
        except Exception as e:
            ErrorHandler.log_exception("application shutdown", e)
            # Force exit even if shutdown fails
            sys.exit(1)

    def run(self):
        """Start the application event loop."""
        return self.app.exec()
