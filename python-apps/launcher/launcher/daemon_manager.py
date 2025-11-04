"""
Daemon management using Circus as an embedded supervisor.
"""
import threading
import time
from pathlib import Path
from typing import Dict, Optional
from circus import get_arbiter
from circus.client import CircusClient


class DaemonStatus:
    """Daemon status information."""

    def __init__(self, name: str, status: str, pid: Optional[int] = None, uptime: Optional[float] = None):
        self.name = name
        self.status = status  # "active", "stopped", "starting", "error"
        self.pid = pid
        self.uptime = uptime


class EmbeddedSupervisor:
    """Embedded Circus-based process supervisor."""

    def __init__(self, caddy_binary: Path, caddyfile: Path, caddy_data_dir: Path, logs_dir: Path):
        self.caddy_binary = caddy_binary
        self.caddyfile = caddyfile
        self.caddy_data_dir = caddy_data_dir
        self.logs_dir = logs_dir

        self.arbiter = None
        self.arbiter_thread = None
        self.client = None
        self._running = False

        # Create log files if they don't exist
        self.caddy_stdout_log = logs_dir / "caddy-stdout.log"
        self.caddy_stderr_log = logs_dir / "caddy-stderr.log"

    def _create_caddy_watcher(self) -> dict:
        """Create a Circus watcher configuration for Caddy."""
        import os

        # Pass through essential environment variables
        env = {
            "HOME": os.environ.get("HOME", ""),
            "XDG_CONFIG_HOME": os.environ.get("XDG_CONFIG_HOME", ""),
            "XDG_DATA_HOME": os.environ.get("XDG_DATA_HOME", ""),
            "PATH": os.environ.get("PATH", ""),
        }

        return {
            "name": "caddy",
            "cmd": str(self.caddy_binary),
            "args": ["run", "--config", str(self.caddyfile), "--adapter", "caddyfile"],
            "working_dir": str(self.caddy_data_dir),
            "env": env,
            "copy_env": True,  # Copy all environment variables
            "autostart": False,  # Don't auto-start, let us control it manually
            "stdout_stream": {
                "class": "FileStream",
                "filename": str(self.caddy_stdout_log),
            },
            "stderr_stream": {
                "class": "FileStream",
                "filename": str(self.caddy_stderr_log),
            },
            "max_retry": 5,
            "graceful_timeout": 10,
            "max_retry_in": 60,  # Max 5 retries in 60 seconds
        }

    def start(self) -> None:
        """Start the supervisor arbiter in a background thread."""
        if self._running:
            return

        # Create watchers
        watchers = [self._create_caddy_watcher()]

        # Create arbiter
        self.arbiter = get_arbiter(
            watchers,
            background=False,
            loglevel="INFO",
        )

        # Start arbiter in a background thread
        self.arbiter_thread = threading.Thread(target=self._run_arbiter, daemon=True)
        self.arbiter_thread.start()
        self._running = True

        # Give it time to initialize watchers
        time.sleep(2)

        # Initialize CircusClient to control the arbiter
        # Use the arbiter's endpoint or default
        endpoint = getattr(self.arbiter, 'ctrl', None)
        if endpoint and hasattr(endpoint, 'endpoint'):
            self.client = CircusClient(endpoint=endpoint.endpoint)
        else:
            # Use default endpoint
            self.client = CircusClient()

    def _run_arbiter(self) -> None:
        """Run the arbiter (called in background thread)."""
        try:
            # Circus/Tornado requires an event loop in the thread
            import asyncio
            asyncio.set_event_loop(asyncio.new_event_loop())
            self.arbiter.start()
        except Exception as e:
            print(f"Arbiter error: {e}")
            self._running = False

    def stop(self) -> None:
        """Stop the supervisor and all managed processes."""
        if not self._running:
            return

        try:
            # Use CircusClient to send commands (proper async way)
            if self.client:
                # First, explicitly stop all watchers to ensure clean shutdown
                print("Stopping all watchers...")
                try:
                    stop_response = self.client.send_message("stop")
                    print(f"Stop watchers response: {stop_response}")
                except Exception as e:
                    print(f"Error stopping watchers: {e}")

                # Give watchers time to stop gracefully
                import time
                time.sleep(1)

                # Then quit the arbiter
                print("Sending quit command to Circus...")
                try:
                    quit_response = self.client.send_message("quit")
                    print(f"Quit response: {quit_response}")
                except Exception as e:
                    print(f"Error sending quit command: {e}")

                self.client = None

            # Wait briefly for arbiter thread to finish
            # It's a daemon thread so it will be killed when main process exits
            if self.arbiter_thread:
                print("Waiting for arbiter thread to stop...")
                self.arbiter_thread.join(timeout=2)
                if self.arbiter_thread.is_alive():
                    # This is okay - daemon thread will be killed on exit
                    print("Arbiter thread still running (will be terminated on exit)")
        finally:
            self._running = False

    def get_status(self, daemon_name: str = "caddy") -> DaemonStatus:
        """Get status of a daemon using CircusClient."""
        # TODO: Move to background thread to avoid blocking Qt event loop
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

        except Exception as e:
            print(f"Error getting status: {e}")
            import traceback
            traceback.print_exc()
            return DaemonStatus(daemon_name, "error")

    def start_daemon(self, daemon_name: str = "caddy") -> bool:
        """Start a specific daemon using CircusClient."""
        # TODO: Move to background thread to avoid blocking Qt event loop
        if not self._running:
            self.start()
            # Fall through to actually start the watcher

        try:
            if not self.client:
                print(f"CircusClient not initialized")
                return False

            response = self.client.send_message("start", name=daemon_name)
            return response.get("status") == "ok"
        except Exception as e:
            print(f"Error starting daemon {daemon_name}: {e}")
            import traceback
            traceback.print_exc()
            return False

    def stop_daemon(self, daemon_name: str = "caddy") -> bool:
        """Stop a specific daemon using CircusClient."""
        # TODO: Move to background thread to avoid blocking Qt event loop
        if not self._running or not self.client:
            return False

        try:
            response = self.client.send_message("stop", name=daemon_name)
            return response.get("status") == "ok"
        except Exception as e:
            print(f"Error stopping daemon {daemon_name}: {e}")
            import traceback
            traceback.print_exc()
            return False

    def restart_daemon(self, daemon_name: str = "caddy") -> bool:
        """Restart a specific daemon using CircusClient."""
        # TODO: Move to background thread to avoid blocking Qt event loop
        if not self._running or not self.client:
            return False

        try:
            response = self.client.send_message("restart", name=daemon_name)
            return response.get("status") == "ok"
        except Exception as e:
            print(f"Error restarting daemon {daemon_name}: {e}")
            import traceback
            traceback.print_exc()
            return False

    def get_logs(self, daemon_name: str = "caddy", lines: int = 100) -> tuple[str, str]:
        """
        Get recent log lines for a daemon.
        Returns: (stdout_lines, stderr_lines)
        """
        stdout_lines = ""
        stderr_lines = ""

        try:
            if self.caddy_stdout_log.exists():
                with open(self.caddy_stdout_log, "r") as f:
                    all_lines = f.readlines()
                    stdout_lines = "".join(all_lines[-lines:])

            if self.caddy_stderr_log.exists():
                with open(self.caddy_stderr_log, "r") as f:
                    all_lines = f.readlines()
                    stderr_lines = "".join(all_lines[-lines:])

        except Exception as e:
            print(f"Error reading logs: {e}")

        return stdout_lines, stderr_lines
