"""
Binary download and management for Caddy.
"""

import hashlib
import logging
import platform
import tarfile
import zipfile
import tempfile
import subprocess
import stat
from pathlib import Path
from typing import Optional, Tuple
import requests
from launcher.config import get_binary_name

logger = logging.getLogger("launcher")


class BinaryManager:
    """Manages downloading and updating Caddy binary."""

    CADDY_VERSION = "2.10.2"
    CADDY_RELEASE_BASE = "https://github.com/caddyserver/caddy/releases/download"

    # SHA-512 checksums for Caddy 2.10.2 from official release
    # Source: https://github.com/caddyserver/caddy/releases/download/v2.10.2/caddy_2.10.2_checksums.txt
    CADDY_CHECKSUMS = {
        "linux_amd64": "747df7ee74de188485157a383633a1a963fd9233b71fbb4a69ddcbcc589ce4e2cc82dacf5dbbe136cb51d17e14c59daeb5d9bc92487610b0f3b93680b2646546",
        "linux_arm64": "6ce061a690312ab38367df3c5d5f89a2e4a263e7300d300d87356211bb81e79b15933e6d6203e03fbf26f15cc0311f264805f336147dbdd24938d84b57a4421c",
        "mac_amd64": "d6077f7a35663b1b0436a45341e96828bb8025221b777417c781c30c56931e45209b0e5468cd6eb8ec881728c20f142a4333a878c82a10b49913384cffaf541d",
        "mac_arm64": "3b8a4b24054bddd96cae8da5c34e48c19105be29859d6f09e37344b7e188881cfd6b0a91af3f3e8f1d10987153e6bad70d1752c967e1360cc0041fc7736076ec",
        "windows_amd64": "88347875f0cd4b5e26bb39cd1f359613f932d54158d560e03244004d1ba6e61aae0cd625ba7c913bd46df096ef973fef2249396b0bb81143414378cb4447aeb8",
        "windows_arm64": "51e5e0d4f159222a4d0b70a43fbb009fefa4050a4fa269894768bbb7d147ed81e3f14449f87b843f8c4147dda1dabe24e67b34863ee666c6692b9008f9517396",
    }

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

    def _get_platform_key(self) -> str:
        """Get the platform key for checksum lookup."""
        system = platform.system()
        machine = platform.machine().lower()

        # Normalize architecture
        if machine in ("x86_64", "amd64"):
            arch = "amd64"
        elif machine in ("aarch64", "arm64"):
            arch = "arm64"
        else:
            raise ValueError(f"Unsupported architecture: {machine}")

        # Map system to platform key
        if system == "Linux":
            return f"linux_{arch}"
        elif system == "Darwin":
            return f"mac_{arch}"
        elif system == "Windows":
            return f"windows_{arch}"
        else:
            raise ValueError(f"Unsupported operating system: {system}")

    def _verify_checksum(self, file_path: Path) -> bool:
        """
        Verify the SHA-512 checksum of the downloaded file.

        Returns:
            True if checksum matches, False otherwise.
        """
        platform_key = self._get_platform_key()
        expected_checksum = self.CADDY_CHECKSUMS.get(platform_key)

        if not expected_checksum:
            logger.warning(f"No checksum available for platform: {platform_key}")
            return False

        logger.info(f"Verifying SHA-512 checksum for {file_path.name}...")

        # Calculate SHA-512 hash
        sha512_hash = hashlib.sha512()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                sha512_hash.update(chunk)

        actual_checksum = sha512_hash.hexdigest()

        if actual_checksum == expected_checksum:
            logger.info("✓ Checksum verification passed")
            return True
        else:
            logger.error(
                f"✗ Checksum verification failed!\n"
                f"  Expected: {expected_checksum}\n"
                f"  Got:      {actual_checksum}"
            )
            return False

    def download_and_extract(
        self, progress_callback: Optional[callable] = None
    ) -> None:
        """
        Download Caddy binary for current OS and extract it.

        Args:
            progress_callback: Optional callback function(downloaded_bytes, total_bytes)
        """
        url, ext = self.get_download_url()

        # Download to temporary file
        with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp_file:
            tmp_path = Path(tmp_file.name)

            print(f"Downloading Caddy from {url}...")
            response = requests.get(url, stream=True, timeout=30)
            response.raise_for_status()

            total_size = int(response.headers.get("content-length", 0))
            downloaded = 0

            for chunk in response.iter_content(chunk_size=8192):
                tmp_file.write(chunk)
                downloaded += len(chunk)
                if progress_callback:
                    progress_callback(downloaded, total_size)

            tmp_file.flush()

        # Verify checksum before extraction
        if not self._verify_checksum(tmp_path):
            tmp_path.unlink(missing_ok=True)
            raise ValueError(
                "Downloaded file failed checksum verification. "
                "This could indicate a corrupted download or a security issue. "
                "Please try again or download manually from "
                "https://github.com/caddyserver/caddy/releases"
            )

        # Extract the binary (outside with block to ensure file is closed on Windows)
        try:
            self._extract_binary(tmp_path, ext)
            print(f"Caddy binary extracted to {self.binary_path}")
        finally:
            # Clean up temporary file
            tmp_path.unlink(missing_ok=True)

    def _extract_binary(self, archive_path: Path, ext: str) -> None:
        """Extract the caddy binary from the archive."""
        binary_name = get_binary_name("caddy")

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
                raise FileNotFoundError(f"Binary {binary_name} not found in archive")

            # Ensure parent directory exists
            self.binary_path.parent.mkdir(parents=True, exist_ok=True)

            # Copy binary to final location
            import shutil

            shutil.copy2(extracted_binary, self.binary_path)

            # Make executable on Unix systems
            if platform.system() != "Windows":
                self.binary_path.chmod(
                    self.binary_path.stat().st_mode
                    | stat.S_IXUSR
                    | stat.S_IXGRP
                    | stat.S_IXOTH
                )

                # On macOS, remove quarantine attribute to bypass Gatekeeper
                # This is necessary for downloaded binaries to run via subprocess
                if platform.system() == "Darwin":
                    try:
                        subprocess.run(
                            [
                                "xattr",
                                "-d",
                                "com.apple.quarantine",
                                str(self.binary_path),
                            ],
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
        except Exception as exc:
            print(f"Failed to download Caddy: {exc}")
            return False
