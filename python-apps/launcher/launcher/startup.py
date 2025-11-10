"""
Common launcher startup logic shared between GUI and headless modes.
"""
import sys
import logging
import time
import ssl
import urllib.request
from pathlib import Path
from typing import Optional, Tuple

from launcher.config import Config
from launcher.binary_manager import BinaryManager
from launcher.daemon_manager import EmbeddedSupervisor
from launcher.logging_config import setup_logging as _setup_file_logging
from launcher.i18n import setup_i18n, _
from launcher.network_utils import (
    get_caddy_root_ca_path,
    check_ca_installed,
)

logger = None


def initialize_i18n() -> None:
    """Initialize internationalization."""
    setup_i18n()


def setup_logging_for_mode(logs_dir: Optional[Path] = None, level: int = logging.INFO, to_file: bool = True):
    """
    Setup logging for either GUI (file) or headless (stdout) mode.

    Args:
        logs_dir: Directory for log files (required if to_file=True)
        level: Logging level
        to_file: If True, log to files in logs_dir. If False, log to stdout/stderr

    Returns:
        Configured logger instance
    """
    global logger

    if to_file:
        if not logs_dir:
            raise ValueError("logs_dir required when to_file=True")
        logger = _setup_file_logging(logs_dir, level)
    else:
        # Headless mode: log to stdout with simple format
        logging.basicConfig(
            level=level,
            format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S',
            stream=sys.stdout
        )
        logger = logging.getLogger("launcher")

    return logger


def initialize_config(app_dir: Optional[Path] = None) -> Config:
    """
    Initialize configuration.

    Args:
        app_dir: Path to app directory (defaults to sibling of main.py)

    Returns:
        Initialized Config object
    """
    if not app_dir:
        # Default to sibling of main.py
        app_dir = Path(__file__).parent.parent / "app"

    config = Config()
    config.initialize()
    config.ensure_caddyfile(app_dir)

    return config


def download_binaries(config: Config) -> Tuple[Optional[Path], Optional[Path]]:
    """
    Ensure required binaries (Caddy, Node.js) are downloaded and available.

    Args:
        config: Config object with binary paths

    Returns:
        Tuple of (caddy_binary_path, node_binary_path)

    Raises:
        RuntimeError: If Caddy binary download fails (fatal)
    """
    # Ensure Caddy binary exists (fatal if missing)
    caddy_manager = BinaryManager(config.caddy_binary_path)
    if not caddy_manager.ensure_binary():
        raise RuntimeError(
            _("Failed to download or verify Caddy binary. "
              "Please check your internet connection and try again.")
        )
    caddy_binary_path = caddy_manager.binary_path
    logger.info(f"Caddy binary ready at {caddy_binary_path}")

    # Ensure Node.js binary is available (non-fatal)
    node_binary_path = None
    node_manager = BinaryManager(config.node_binary_path, binary_type="node")
    if node_manager.ensure_binary():
        node_binary_path = node_manager.binary_path
        logger.info(f"Node.js binary ready at {node_binary_path}")
    else:
        logger.warning("Node.js binary is not available. Node-powered features will be disabled.")

    return caddy_binary_path, node_binary_path


def create_daemon_manager(
    config: Config,
    caddy_binary_path: Path,
    gui_mode: bool = True
) -> EmbeddedSupervisor:
    """
    Create and initialize the daemon manager.

    Args:
        config: Config object
        caddy_binary_path: Path to Caddy binary
        gui_mode: If True, enable Qt threading for async operations. If False, headless mode.

    Returns:
        Initialized EmbeddedSupervisor instance
    """
    logger.info("Initializing daemon manager...")

    daemon_manager = EmbeddedSupervisor(
        caddy_binary=caddy_binary_path,
        caddyfile=config.caddyfile_path,
        caddy_data_dir=config.caddy_data_dir,
        logs_dir=config.logs_dir,
        node_binary=config.node_binary_path,
        syncserver_script=config.syncserver_script_path,
        syncserver_dir=config.syncserver_dir_path,
        db_dir=config.db_dir,
        gui_mode=gui_mode,
    )

    # Start daemon manager (starts Circus arbiter)
    daemon_manager.start()
    logger.info("Daemon manager started successfully")

    return daemon_manager


def auto_start_daemons(daemon_manager: EmbeddedSupervisor, config: Config) -> None:
    """
    Auto-start configured daemons.

    Args:
        daemon_manager: EmbeddedSupervisor instance
        config: Config object for checking auto-start settings
    """
    from circus import exc as circus_exc

    # Auto-start Caddy if configured
    if config.get("auto_start_caddy", True):
        try:
            logger.info("Auto-starting Caddy...")
            if daemon_manager._start_daemon_sync("caddy"):
                logger.info("Caddy auto-started successfully")
            else:
                logger.warning("Failed to auto-start Caddy")
        except (RuntimeError, OSError, circus_exc.CallError, circus_exc.MessageError) as e:
            logger.error("Exception during Caddy auto-start", exc_info=e)

    # Auto-start sync server
    try:
        logger.info("Auto-starting sync server...")
        if daemon_manager._start_daemon_sync("syncserver"):
            logger.info("Sync server auto-started successfully")
        else:
            logger.warning("Failed to auto-start sync server")
    except (RuntimeError, OSError, circus_exc.CallError, circus_exc.MessageError) as e:
        logger.error("Exception during sync server auto-start", exc_info=e)


def setup_ca_certificate(config: Config) -> None:
    """
    Check if Caddy's CA certificate needs to be installed and show info.

    This should be called after Caddy has started at least once, so the CA
    certificate has been generated.

    Args:
        config: Config object with Caddy paths
    """
    ca_path = get_caddy_root_ca_path(config.caddy_data_dir)

    # Caddy generates its internal CA certificate lazily - only when it needs to
    # issue a certificate for an HTTPS request. We need to make a request to trigger this.
    if not ca_path.exists():
        # Wait a bit for Caddy to fully start up before making the request
        logger.info("Waiting for Caddy to fully start before triggering CA generation...")
        time.sleep(2)

        logger.info("Triggering Caddy CA certificate generation with HTTPS request...")
        try:
            # Create SSL context that accepts self-signed certificates
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE

            # Make request to trigger CA certificate generation
            url = config.get_web_url()
            req = urllib.request.Request(url, method='HEAD')
            with urllib.request.urlopen(req, context=ssl_context, timeout=10) as response:
                logger.info(f"Made request to {url}, status: {response.status}")
        except Exception as e:
            logger.debug(f"Request to trigger CA generation: {e}")
            # This is expected - Caddy may still be starting or the request may fail
            # The important thing is that the request was attempted

        # Now wait for CA certificate to be created
        max_wait = 3  # seconds
        poll_interval = 0.1  # seconds
        waited = 0
        while not ca_path.exists() and waited < max_wait:
            time.sleep(poll_interval)
            waited += poll_interval

    if not ca_path.exists():
        logger.warning("Caddy CA certificate not found yet. It will be created on first HTTPS request.")
        return

    # Check if already installed
    if check_ca_installed(ca_path):
        logger.info("Caddy CA certificate is already installed in system trust store")
        return

    # Just inform the user about the certificate
    logger.info("Caddy CA certificate available for installation")
