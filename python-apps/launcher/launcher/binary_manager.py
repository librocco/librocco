"""
Binary download and management for Caddy.
"""
import platform
import tarfile
import zipfile
import tempfile
import subprocess
import stat
from pathlib import Path
from typing import Optional, Tuple
import requests


class BinaryManager:
    """Manages downloading and updating Caddy binary."""

    CADDY_VERSION = "2.10.2"
    CADDY_RELEASE_BASE = "https://github.com/caddyserver/caddy/releases/download"

    def __init__(self, binary_path: Path):
        self.binary_path = binary_path

    def get_download_url(self) -> Tuple[str, str]:
        """
        Get the download URL for the current OS and architecture.
        Returns: (url, file_extension) tuple
        """
        system = platform.system()
        machine = platform.machine().lower()

        # Normalize architecture names
        if machine in ("x86_64", "amd64"):
            arch = "amd64"
        elif machine in ("aarch64", "arm64"):
            arch = "arm64"
        else:
            raise ValueError(f"Unsupported architecture: {machine}")

        # Build platform-specific URL
        if system == "Linux":
            filename = f"caddy_{self.CADDY_VERSION}_linux_{arch}.tar.gz"
            ext = "tar.gz"
        elif system == "Darwin":
            filename = f"caddy_{self.CADDY_VERSION}_mac_{arch}.tar.gz"
            ext = "tar.gz"
        elif system == "Windows":
            filename = f"caddy_{self.CADDY_VERSION}_windows_{arch}.zip"
            ext = "zip"
        else:
            raise ValueError(f"Unsupported operating system: {system}")

        url = f"{self.CADDY_RELEASE_BASE}/v{self.CADDY_VERSION}/{filename}"
        return url, ext

    def download_and_extract(self, progress_callback: Optional[callable] = None) -> None:
        """
        Download Caddy binary for current OS and extract it.

        Args:
            progress_callback: Optional callback function(downloaded_bytes, total_bytes)
        """
        url, ext = self.get_download_url()

        # Download to temporary file
        with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp_file:
            tmp_path = Path(tmp_file.name)

            try:
                print(f"Downloading Caddy from {url}...")
                response = requests.get(url, stream=True)
                response.raise_for_status()

                total_size = int(response.headers.get("content-length", 0))
                downloaded = 0

                for chunk in response.iter_content(chunk_size=8192):
                    tmp_file.write(chunk)
                    downloaded += len(chunk)
                    if progress_callback:
                        progress_callback(downloaded, total_size)

                tmp_file.flush()

                # Extract the binary
                self._extract_binary(tmp_path, ext)
                print(f"Caddy binary extracted to {self.binary_path}")

            finally:
                # Clean up temporary file
                tmp_path.unlink(missing_ok=True)

    def _extract_binary(self, archive_path: Path, ext: str) -> None:
        """Extract the caddy binary from the archive."""
        binary_name = "caddy.exe" if platform.system() == "Windows" else "caddy"

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_dir_path = Path(tmp_dir)

            # Extract archive
            if ext == "tar.gz":
                with tarfile.open(archive_path, "r:gz") as tar:
                    tar.extractall(tmp_dir_path)
            elif ext == "zip":
                with zipfile.ZipFile(archive_path, "r") as zip_file:
                    zip_file.extractall(tmp_dir_path)
            else:
                raise ValueError(f"Unsupported archive format: {ext}")

            # Find and copy the binary (ignore .sbom, .pem, .sig, LICENSE, README)
            extracted_binary = tmp_dir_path / binary_name
            if not extracted_binary.exists():
                raise FileNotFoundError(
                    f"Binary {binary_name} not found in archive"
                )

            # Ensure parent directory exists
            self.binary_path.parent.mkdir(parents=True, exist_ok=True)

            # Copy binary to final location
            import shutil
            shutil.copy2(extracted_binary, self.binary_path)

            # Make executable on Unix systems
            if platform.system() != "Windows":
                self.binary_path.chmod(
                    self.binary_path.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH
                )

                # On macOS, remove quarantine attribute to bypass Gatekeeper
                # This is necessary for downloaded binaries to run via subprocess
                if platform.system() == "Darwin":
                    try:
                        subprocess.run(
                            ["xattr", "-d", "com.apple.quarantine", str(self.binary_path)],
                            capture_output=True,
                            check=False,  # Don't fail if attribute doesn't exist
                        )
                    except Exception:
                        pass  # Ignore errors, attribute may not exist

    def verify_binary(self) -> bool:
        """
        Verify the binary works by running 'caddy version'.
        Returns True if successful, False otherwise.
        """
        if not self.binary_path.exists():
            return False

        try:
            result = subprocess.run(
                [str(self.binary_path), "version"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            return result.returncode == 0
        except (subprocess.TimeoutExpired, FileNotFoundError):
            return False

    def ensure_binary(self) -> bool:
        """
        Ensure binary exists and is functional. Download if needed.
        Returns True if binary is ready, False if download failed.
        """
        if self.verify_binary():
            print(f"Caddy binary already exists at {self.binary_path}")
            return True

        try:
            self.download_and_extract()
            return self.verify_binary()
        except Exception as e:
            print(f"Failed to download Caddy: {e}")
            return False
