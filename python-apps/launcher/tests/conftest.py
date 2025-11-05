"""Pytest configuration and fixtures for launcher tests."""

import tempfile
from pathlib import Path
import pytest


@pytest.fixture
def temp_data_dir():
    """Provide a temporary directory for test data."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def mock_config(temp_data_dir, monkeypatch):
    """Provide a mock Config instance with temporary directories."""
    from launcher.config import Config

    # Create a Config instance
    config = Config()

    # Override directories to use temp directory
    config.data_dir = temp_data_dir
    config.config_dir = temp_data_dir / "config"
    config.binaries_dir = temp_data_dir / "binaries"
    config.caddy_data_dir = temp_data_dir / "caddy-data"
    config.caddy_config_dir = temp_data_dir / "caddy-config"
    config.logs_dir = temp_data_dir / "logs"

    # Create the directories
    config.initialize()

    return config


@pytest.fixture
def simple_caddyfile(temp_data_dir):
    """Create a minimal Caddyfile for testing."""
    caddyfile_path = temp_data_dir / "Caddyfile"
    caddyfile_content = """
{
    # Global options
    admin off
}

:8080 {
    respond "Hello from test Caddy" 200
}
"""
    caddyfile_path.write_text(caddyfile_content)
    return caddyfile_path
