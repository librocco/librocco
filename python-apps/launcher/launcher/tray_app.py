"""
System tray application with daemon management controls.
"""

import sys
import signal
import logging
import webbrowser
from PyQt6.QtWidgets import QApplication, QSystemTrayIcon, QMenu, QStyle, QMessageBox
from PyQt6.QtGui import QAction
from PyQt6.QtCore import QCoreApplication, QTimer

from .error_handler import ErrorHandler
from .i18n import _

logger = logging.getLogger("launcher")


class TrayApp:
    """Main tray application with daemon management."""

    # Timer intervals (milliseconds)
    SIGNAL_CHECK_INTERVAL_MS = 100  # Check for Python signals every 100ms
    STATUS_UPDATE_INTERVAL_MS = 2000  # Update daemon status every 2 seconds
    TRAY_RETRY_INTERVAL_MS = 500  # Check tray availability every 500ms
    TRAY_MAX_WAIT_SECONDS = 30  # Give up after 30 seconds

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

        # Connect left-click to open browser
        self.tray_icon.activated.connect(self.on_tray_activated)

        # Defer showing tray icon until event loop starts
        # This prevents the "ghost" empty space issue where show() is called
        # before the event loop is running
        QTimer.singleShot(0, self._show_tray_icon_with_retry)

        # Set up signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, self.signal_handler)
        # SIGTERM is not available on Windows
        if hasattr(signal, 'SIGTERM'):
            signal.signal(signal.SIGTERM, self.sigterm_handler)

        # Timer to allow Python to process signals
        self.signal_timer = QTimer()
        self.signal_timer.timeout.connect(lambda: None)
        self.signal_timer.start(self.SIGNAL_CHECK_INTERVAL_MS)

        # Timer to update status
        self.status_timer = QTimer()
        self.status_timer.timeout.connect(self.update_status)
        self.status_timer.start(self.STATUS_UPDATE_INTERVAL_MS)

        # Connect to daemon manager worker signals for async operations
        self.daemon_manager.worker.status_ready.connect(self._handle_status_update)
        self.daemon_manager.worker.operation_complete.connect(self._handle_operation_complete)
        self.daemon_manager.worker.error_occurred.connect(self._handle_worker_error)

        # Initial status update
        self.update_status()

    def _show_tray_icon_with_retry(self):
        """Show tray icon, retrying if system tray is not available yet.

        This handles the race condition where the system tray might not be
        available immediately on application startup.
        """
        if QSystemTrayIcon.isSystemTrayAvailable():
            self.tray_icon.show()
            logger.info("Tray icon shown successfully")
        else:
            logger.warning("System tray not available yet, will retry...")
            self._tray_retry_count = 0
            self._tray_retry_timer = QTimer()
            self._tray_retry_timer.timeout.connect(self._retry_show_tray_icon)
            self._tray_retry_timer.start(self.TRAY_RETRY_INTERVAL_MS)

    def _retry_show_tray_icon(self):
        """Retry showing the tray icon if system tray becomes available."""
        self._tray_retry_count += 1
        max_retries = (self.TRAY_MAX_WAIT_SECONDS * 1000) // self.TRAY_RETRY_INTERVAL_MS

        if QSystemTrayIcon.isSystemTrayAvailable():
            self.tray_icon.show()
            self._tray_retry_timer.stop()
            logger.info(f"Tray icon shown successfully after {self._tray_retry_count} retries")
        elif self._tray_retry_count >= max_retries:
            self._tray_retry_timer.stop()
            logger.error(f"System tray not available after {self.TRAY_MAX_WAIT_SECONDS} seconds")
            QMessageBox.critical(
                None,
                _("System Tray Error"),
                _("Could not create system tray icon. The system tray may not be available.")
            )
            sys.exit(1)
        else:
            logger.debug(f"Retrying tray icon creation (attempt {self._tray_retry_count}/{max_retries})...")

    def _create_menu(self):
        """Create the tray menu with status-first design."""
        # Open browser action
        open_browser_action = QAction(_("Open in Browser"), self.menu)
        open_browser_action.triggered.connect(self.open_browser)
        self.menu.addAction(open_browser_action)

        self.menu.addSeparator()

        # System status labels (will be updated dynamically)
        self.system_status_action = QAction(_("System Status: ◐ Checking..."), self.menu)
        self.system_status_action.setEnabled(False)
        self.menu.addAction(self.system_status_action)

        self.caddy_status_action = QAction(_("  Caddy: Checking..."), self.menu)
        self.caddy_status_action.setEnabled(False)
        self.menu.addAction(self.caddy_status_action)

        self.syncserver_status_action = QAction(_("  Sync Server: Checking..."), self.menu)
        self.syncserver_status_action.setEnabled(False)
        self.menu.addAction(self.syncserver_status_action)

        self.menu.addSeparator()

        # System-level controls
        self.start_system_action = QAction(_("Start System"), self.menu)
        self.start_system_action.triggered.connect(self.start_system)
        self.menu.addAction(self.start_system_action)

        self.stop_system_action = QAction(_("Stop System"), self.menu)
        self.stop_system_action.triggered.connect(self.stop_system)
        self.menu.addAction(self.stop_system_action)

        self.restart_system_action = QAction(_("Restart System"), self.menu)
        self.restart_system_action.triggered.connect(self.restart_system)
        self.menu.addAction(self.restart_system_action)

        self.menu.addSeparator()

        # Quit
        quit_action = QAction(_("Quit"), self.menu)
        quit_action.triggered.connect(self.quit_app)
        self.menu.addAction(quit_action)

    def on_tray_activated(self, reason):
        """Handle tray icon activation (clicks)."""
        # Only handle left-click (Trigger reason)
        if reason == QSystemTrayIcon.ActivationReason.Trigger:
            self.open_browser()

    def open_browser(self):
        """Open the web application in the default browser."""
        try:
            # Check if Caddy is running (use synchronous method for immediate result)
            status = self.daemon_manager._get_status_sync("caddy")
            if status.status != "active":
                logger.warning("User tried to open browser but Caddy is not running")
                self.show_message(
                    _("Caddy Not Running"),
                    _("Please start Caddy first using the tray menu."),
                    error=True,
                )
                return

            # Get the web URL from config
            url = self.config.get_web_url()
            logger.info(f"Opening browser to: {url}")

            # Open in default browser
            webbrowser.open(url)

        except (OSError, AttributeError, RuntimeError) as e:
            ErrorHandler.handle_error(
                _("Browser Error"),
                _("Failed to open browser."),
                exception=e,
                show_dialog=True,
                parent=None,
            )


    def update_status(self):
        """Request status update from daemon manager (async, non-blocking)."""
        # Call async method - result will arrive via status_ready signal
        self.daemon_manager.get_system_status()

    def _handle_status_update(self, statuses):
        """Handle system status update from worker thread.

        Args:
            statuses: Tuple of (caddy_status, syncserver_status) or None on error
        """
        try:
            if statuses is None:
                # Error occurred in worker (already logged there)
                self.system_status_action.setText(_("System Status: ⚠ Error"))
                self.caddy_status_action.setText(_("  Caddy: ⚠ Error"))
                self.syncserver_status_action.setText(_("  Sync Server: ⚠ Error"))
                self._update_menu_states(None, None)
                return

            # Handle both tuple (from get_system_status) and single DaemonStatus (legacy)
            if isinstance(statuses, tuple):
                caddy_status, syncserver_status = statuses
            else:
                # Legacy: single DaemonStatus object (shouldn't happen with new code)
                logger.warning("Received single DaemonStatus instead of tuple - updating to use get_system_status")
                # Request a proper system status update
                self.daemon_manager.get_system_status()
                return

            # Update individual daemon status labels
            self._update_daemon_status_label(caddy_status, self.caddy_status_action, "Caddy")
            self._update_daemon_status_label(syncserver_status, self.syncserver_status_action, "Sync Server")

            # Determine overall system status
            caddy_running = caddy_status and caddy_status.status == "active"
            syncserver_running = syncserver_status and syncserver_status.status == "active"
            caddy_starting = caddy_status and caddy_status.status == "starting"
            syncserver_starting = syncserver_status and syncserver_status.status == "starting"
            caddy_stopped = caddy_status and caddy_status.status == "stopped"
            syncserver_stopped = syncserver_status and syncserver_status.status == "stopped"

            if caddy_running and syncserver_running:
                self.system_status_action.setText(_("System Status: ● All Running"))
            elif caddy_stopped and syncserver_stopped:
                self.system_status_action.setText(_("System Status: ○ Stopped"))
            elif caddy_starting or syncserver_starting:
                self.system_status_action.setText(_("System Status: ◐ Starting..."))
            elif (caddy_running and not syncserver_running) or (not caddy_running and syncserver_running):
                self.system_status_action.setText(_("System Status: ⚠ Partially Running"))
            else:
                self.system_status_action.setText(_("System Status: ⚠ Unknown"))

            # Update menu item states
            self._update_menu_states(caddy_status, syncserver_status)

        except (AttributeError, TypeError) as exc:
            self.system_status_action.setText(_("System Status: ⚠ Error"))
            ErrorHandler.log_exception("status update handler", exc)

    def _update_daemon_status_label(self, status, action, daemon_name):
        """Update a daemon status label with proper formatting."""
        if not status:
            action.setText(f"  {daemon_name}: ⚠ Unknown")
            return

        if status.status == "active":
            status_text = f"  {daemon_name}: ● Running"
            if status.pid:
                status_text += f" (PID {status.pid})"
            action.setText(_(status_text))
        elif status.status == "stopped":
            action.setText(_(f"  {daemon_name}: ○ Stopped"))
        elif status.status == "starting":
            action.setText(_(f"  {daemon_name}: ◐ Starting..."))
        elif status.status == "error":
            action.setText(_(f"  {daemon_name}: ⚠ Error"))
        else:
            action.setText(f"  {daemon_name}: ⚠ {status.status}")

    def _update_menu_states(self, caddy_status, syncserver_status):
        """Update enabled/disabled state of menu items based on daemon statuses."""
        caddy_running = caddy_status and caddy_status.status == "active"
        syncserver_running = syncserver_status and syncserver_status.status == "active"
        any_running = caddy_running or syncserver_running
        all_running = caddy_running and syncserver_running

        # System-level controls
        self.start_system_action.setEnabled(not all_running)
        self.stop_system_action.setEnabled(any_running)
        self.restart_system_action.setEnabled(any_running)

    def _handle_operation_complete(self, operation: str, success: bool):
        """Handle daemon operation completion from worker thread."""
        try:
            if success:
                # Show success message
                if operation == "start":
                    self.show_message(_("Caddy Started"), _("Caddy daemon is starting..."))
                elif operation == "stop":
                    self.show_message(_("Caddy Stopped"), _("Caddy daemon is stopping..."))
                elif operation == "restart":
                    self.show_message(_("Caddy Restarted"), _("Caddy daemon is restarting..."))
                elif operation == "start_all":
                    self.show_message(_("System Started"), _("Starting all services..."))
                elif operation == "stop_all":
                    self.show_message(_("System Stopped"), _("Stopping all services..."))
                elif operation == "restart_all":
                    self.show_message(_("System Restarted"), _("Restarting all services..."))
            else:
                # Show error message
                logger.error(f"Failed to {operation}")
                ErrorHandler.handle_error(
                    _(f"{operation.replace('_', ' ').title()} Failed"),
                    _(f"Operation failed. Check the logs for details."),
                    show_dialog=True,
                    parent=None,
                )

            # Trigger status update after operation
            self.update_status()
        except (RuntimeError, AttributeError, TypeError) as exc:
            ErrorHandler.log_exception(f"operation complete handler ({operation})", exc)

    def _handle_worker_error(self, operation: str, error_message: str):
        """Handle worker errors."""
        logger.error(f"Worker error during {operation}: {error_message}")
        # Show error to user with details
        ErrorHandler.handle_error(
            _(f"{operation.replace('_', ' ').title()} Error"),
            _(f"An error occurred: {error_message}"),
            show_dialog=True,
            parent=None,
        )


    def start_system(self):
        """Start all daemons (async, non-blocking)."""
        logger.info("User initiated: Start System")
        self.daemon_manager.start_all_daemons()

    def stop_system(self):
        """Stop all daemons (async, non-blocking)."""
        logger.info("User initiated: Stop System")
        self.daemon_manager.stop_all_daemons()

    def restart_system(self):
        """Restart all daemons (async, non-blocking)."""
        logger.info("User initiated: Restart System")
        self.daemon_manager.restart_all_daemons()


    def show_message(self, title: str, message: str, error: bool = False):
        """Show a system tray message."""
        icon = (
            QSystemTrayIcon.MessageIcon.Critical
            if error
            else QSystemTrayIcon.MessageIcon.Information
        )
        self.tray_icon.showMessage(title, message, icon, 3000)

    def signal_handler(self, signum, _frame):
        """Handle SIGINT (ctrl-c) for graceful shutdown."""
        logger.info(f"Received signal {signum}, shutting down gracefully...")
        self.quit_app()

    def sigterm_handler(self, signum, _frame):
        """Handle SIGTERM for graceful shutdown."""
        logger.info(f"Received signal {signum}, shutting down gracefully...")
        self.quit_app()

    def quit_app(self):
        """Quit the application with proper resource cleanup."""
        # Stop daemon manager (don't let this block other cleanup)
        try:
            logger.info("Stopping daemon manager...")
            self.daemon_manager.stop()
        except Exception as exc:
            ErrorHandler.log_exception("daemon manager shutdown", exc)

        # Stop timers (don't let this block other cleanup)
        try:
            self.status_timer.stop()
            self.signal_timer.stop()
        except Exception as exc:
            ErrorHandler.log_exception("timer cleanup", exc)

        # Hide tray icon (don't let this block Qt quit)
        try:
            self.tray_icon.hide()
        except Exception as exc:
            ErrorHandler.log_exception("tray icon cleanup", exc)

        # Always quit Qt, even if previous steps failed
        try:
            QCoreApplication.quit()
        except Exception as exc:
            ErrorHandler.log_exception("Qt shutdown", exc)
            # Last resort: force exit
            sys.exit(1)

    def run(self):
        """Start the application event loop."""
        return self.app.exec()
