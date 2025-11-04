"""
System tray application with daemon management controls.
"""
import sys
import signal
from PyQt6.QtWidgets import QApplication, QSystemTrayIcon, QMenu, QStyle, QMessageBox
from PyQt6.QtGui import QAction
from PyQt6.QtCore import QCoreApplication, QTimer

from .log_viewer import LogViewerDialog


class TrayApp:
    """Main tray application with daemon management."""

    def __init__(self, config, daemon_manager):
        self.config = config
        self.daemon_manager = daemon_manager

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
        self.status_action = QAction("Caddy: Checking...", self.menu)
        self.status_action.setEnabled(False)
        self.menu.addAction(self.status_action)

        self.menu.addSeparator()

        # Daemon controls
        self.start_action = QAction("Start Caddy", self.menu)
        self.start_action.triggered.connect(self.start_caddy)
        self.menu.addAction(self.start_action)

        self.stop_action = QAction("Stop Caddy", self.menu)
        self.stop_action.triggered.connect(self.stop_caddy)
        self.menu.addAction(self.stop_action)

        self.restart_action = QAction("Restart Caddy", self.menu)
        self.restart_action.triggered.connect(self.restart_caddy)
        self.menu.addAction(self.restart_action)

        self.menu.addSeparator()

        # View logs
        self.logs_action = QAction("View Logs...", self.menu)
        self.logs_action.triggered.connect(self.show_logs)
        self.menu.addAction(self.logs_action)

        self.menu.addSeparator()

        # Quit
        quit_action = QAction("Quit", self.menu)
        quit_action.triggered.connect(self.quit_app)
        self.menu.addAction(quit_action)

    def update_status(self):
        """Update the status display and enable/disable menu items."""
        try:
            status = self.daemon_manager.get_status("caddy")

            # Update status text
            if status.status == "active":
                status_text = f"Caddy: ● Running"
                if status.pid:
                    status_text += f" (PID {status.pid})"
                self.status_action.setText(status_text)

                # Enable/disable controls
                self.start_action.setEnabled(False)
                self.stop_action.setEnabled(True)
                self.restart_action.setEnabled(True)

            elif status.status == "stopped":
                self.status_action.setText("Caddy: ○ Stopped")
                self.start_action.setEnabled(True)
                self.stop_action.setEnabled(False)
                self.restart_action.setEnabled(False)

            elif status.status == "starting":
                self.status_action.setText("Caddy: ◐ Starting...")
                self.start_action.setEnabled(False)
                self.stop_action.setEnabled(True)
                self.restart_action.setEnabled(False)

            else:
                self.status_action.setText(f"Caddy: ⚠ {status.status}")
                self.start_action.setEnabled(True)
                self.stop_action.setEnabled(False)
                self.restart_action.setEnabled(False)

        except Exception as e:
            self.status_action.setText(f"Caddy: ⚠ Error")
            print(f"Error updating status: {e}")

    def start_caddy(self):
        """Start the Caddy daemon."""
        success = self.daemon_manager.start_daemon("caddy")
        if success:
            self.show_message("Caddy Started", "Caddy daemon is starting...")
        else:
            self.show_message("Error", "Failed to start Caddy daemon", error=True)
        self.update_status()

    def stop_caddy(self):
        """Stop the Caddy daemon."""
        success = self.daemon_manager.stop_daemon("caddy")
        if success:
            self.show_message("Caddy Stopped", "Caddy daemon is stopping...")
        else:
            self.show_message("Error", "Failed to stop Caddy daemon", error=True)
        self.update_status()

    def restart_caddy(self):
        """Restart the Caddy daemon."""
        success = self.daemon_manager.restart_daemon("caddy")
        if success:
            self.show_message("Caddy Restarted", "Caddy daemon is restarting...")
        else:
            self.show_message("Error", "Failed to restart Caddy daemon", error=True)
        self.update_status()

    def show_logs(self):
        """Show the log viewer window."""
        if self.log_viewer is None or not self.log_viewer.isVisible():
            self.log_viewer = LogViewerDialog(self.daemon_manager, "caddy")
            self.log_viewer.show()
        else:
            self.log_viewer.activateWindow()
            self.log_viewer.raise_()

    def show_message(self, title: str, message: str, error: bool = False):
        """Show a system tray message."""
        icon = QSystemTrayIcon.MessageIcon.Critical if error else QSystemTrayIcon.MessageIcon.Information
        self.tray_icon.showMessage(title, message, icon, 3000)

    def signal_handler(self, signum, frame):
        """Handle SIGINT (ctrl-c) for graceful shutdown."""
        print(f"\nReceived signal {signum}, shutting down gracefully...")
        self.quit_app()

    def sigterm_handler(self, signum, frame):
        """Handle SIGTERM for immediate exit."""
        print(f"\nReceived signal {signum}, exiting...")
        sys.exit(0)

    def quit_app(self):
        """Quit the application."""
        # Stop daemon manager
        print("Stopping daemon manager...")
        self.daemon_manager.stop()

        # Hide tray icon
        self.tray_icon.hide()

        # Quit Qt
        QCoreApplication.quit()

    def run(self):
        """Start the application event loop."""
        return self.app.exec()
