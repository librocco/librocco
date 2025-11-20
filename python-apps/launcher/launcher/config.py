"""
Configuration and directory management using platformdirs.
"""

import tomllib
import tomli_w
from pathlib import Path
from typing import Dict, Any
from platformdirs import user_data_dir, user_config_dir
import platform

# Server ports (hardcoded, not user-configurable)
CADDY_PORT = 8080
SYNC_SERVER_PORT = 3000


def get_binary_name(base_name: str) -> str:
    """
    Get platform-specific binary name.

    Args:
        base_name: Base name of the binary (e.g., 'caddy')

    Returns:
        Platform-specific binary name (adds .exe on Windows)
    """
    return f"{base_name}.exe" if platform.system() == "Windows" else base_name


class Config:
    """Manages application directories and settings."""

    APP_NAME = "librocco"
    APP_AUTHOR = "librocco"

    def __init__(self):
        # Setup directory paths
        # NOTE: On macOS, we use ~/.librocco/ instead of the standard
        # ~/Library/Application Support/librocco/ to avoid spaces in paths.
        # While daemon_manager.py properly handles spaces (shell=False, resolved paths),
        # this workaround provides extra safety and matches Unix conventions.
        # TODO: Test removing this workaround on macOS to use standard platformdirs paths
        import platform

        if platform.system() == "Darwin":
            home = Path.home()
            self.data_dir = home / f".{self.APP_NAME}"
            self.config_dir = home / f".{self.APP_NAME}" / "config"
        else:
            self.data_dir = Path(user_data_dir(self.APP_NAME, self.APP_AUTHOR))
            self.config_dir = Path(user_config_dir(self.APP_NAME, self.APP_AUTHOR))

        # Sub-directories in data dir
        self.binaries_dir = self.data_dir / "binaries"
        self.caddy_data_dir = self.data_dir / "caddy-data"
        self.caddy_config_dir = self.data_dir / "caddy-config"
        self.logs_dir = self.data_dir / "logs"
        self.db_dir = self.data_dir / "db"  # Database directory for sync server

        # Settings file
        self.settings_file = self.config_dir / "settings.toml"

        # Default settings
        self._default_settings = {
            "auto_start_caddy": True,
            "auto_start_sync_server": True,
        }

        self._settings: Dict[str, Any] = {}

    def initialize(self) -> None:
        """Create all required directories and default config files."""
        # Create directories
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.config_dir.mkdir(parents=True, exist_ok=True)
        self.binaries_dir.mkdir(parents=True, exist_ok=True)
        self.caddy_data_dir.mkdir(parents=True, exist_ok=True)
        self.caddy_config_dir.mkdir(parents=True, exist_ok=True)
        self.logs_dir.mkdir(parents=True, exist_ok=True)
        self.db_dir.mkdir(parents=True, exist_ok=True)

        # Load or create settings
        if self.settings_file.exists():
            self.load_settings()
        else:
            self._settings = self._default_settings.copy()
            self.save_settings()

    def load_settings(self) -> None:
        """Load settings from TOML file."""
        with open(self.settings_file, "rb") as f:
            self._settings = tomllib.load(f)

    def save_settings(self) -> None:
        """Save settings to TOML file."""
        with open(self.settings_file, "wb") as f:
            tomli_w.dump(self._settings, f)

    def get(self, key: str, default: Any = None) -> Any:
        """Get a setting value."""
        return self._settings.get(key, default)

    def set(self, key: str, value: Any) -> None:
        """Set a setting value and save."""
        self._settings[key] = value
        self.save_settings()

    def ensure_caddyfile(self, app_dir: Path) -> None:
        """Generate the Caddyfile, overwriting any existing configuration.

        The Caddyfile is a system-managed file that should be regenerated on each
        startup to ensure it stays in sync with the launcher's requirements.
        """
        caddyfile_path = self.caddy_config_dir / "Caddyfile"
        # Always regenerate to ensure config stays up to date
        if True:  # Changed from: if not caddyfile_path.exists()
            server_log = self.logs_dir / "caddy-server.log"
            access_log = self.logs_dir / "caddy-access.log"

            # Generate certificates on-demand for any hostname
            # This allows access via localhost, mDNS (hostname.local), Tailscale, or any IP
            default_caddyfile = f"""{{
    # Disable automatic HTTP->HTTPS redirects (requires port 80 / root privileges)
    auto_https disable_redirects

    # Use custom data directory for certificates and PKI
    storage file_system {{
        root {self.caddy_data_dir}
    }}

    # Configure PKI with custom CA name
    pki {{
        ca local {{
            name "Librocco CA"
        }}
    }}

    # Skip automatic root certificate installation (requires sudo)
    skip_install_trust

    # Global logging for server logs (startup, errors, admin API)
    log {{
        output file {server_log} {{
            roll_size 10mb
            roll_keep 10
            roll_keep_for 720h
        }}
        format json
        level INFO
    }}
}}

https://:{CADDY_PORT} {{
    # Use Caddy's internal CA for on-demand certificate generation
    # This automatically issues certificates for any hostname that connects (SNI-based)
    tls internal {{
        on_demand
    }}

    # Proxy sync WebSocket requests to the sync server
    handle /sync* {{
        reverse_proxy localhost:3000
    }}

    # Proxy database RPC endpoints to the sync server (for testing/dev)
    handle /*.db/* {{
        reverse_proxy localhost:3000
    }}

    # Serve the app directory for all other requests
    handle {{
        root * {app_dir}
        file_server browse
    }}

    # Access logs (HTTP requests)
    log {{
        output file {access_log} {{
            roll_size 10mb
            roll_keep 10
            roll_keep_for 720h
        }}
        format json
    }}
}}
"""
            caddyfile_path.write_text(default_caddyfile)

    @property
    def caddy_binary_path(self) -> Path:
        """Get the path to the Caddy binary."""
        return self.binaries_dir / get_binary_name("caddy")

    @property
    def caddyfile_path(self) -> Path:
        """Get the path to the Caddyfile."""
        return self.caddy_config_dir / "Caddyfile"

    @property
    def node_binary_path(self) -> Path:
        """Get the path to the Node binary."""
        return self.binaries_dir / get_binary_name("node")

    @property
    def syncserver_script_path(self) -> Path:
        """Get the path to the sync server script."""
        return self.binaries_dir / "syncserver" / "syncserver.mjs"

    @property
    def syncserver_dir_path(self) -> Path:
        """Get the path to the sync server directory."""
        return self.binaries_dir / "syncserver"

    def get_web_url(self) -> str:
        """
        Get the URL for accessing the web application.

        Always returns HTTPS URL with auto-detected hostname.
        """
        from .network_utils import get_local_hostname

        hostname = get_local_hostname()
        return f"https://{hostname}:{CADDY_PORT}"
