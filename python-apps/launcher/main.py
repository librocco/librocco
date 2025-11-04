#!/usr/bin/env python3
"""
Minimal cross-platform tray icon application using PyQt6.
"""
import sys
from PyQt6.QtWidgets import QApplication, QSystemTrayIcon, QMenu, QStyle
from PyQt6.QtGui import QIcon, QAction
from PyQt6.QtCore import QCoreApplication


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
        show_action = QAction("Show Message", self.menu)
        show_action.triggered.connect(self.show_message)
        self.menu.addAction(show_action)

        self.menu.addSeparator()

        quit_action = QAction("Quit", self.menu)
        quit_action.triggered.connect(self.quit_app)
        self.menu.addAction(quit_action)

        # Set the menu
        self.tray_icon.setContextMenu(self.menu)

        # Show the tray icon
        self.tray_icon.show()

        # Optional: Show a message on startup
        self.tray_icon.showMessage(
            "Launcher",
            "Tray application started",
            QSystemTrayIcon.MessageIcon.Information,
            2000
        )

    def show_message(self):
        """Show a test notification."""
        self.tray_icon.showMessage(
            "Hello",
            "This is a message from the tray icon!",
            QSystemTrayIcon.MessageIcon.Information,
            3000
        )

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
