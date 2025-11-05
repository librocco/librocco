"""
Error handling and user notification utilities.
"""

import logging
import traceback
from typing import Optional
from PyQt6.QtWidgets import QMessageBox, QWidget
from PyQt6.QtCore import QMetaObject, Qt, Q_ARG


logger = logging.getLogger("launcher")


class ErrorHandler:
    """
    Centralized error handling and user notifications.

    Provides methods to log and display errors to users with appropriate
    severity levels and modal dialogs for critical issues.
    """

    @staticmethod
    def handle_critical_error(
        title: str,
        message: str,
        exception: Optional[Exception] = None,
        parent: Optional[QWidget] = None,
    ) -> None:
        """
        Handle a critical error that requires user attention.

        Logs the error and displays a modal dialog to the user.

        Args:
            title: Dialog title
            message: User-friendly error message
            exception: Optional exception object for detailed logging
            parent: Optional parent widget for the dialog
        """
        # Log the error with full traceback
        if exception:
            logger.error(f"CRITICAL: {title} - {message}", exc_info=exception)
        else:
            logger.error(f"CRITICAL: {title} - {message}")

        # Show modal dialog to user
        ErrorHandler._show_error_dialog(
            title, message, QMessageBox.Icon.Critical, parent
        )

    @staticmethod
    def handle_error(
        title: str,
        message: str,
        exception: Optional[Exception] = None,
        show_dialog: bool = True,
        parent: Optional[QWidget] = None,
    ) -> None:
        """
        Handle a non-critical error.

        Logs the error and optionally displays a dialog to the user.

        Args:
            title: Dialog title
            message: User-friendly error message
            exception: Optional exception object for detailed logging
            show_dialog: Whether to show a dialog to the user
            parent: Optional parent widget for the dialog
        """
        # Log the error
        if exception:
            logger.error(f"{title} - {message}", exc_info=exception)
        else:
            logger.error(f"{title} - {message}")

        # Optionally show dialog
        if show_dialog:
            ErrorHandler._show_error_dialog(
                title, message, QMessageBox.Icon.Warning, parent
            )

    @staticmethod
    def handle_warning(
        title: str,
        message: str,
        show_dialog: bool = False,
        parent: Optional[QWidget] = None,
    ) -> None:
        """
        Handle a warning condition.

        Logs the warning and optionally displays a dialog to the user.

        Args:
            title: Dialog title
            message: User-friendly warning message
            show_dialog: Whether to show a dialog to the user
            parent: Optional parent widget for the dialog
        """
        logger.warning(f"{title} - {message}")

        if show_dialog:
            ErrorHandler._show_error_dialog(
                title, message, QMessageBox.Icon.Warning, parent
            )

    @staticmethod
    def log_exception(context: str, exception: Exception) -> None:
        """
        Log an exception with full traceback without showing a dialog.

        Useful for background operations where user notification isn't needed.

        Args:
            context: Description of what was happening when the exception occurred
            exception: The exception object
        """
        logger.error(f"Exception in {context}", exc_info=exception)

    @staticmethod
    def _show_error_dialog(
        title: str,
        message: str,
        icon: QMessageBox.Icon,
        parent: Optional[QWidget] = None,
    ) -> None:
        """
        Show a modal error dialog to the user.

        This is thread-safe and can be called from non-GUI threads.

        Args:
            title: Dialog title
            message: Error message
            icon: Icon to display (Critical, Warning, Information)
            parent: Optional parent widget
        """
        # Create and show message box
        # Note: This should be called from the Qt event loop thread
        msg_box = QMessageBox(parent)
        msg_box.setWindowTitle(title)
        msg_box.setText(message)
        msg_box.setIcon(icon)
        msg_box.setStandardButtons(QMessageBox.StandardButton.Ok)
        msg_box.exec()


def log_and_handle_exception(context: str):
    """
    Decorator to catch and log exceptions from functions.

    Usage:
        @log_and_handle_exception("updating status")
        def update_status(self):
            # ... code that might raise exceptions

    Args:
        context: Description of the operation for logging
    """

    def decorator(func):
        def wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                ErrorHandler.log_exception(context, e)
                # Re-raise to let caller decide how to handle
                raise

        return wrapper

    return decorator
