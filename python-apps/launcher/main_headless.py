#!/usr/bin/env -S uv run
"""
Librocco Headless Launcher - Terminal-only entry point for CI and development.

No GUI, no system tray. Runs daemons in foreground with logs to stdout.
Graceful shutdown on SIGINT/SIGTERM.
"""
import sys
import signal
import logging
from pathlib import Path

from launcher.startup import (
    initialize_i18n,
    setup_logging_for_mode,
    initialize_config,
    download_binaries,
    create_daemon_manager,
    auto_start_daemons,
)

# Logger will be initialized in main() after config is loaded
logger = None


def main():
    """Main entry point for headless launcher."""
    global logger

    # Initialize i18n (even though we won't translate console output)
    initialize_i18n()

    # Determine app directory (sibling of main_headless.py)
    app_dir = Path(__file__).parent / "app"

    # Initialize configuration
    try:
        config = initialize_config(app_dir)

        # Setup logging to stdout (headless mode)
        logger = setup_logging_for_mode(None, logging.INFO, to_file=False)
        logger.info("=" * 60)
        logger.info("Librocco Headless Launcher starting")
        logger.info(f"Data directory: {config.data_dir}")
        logger.info(f"Config directory: {config.config_dir}")
        logger.info(f"Logs directory: {config.logs_dir}")
        logger.info(f"App directory: {app_dir}")

    except (OSError, PermissionError, ValueError, FileNotFoundError) as e:
        print(f"ERROR: Failed to initialize configuration: {e}", file=sys.stderr)
        return 1

    # Download required binaries
    try:
        caddy_binary_path, node_binary_path = download_binaries(config)
    except RuntimeError as e:
        logger.error(f"Failed to download binaries: {e}")
        return 1

    # Create daemon manager (headless mode)
    daemon_manager = None
    try:
        daemon_manager = create_daemon_manager(config, caddy_binary_path, gui_mode=False)
    except (RuntimeError, OSError, ValueError) as e:
        logger.error("Failed to initialize daemon manager", exc_info=e)
        return 1

    # Setup signal handlers for graceful shutdown
    def signal_handler(signum, frame):
        """Handle SIGINT and SIGTERM for graceful shutdown."""
        sig_name = signal.Signals(signum).name
        logger.info(f"Received {sig_name}, shutting down gracefully...")
        if daemon_manager:
            daemon_manager.stop()
        logger.info("Librocco Headless Launcher stopped")
        logger.info("=" * 60)
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # Auto-start daemons
    auto_start_daemons(daemon_manager, config)

    # Print ready message
    logger.info("Librocco Headless Launcher is ready")
    logger.info("Services running:")
    logger.info("  - Sync Server: http://127.0.0.1:3000")
    if config.get("auto_start_caddy", True):
        logger.info(f"  - Web Server (Caddy): {config.get_web_url()}")
    logger.info("Press Ctrl+C to stop")
    sys.stdout.flush()

    try:
        # Block forever (or until signal)
        # On Unix, signal.pause() is more efficient than a sleep loop
        # On Windows, we'll use an infinite loop with short sleeps
        if hasattr(signal, 'pause'):
            signal.pause()  # Unix only
        else:
            # Windows: poll in a loop
            import time
            while True:
                time.sleep(1)
    except KeyboardInterrupt:
        # This shouldn't normally be reached (signal handler should catch it)
        # But handle it just in case
        logger.info("Interrupted, shutting down...")
        if daemon_manager:
            daemon_manager.stop()

    logger.info("Librocco Headless Launcher exiting")
    logger.info("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
