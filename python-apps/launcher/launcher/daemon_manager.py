"""
Daemon management using Circus as an embedded supervisor.
"""

import logging
import os
import platform
import tempfile
import threading
import time
from pathlib import Path
from typing import Dict, Optional
from circus import get_arbiter
from circus.client import CircusClient
from PyQt6.QtCore import QObject, QThread, pyqtSignal, pyqtSlot as Slot

logger = logging.getLogger("launcher")


class DaemonStatus:
    """Daemon status information."""

    def __init__(
        self,
        name: str,
        status: str,
        pid: Optional[int] = None,
        uptime: Optional[float] = None,
    ):
        self.name = name
        self.status = status  # "active", "stopped", "starting", "error"
        self.pid = pid
        self.uptime = uptime


class DaemonWorker(QObject):
    """
    Worker object for performing blocking Circus operations in a background thread.

    Communicates with main thread via signals to avoid blocking the Qt event loop.
    All methods are slots that should be called via QMetaObject.invokeMethod or
    signal connections.
    """

    # Signals for communicating results back to main thread
    status_ready = pyqtSignal(object)  # DaemonStatus or None
    operation_complete = pyqtSignal(str, bool)  # (operation_name, success)
    error_occurred = pyqtSignal(str, str)  # (operation, error_message)

    def __init__(self, supervisor: 'EmbeddedSupervisor'):
        """
        Initialize worker.

        Args:
            supervisor: The EmbeddedSupervisor instance to perform operations on
        """
        super().__init__()
        self.supervisor = supervisor

    @Slot(str)
    def do_get_status(self, daemon_name: str):
        """
        Get daemon status in background thread.

        Emits status_ready signal with result when complete.
        """
        try:
            status = self.supervisor._get_status_sync(daemon_name)
            self.status_ready.emit(status)
        except Exception as exc:
            logger.error(f"Worker: Failed to get status for {daemon_name}", exc_info=exc)
            self.error_occurred.emit("get_status", str(exc))
            self.status_ready.emit(None)

    @Slot(str)
    def do_start_daemon(self, daemon_name: str):
        """
        Start daemon in background thread.

        Emits operation_complete signal when done.
        """
        try:
            success = self.supervisor._start_daemon_sync(daemon_name)
            self.operation_complete.emit("start", success)
        except Exception as exc:
            logger.error(f"Worker: Failed to start {daemon_name}", exc_info=exc)
            self.error_occurred.emit("start_daemon", str(exc))
            self.operation_complete.emit("start", False)

    @Slot(str)
    def do_stop_daemon(self, daemon_name: str):
        """
        Stop daemon in background thread.

        Emits operation_complete signal when done.
        """
        try:
            success = self.supervisor._stop_daemon_sync(daemon_name)
            self.operation_complete.emit("stop", success)
        except Exception as exc:
            logger.error(f"Worker: Failed to stop {daemon_name}", exc_info=exc)
            self.error_occurred.emit("stop_daemon", str(exc))
            self.operation_complete.emit("stop", False)

    @Slot(str)
    def do_restart_daemon(self, daemon_name: str):
        """
        Restart daemon in background thread.

        Emits operation_complete signal when done.
        """
        try:
            success = self.supervisor._restart_daemon_sync(daemon_name)
            self.operation_complete.emit("restart", success)
        except Exception as exc:
            logger.error(f"Worker: Failed to restart {daemon_name}", exc_info=exc)
            self.error_occurred.emit("restart_daemon", str(exc))
            self.operation_complete.emit("restart", False)


class EmbeddedSupervisor(QObject):
    """Embedded Circus-based process supervisor."""

    # Initialization timing (seconds)
    ARBITER_INIT_WAIT_SECONDS = 2  # Wait for arbiter to initialize watchers

    # Internal signals for requesting worker operations
    _request_status = pyqtSignal(str)
    _request_start = pyqtSignal(str)
    _request_stop = pyqtSignal(str)
    _request_restart = pyqtSignal(str)

    def __init__(
        self, caddy_binary: Path, caddyfile: Path, caddy_data_dir: Path, logs_dir: Path
    ):
        super().__init__()
        self.caddy_binary = caddy_binary
        self.caddyfile = caddyfile
        self.caddy_data_dir = caddy_data_dir
        self.logs_dir = logs_dir

        self.arbiter = None
        self.arbiter_thread = None
        self.client = None
        self._running = False

        # Caddy writes logs directly to these files
        self.caddy_server_log = logs_dir / "caddy-server.log"
        self.caddy_access_log = logs_dir / "caddy-access.log"

        # Generate IPC endpoint for secure communication
        self.endpoint = self._generate_ipc_endpoint()

        # Set up worker thread for non-blocking Circus operations
        self.worker_thread = QThread()
        self.worker = DaemonWorker(self)
        self.worker.moveToThread(self.worker_thread)

        # Connect internal signals to worker slots
        self._request_status.connect(self.worker.do_get_status)
        self._request_start.connect(self.worker.do_start_daemon)
        self._request_stop.connect(self.worker.do_stop_daemon)
        self._request_restart.connect(self.worker.do_restart_daemon)

        # Start worker thread
        self.worker_thread.start()
        logger.info("Worker thread started for non-blocking daemon operations")

    def _generate_ipc_endpoint(self) -> str:
        """
        Generate a platform-specific IPC endpoint for Circus.

        Uses Unix domain sockets on Linux/macOS for security.
        Falls back to TCP on Windows (ZeroMQ's ipc:// protocol is not supported on Windows).
        """
        if platform.system() == "Windows":
            # Windows: Use TCP with random port (ZeroMQ doesn't support ipc:// on Windows)
            # Find an available port using SO_REUSEADDR to minimize race conditions
            import socket
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]
            sock.close()
            # Note: Small race condition still exists between close() and Circus bind,
            # but SO_REUSEADDR minimizes the window and allows immediate port reuse
            return f"tcp://127.0.0.1:{port}"
        else:
            # Linux/macOS: Use Unix domain socket for better security
            return f"ipc://{tempfile.gettempdir()}/librocco-circus-{os.getpid()}.sock"

    def _create_caddy_watcher(self) -> dict:
        """Create a Circus watcher configuration for Caddy."""
        # Resolve all paths to absolute paths to handle spaces correctly
        # (macOS paths like "Application Support" have spaces)
        caddy_binary = self.caddy_binary.resolve()
        caddyfile = self.caddyfile.resolve()
        caddy_data_dir = self.caddy_data_dir.resolve()

        # Pass through essential environment variables
        env = {
            "HOME": os.environ.get("HOME", ""),
            "XDG_CONFIG_HOME": os.environ.get("XDG_CONFIG_HOME", ""),
            "XDG_DATA_HOME": os.environ.get("XDG_DATA_HOME", ""),
            "PATH": os.environ.get("PATH", ""),
        }

        # No stream configuration needed - Caddy writes logs directly to files
        # configured in the Caddyfile (works cross-platform)
        return {
            "name": "caddy",
            "cmd": str(caddy_binary),
            "args": ["run", "--config", str(caddyfile), "--adapter", "caddyfile"],
            "working_dir": str(caddy_data_dir),
            "env": env,
            "copy_env": True,  # Copy all environment variables
            "shell": False,  # Don't use shell (important for paths with spaces)
            "use_sockets": False,  # Use standard subprocess
            "autostart": False,  # Don't auto-start, let us control it manually
            "max_retry": 5,
            "graceful_timeout": 10,
            "max_retry_in": 60,  # Max 5 retries in 60 seconds
        }

    def start(self) -> None:
        """Start the supervisor arbiter in a background thread."""
        if self._running:
            return

        logger.info(f"Using IPC endpoint for Circus: {self.endpoint}")

        # Create watchers
        watchers = [self._create_caddy_watcher()]

        # Create arbiter with explicit IPC endpoint for security
        self.arbiter = get_arbiter(
            watchers,
            background=False,
            loglevel="INFO",
            controller=self.endpoint,
        )

        # Start arbiter in a background thread
        self.arbiter_thread = threading.Thread(target=self._run_arbiter, daemon=True)
        self.arbiter_thread.start()
        self._running = True

        # Give it time to initialize watchers
        time.sleep(self.ARBITER_INIT_WAIT_SECONDS)

        # Initialize CircusClient with the same IPC endpoint
        self.client = CircusClient(endpoint=self.endpoint)

    def _run_arbiter(self) -> None:
        """Run the arbiter (called in background thread)."""
        try:
            # Circus/Tornado requires an event loop in the thread
            import asyncio

            asyncio.set_event_loop(asyncio.new_event_loop())
            self.arbiter.start()
        except Exception as exc:
            logger.error("Arbiter failed to start", exc_info=exc)
            self._running = False

    def stop(self) -> None:
        """Stop the supervisor and all managed processes."""
        if not self._running:
            return

        try:
            # Use CircusClient to send commands (proper async way)
            if self.client:
                # First, explicitly stop all watchers to ensure clean shutdown
                logger.info("Stopping all watchers...")
                try:
                    stop_response = self.client.send_message("stop")
                    logger.debug(f"Stop watchers response: {stop_response}")
                except Exception as exc:
                    logger.error("Failed to stop watchers", exc_info=exc)

                # Give watchers time to stop gracefully
                import time

                time.sleep(1)

                # Then quit the arbiter
                logger.info("Sending quit command to Circus...")
                try:
                    quit_response = self.client.send_message("quit")
                    logger.debug(f"Quit response: {quit_response}")
                except Exception as exc:
                    logger.error("Failed to send quit command to Circus", exc_info=exc)

                self.client = None

            # Wait briefly for arbiter thread to finish
            # It's a daemon thread so it will be killed when main process exits
            if self.arbiter_thread:
                logger.info("Waiting for arbiter thread to stop...")
                self.arbiter_thread.join(timeout=2)
                if self.arbiter_thread.is_alive():
                    # This is okay - daemon thread will be killed on exit
                    logger.debug(
                        "Arbiter thread still running (will be terminated on exit)"
                    )

            # Stop worker thread gracefully
            if self.worker_thread and self.worker_thread.isRunning():
                logger.info("Stopping worker thread...")
                self.worker_thread.quit()
                if not self.worker_thread.wait(5000):  # 5 second timeout
                    logger.warning("Worker thread did not stop within timeout")
                else:
                    logger.info("Worker thread stopped successfully")
        finally:
            self._running = False

    def _get_status_sync(self, daemon_name: str = "caddy") -> DaemonStatus:
        """Get status of a daemon using CircusClient (synchronous, blocking)."""
        if not self._running or not self.client:
            return DaemonStatus(daemon_name, "stopped")

        try:
            # Get watcher status
            response = self.client.send_message("status", name=daemon_name)

            # When querying with name parameter, status is in response["status"] field
            # When querying all watchers, statuses are in response["statuses"] dict
            watcher_status = response.get("status", "stopped")

            # If active, get PIDs
            if watcher_status == "active":
                list_response = self.client.send_message("list", name=daemon_name)
                pids = list_response.get("pids", [])
                pid = pids[0] if pids else None
                return DaemonStatus(daemon_name, "active", pid=pid)

            return DaemonStatus(daemon_name, watcher_status)

        except Exception as exc:
            logger.error(f"Failed to get status for {daemon_name}", exc_info=exc)
            return DaemonStatus(daemon_name, "error")

    def _start_daemon_sync(self, daemon_name: str = "caddy") -> bool:
        """Start a specific daemon using CircusClient (synchronous, blocking)."""
        if not self._running:
            self.start()
            # Fall through to actually start the watcher

        try:
            if not self.client:
                logger.error(
                    f"CircusClient not initialized, cannot start {daemon_name}"
                )
                return False

            logger.info(f"Starting daemon: {daemon_name}")
            response = self.client.send_message("start", name=daemon_name)
            success = response.get("status") == "ok"

            if success:
                logger.info(f"Successfully started daemon: {daemon_name}")
            else:
                logger.warning(f"Failed to start daemon {daemon_name}: {response}")

            return success
        except Exception as exc:
            logger.error(f"Failed to start daemon {daemon_name}", exc_info=exc)
            return False

    def _stop_daemon_sync(self, daemon_name: str = "caddy") -> bool:
        """Stop a specific daemon using CircusClient (synchronous, blocking)."""
        if not self._running or not self.client:
            logger.warning(f"Cannot stop {daemon_name}: supervisor not running")
            return False

        try:
            logger.info(f"Stopping daemon: {daemon_name}")
            response = self.client.send_message("stop", name=daemon_name)
            success = response.get("status") == "ok"

            if success:
                logger.info(f"Successfully stopped daemon: {daemon_name}")
            else:
                logger.warning(f"Failed to stop daemon {daemon_name}: {response}")

            return success
        except Exception as exc:
            logger.error(f"Failed to stop daemon {daemon_name}", exc_info=exc)
            return False

    def _restart_daemon_sync(self, daemon_name: str = "caddy") -> bool:
        """Restart a specific daemon using CircusClient (synchronous, blocking)."""
        if not self._running or not self.client:
            logger.warning(f"Cannot restart {daemon_name}: supervisor not running")
            return False

        try:
            logger.info(f"Restarting daemon: {daemon_name}")
            response = self.client.send_message("restart", name=daemon_name)
            success = response.get("status") == "ok"

            if success:
                logger.info(f"Successfully restarted daemon: {daemon_name}")
            else:
                logger.warning(f"Failed to restart daemon {daemon_name}: {response}")

            return success
        except Exception as exc:
            logger.error(f"Failed to restart daemon {daemon_name}", exc_info=exc)
            return False

    # Async wrapper methods (non-blocking, use worker thread)

    def get_status(self, daemon_name: str = "caddy") -> DaemonWorker:
        """
        Get status of a daemon asynchronously (non-blocking).

        Connect to worker.status_ready signal to receive result:
            worker = manager.get_status("caddy")
            worker.status_ready.connect(lambda status: handle_status(status))

        Returns:
            DaemonWorker instance - connect to its status_ready signal
        """
        self._request_status.emit(daemon_name)
        return self.worker

    def start_daemon(self, daemon_name: str = "caddy") -> DaemonWorker:
        """
        Start a daemon asynchronously (non-blocking).

        Connect to worker.operation_complete signal to receive result:
            worker = manager.start_daemon("caddy")
            worker.operation_complete.connect(lambda op, success: handle_result(op, success))

        Returns:
            DaemonWorker instance - connect to its operation_complete signal
        """
        self._request_start.emit(daemon_name)
        return self.worker

    def stop_daemon(self, daemon_name: str = "caddy") -> DaemonWorker:
        """
        Stop a daemon asynchronously (non-blocking).

        Connect to worker.operation_complete signal to receive result:
            worker = manager.stop_daemon("caddy")
            worker.operation_complete.connect(lambda op, success: handle_result(op, success))

        Returns:
            DaemonWorker instance - connect to its operation_complete signal
        """
        self._request_stop.emit(daemon_name)
        return self.worker

    def restart_daemon(self, daemon_name: str = "caddy") -> DaemonWorker:
        """
        Restart a daemon asynchronously (non-blocking).

        Connect to worker.operation_complete signal to receive result:
            worker = manager.restart_daemon("caddy")
            worker.operation_complete.connect(lambda op, success: handle_result(op, success))

        Returns:
            DaemonWorker instance - connect to its operation_complete signal
        """
        self._request_restart.emit(daemon_name)
        return self.worker

    def get_logs(self, daemon_name: str = "caddy", lines: int = 100) -> tuple[str, str]:
        """
        Get recent log lines for a daemon without loading entire file into memory.
        Returns: (server_logs, access_logs)
        """
        server_logs = ""
        access_logs = ""

        try:
            if self.caddy_server_log.exists():
                server_logs = self._read_last_lines(self.caddy_server_log, lines)

            if self.caddy_access_log.exists():
                access_logs = self._read_last_lines(self.caddy_access_log, lines)

        except Exception as exc:
            logger.error(f"Failed to read logs for {daemon_name}", exc_info=exc)

        return server_logs, access_logs

    def _read_last_lines(self, file_path: Path, lines: int) -> str:
        """
        Read last N lines from a file efficiently without loading entire file.

        Uses collections.deque for memory-efficient tail operation.
        """
        from collections import deque

        try:
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                # deque with maxlen automatically discards old items
                last_lines = deque(f, maxlen=lines)
                return "".join(last_lines)
        except Exception as exc:
            logger.error(f"Failed to read file {file_path}", exc_info=exc)
            return ""
