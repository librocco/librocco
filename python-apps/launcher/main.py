#!/usr/bin/env -S uv run
"""
Minimal cross-platform tray icon application using PyQt6.
"""
import sys
import signal
from PyQt6.QtWidgets import QApplication, QSystemTrayIcon, QMenu, QStyle, QMessageBox
from PyQt6.QtGui import QIcon, QAction
from PyQt6.QtCore import QCoreApplication, QTimer


class TrayApp:
    """Main tray application class."""

    def __init__(self):
        self.app = QApplication(sys.argv)
        self.app.setQuitOnLastWindowClosed(False)  # Keep running when no windows are open

        # Create the tray icon
        self.tray_icon = QSystemTrayIcon()

        # Use a built-in icon (you can replace this with a custom icon later)
        icon = self.app.style().standardIcon(QStyle.StandardPixmap.SP_ComputerIcon)
        self.tray_icon.setIcon(icon)

        # Create the menu
        self.menu = QMenu()

        # Add actions
        show_action = QAction("Show Dialog", self.menu)
        show_action.triggered.connect(self.show_dialog)
        self.menu.addAction(show_action)

        self.menu.addSeparator()

        quit_action = QAction("Quit", self.menu)
        quit_action.triggered.connect(self.quit_app)
        self.menu.addAction(quit_action)

        # Set the menu
        self.tray_icon.setContextMenu(self.menu)

        # Show the tray icon
        self.tray_icon.show()

        # Set up signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.sigterm_handler)

        # Create a timer to allow Python to process signals
        # Qt's event loop blocks Python signal handling, so we need periodic Python execution
        self.timer = QTimer()
        self.timer.timeout.connect(lambda: None)  # Do nothing, just let Python process signals
        self.timer.start(100)  # Check every 100ms

    def show_dialog(self):
        """Show a test dialog."""
        msg_box = QMessageBox()
        msg_box.setWindowTitle("Launcher")
        msg_box.setText("Hello from the tray icon!")
        msg_box.setIcon(QMessageBox.Icon.Information)
        msg_box.exec()

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
        self.tray_icon.hide()
        QCoreApplication.quit()

    def run(self):
        """Start the application event loop."""
        return self.app.exec()


def main():
    """Main entry point."""
    app = TrayApp()

    # Check if system tray is available (must be done after QApplication is created)
    if not QSystemTrayIcon.isSystemTrayAvailable():
        print("System tray is not available on this system", file=sys.stderr)
        return 1

    return app.run()


if __name__ == "__main__":
    sys.exit(main())
