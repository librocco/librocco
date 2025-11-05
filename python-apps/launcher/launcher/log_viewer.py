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

        # Tab widget for stdout and stderr
        self.tabs = QTabWidget()

        # Stdout tab
        self.stdout_text = QTextEdit()
        self.stdout_text.setReadOnly(True)
        self.stdout_text.setFont(QFont("Monospace", 9))
        self.stdout_text.setLineWrapMode(QTextEdit.LineWrapMode.NoWrap)
        self.tabs.addTab(self.stdout_text, _("Standard Output"))

        # Stderr tab
        self.stderr_text = QTextEdit()
        self.stderr_text.setReadOnly(True)
        self.stderr_text.setFont(QFont("Monospace", 9))
        self.stderr_text.setLineWrapMode(QTextEdit.LineWrapMode.NoWrap)
        self.tabs.addTab(self.stderr_text, _("Standard Error"))

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
        """Refresh the log contents."""
        try:
            # Get status
            status = self.daemon_manager.get_status(self.daemon_name)
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

            # Get logs
            stdout, stderr = self.daemon_manager.get_logs(self.daemon_name, lines=500)

            # Update text widgets (preserve scroll position if at bottom)
            self._update_text_widget(self.stdout_text, stdout)
            self._update_text_widget(self.stderr_text, stderr)

        except Exception as exc:
            # Translators: {0} is replaced with the error message
            self.status_label.setText(_("Error: {0}").format(str(e)))

    def _update_text_widget(self, widget: QTextEdit, text: str):
        """Update text widget while preserving scroll position."""
        # Check if we're at the bottom
        scrollbar = widget.verticalScrollBar()
        at_bottom = scrollbar.value() >= scrollbar.maximum() - 10

        # Update text
        widget.setPlainText(text)

        # Scroll to bottom if we were at bottom
        if at_bottom:
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
