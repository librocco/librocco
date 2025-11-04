"""
Configuration and directory management using platformdirs.
"""
import tomllib
import tomli_w
from pathlib import Path
from typing import Dict, Any
from platformdirs import user_data_dir, user_config_dir


class Config:
    """Manages application directories and settings."""

    APP_NAME = "librocco-launcher"
    APP_AUTHOR = "librocco"

    def __init__(self):
        # Setup directory paths
        self.data_dir = Path(user_data_dir(self.APP_NAME, self.APP_AUTHOR))
        self.config_dir = Path(user_config_dir(self.APP_NAME, self.APP_AUTHOR))

        # Sub-directories in data dir
        self.binaries_dir = self.data_dir / "binaries"
        self.caddy_data_dir = self.data_dir / "caddy-data"
        self.caddy_config_dir = self.data_dir / "caddy-config"
        self.logs_dir = self.data_dir / "logs"

        # Settings file
        self.settings_file = self.config_dir / "settings.toml"

        # Default settings
        self._default_settings = {
            "auto_start_caddy": True,
            "caddy_port": 8080,
            "caddy_host": "localhost",
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
        """Create a default Caddyfile if it doesn't exist."""
        caddyfile_path = self.caddy_config_dir / "Caddyfile"
        if not caddyfile_path.exists():
            port = self.get("caddy_port", 8080)
            host = self.get("caddy_host", "localhost")

            default_caddyfile = f"""{{
    # Disable automatic HTTPS
    auto_https off
}}

http://{host}:{port} {{
    # Serve the app directory
    root * {app_dir}
    file_server browse
}}
"""
            caddyfile_path.write_text(default_caddyfile)

    @property
    def caddy_binary_path(self) -> Path:
        """Get the path to the Caddy binary."""
        import platform
        binary_name = "caddy.exe" if platform.system() == "Windows" else "caddy"
        return self.binaries_dir / binary_name

    @property
    def caddyfile_path(self) -> Path:
        """Get the path to the Caddyfile."""
        return self.caddy_config_dir / "Caddyfile"
