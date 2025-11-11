"""
Log viewer window for viewing daemon logs.
"""

from PyQt6.QtWidgets import (
    QDialog,
    QVBoxLayout,
    QHBoxLayout,
    QPushButton,
    QTextEdit,
    QLabel,
    QTabWidget,
    QWidget,
)
from PyQt6.QtCore import QTimer, Qt
from PyQt6.QtGui import QFont

from .i18n import _


class LogViewerDialog(QDialog):
    """Dialog for viewing daemon logs with auto-refresh."""

    # Refresh interval (milliseconds)
    LOG_REFRESH_INTERVAL_MS = 1000  # Refresh logs every second

    def __init__(self, daemon_manager, daemon_name: str = "caddy", parent=None):
        super().__init__(parent)
        self.daemon_manager = daemon_manager
        self.daemon_name = daemon_name

        # Translators: {0} is replaced with the daemon name (e.g., "Caddy")
        self.setWindowTitle(_("{0} Logs").format(daemon_name.capitalize()))
        self.resize(800, 600)

        # Create UI
        self._setup_ui()

        # Connect to daemon manager worker signals
        self.daemon_manager.worker.status_ready.connect(self._handle_status_update)

        # Auto-refresh timer
        self.refresh_timer = QTimer()
        self.refresh_timer.timeout.connect(self.refresh_logs)
        self.refresh_timer.start(self.LOG_REFRESH_INTERVAL_MS)

        # Initial load
        self.refresh_logs()

    def _setup_ui(self):
        """Setup the UI components."""
        layout = QVBoxLayout()

        # Status label
        self.status_label = QLabel()
        self.status_label.setStyleSheet("font-weight: bold; padding: 5px;")
        layout.addWidget(self.status_label)

        # Tab widget for log streams
        self.tabs = QTabWidget()

        # Primary log tab
        self.stdout_text = QTextEdit()
        self.stdout_text.setReadOnly(True)
        self.stdout_text.setFont(QFont("Monospace", 9))
        self.stdout_text.setLineWrapMode(QTextEdit.LineWrapMode.NoWrap)

        # Secondary log tab
        self.stderr_text = QTextEdit()
        self.stderr_text.setReadOnly(True)
        self.stderr_text.setFont(QFont("Monospace", 9))
        self.stderr_text.setLineWrapMode(QTextEdit.LineWrapMode.NoWrap)

        # Set tab labels based on daemon type
        if self.daemon_name == "caddy":
            self.tabs.addTab(self.stdout_text, _("Server Logs"))
            self.tabs.addTab(self.stderr_text, _("Access Logs"))
        elif self.daemon_name == "syncserver":
            self.tabs.addTab(self.stdout_text, _("Sync Server Logs"))
            # Hide second tab for syncserver (no secondary logs)
            # Still create it but don't add it to tabs
        else:
            # Generic fallback
            self.tabs.addTab(self.stdout_text, _("Primary Logs"))
            self.tabs.addTab(self.stderr_text, _("Secondary Logs"))

        layout.addWidget(self.tabs)

        # Buttons
        button_layout = QHBoxLayout()

        self.refresh_button = QPushButton(_("Refresh Now"))
        self.refresh_button.clicked.connect(self.refresh_logs)
        button_layout.addWidget(self.refresh_button)

        self.clear_button = QPushButton(_("Clear"))
        self.clear_button.clicked.connect(self.clear_logs)
        button_layout.addWidget(self.clear_button)

        button_layout.addStretch()

        self.close_button = QPushButton(_("Close"))
        self.close_button.clicked.connect(self.close)
        button_layout.addWidget(self.close_button)

        layout.addLayout(button_layout)

        self.setLayout(layout)

    def refresh_logs(self):
        """Refresh the log contents (async status, sync logs)."""
        try:
            # Request status update asynchronously (result comes via signal)
            self.daemon_manager.get_status(self.daemon_name)

            # Get logs synchronously (just file reading, not a Circus operation)
            stdout, stderr = self.daemon_manager.get_logs(self.daemon_name, lines=500)

            # Update text widgets (preserve scroll position if at bottom)
            self._update_text_widget(self.stdout_text, stdout)
            self._update_text_widget(self.stderr_text, stderr)

        except (OSError, RuntimeError, AttributeError) as exc:
            # Translators: {0} is replaced with the error message
            self.status_label.setText(_("Error: {0}").format(str(exc)))

    def _handle_status_update(self, status):
        """Handle status update from worker thread."""
        try:
            if status is None:
                self.status_label.setText(_("Status: ERROR"))
                return

            # Handle tuple from get_system_status (extract our daemon's status)
            if isinstance(status, tuple):
                caddy_status, syncserver_status = status
                # Pick the status for the daemon we're viewing
                if self.daemon_name == "caddy":
                    status = caddy_status
                elif self.daemon_name == "syncserver":
                    status = syncserver_status
                else:
                    # Unknown daemon, just use the first status
                    status = caddy_status

            # Now process the single daemon status
            if not status:
                self.status_label.setText(_("Status: UNKNOWN"))
                return

            # Translators: {0} is replaced with the status (e.g., "RUNNING", "STOPPED")
            status_text = _("Status: {0}").format(status.status.upper())
            if status.pid:
                # Translators: {0} is replaced with the process ID number
                status_text += f" ({_('PID: {0}').format(status.pid)})"
            if status.uptime:
                uptime_str = self._format_uptime(status.uptime)
                # Translators: {0} is replaced with the uptime string (e.g., "5m", "2h 30m")
                status_text += f" | {_('Uptime: {0}').format(uptime_str)}"
            self.status_label.setText(status_text)

        except (AttributeError, TypeError) as exc:
            # Translators: {0} is replaced with the error message
            self.status_label.setText(_("Error: {0}").format(str(exc)))

    def _update_text_widget(self, widget: QTextEdit, text: str):
        """Update text widget while preserving scroll position."""
        # Only update if content changed
        if widget.toPlainText() == text:
            return

        # Check if we're at the bottom
        scrollbar = widget.verticalScrollBar()
        at_bottom = scrollbar.value() >= scrollbar.maximum() - 10

        # Save cursor position
        cursor = widget.textCursor()
        cursor_position = cursor.position()

        # Update text
        widget.setPlainText(text)

        # Restore cursor position if not at end
        if not at_bottom and cursor_position < len(text):
            cursor.setPosition(min(cursor_position, len(text)))
            widget.setTextCursor(cursor)
        elif at_bottom:
            # Scroll to bottom if we were at bottom
            scrollbar.setValue(scrollbar.maximum())

    def _format_uptime(self, seconds: float) -> str:
        """Format uptime in a human-readable way."""
        if seconds < 60:
            return f"{int(seconds)}s"
        elif seconds < 3600:
            minutes = int(seconds / 60)
            return f"{minutes}m"
        else:
            hours = int(seconds / 3600)
            minutes = int((seconds % 3600) / 60)
            return f"{hours}h {minutes}m"

    def clear_logs(self):
        """Clear the log displays."""
        self.stdout_text.clear()
        self.stderr_text.clear()

    def closeEvent(self, event):
        """Stop refresh timer when closing."""
        self.refresh_timer.stop()
        super().closeEvent(event)
