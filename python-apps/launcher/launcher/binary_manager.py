"""
Binary download and management for external executables (Caddy, Node.js).
"""

import hashlib
import logging
import platform
import sys
import tarfile
import zipfile
import tempfile
import subprocess
import stat
import time
from pathlib import Path
from typing import Optional, Tuple
import requests
from launcher.config import get_binary_name

logger = logging.getLogger("launcher")


class BinaryManager:
    """Manages downloading and updating bundled binaries."""

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

    NODE_VERSION = "20.18.1"
    NODE_RELEASE_BASE = "https://nodejs.org/dist"
    NODE_SHASUMS_FILE = "SHASUMS256.txt"

    NODE_PLATFORM_TAGS = {
        "linux_amd64": "linux-x64",
        "linux_arm64": "linux-arm64",
        "mac_amd64": "darwin-x64",
        "mac_arm64": "darwin-arm64",
        "windows_amd64": "win-x64",
        "windows_arm64": "win-arm64",
    }

    def __init__(self, binary_path: Path, binary_type: str = "caddy"):
        if binary_type not in {"caddy", "node"}:
            raise ValueError(f"Unsupported binary type: {binary_type}")

        self.binary_type = binary_type
        self.binary_path = binary_path

    @staticmethod
    def is_bundled_mode() -> bool:
        """
        Check if running from PyInstaller bundle.
        PyInstaller sets sys._MEIPASS when running from a bundle.
        """
        return getattr(sys, "_MEIPASS", None) is not None

    def get_bundled_binary_path(self) -> Optional[Path]:
        """
        Get the path to the bundled binary if running from a PyInstaller bundle.
        Returns None if not running in bundled mode.
        """
        if not BinaryManager.is_bundled_mode():
            return None

        bundle_dir = Path(sys._MEIPASS)
        binary_name = self._get_binary_name()
        bundled_path = bundle_dir / "bundled_binaries" / binary_name

        if bundled_path.exists():
            return bundled_path
        else:
            logger.warning(
                f"Running in bundled mode but {self.binary_type} binary not found at {bundled_path}"
            )
            return None

    def _get_binary_name(self) -> str:
        base_name = "caddy" if self.binary_type == "caddy" else "node"
        return get_binary_name(base_name)

    def get_download_info(self) -> Tuple[str, str, str]:
        """
        Get download details for the current OS and architecture.
        Returns:
            Tuple of (url, file_extension, filename)
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

        if self.binary_type == "caddy":
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
            return url, ext, filename

        platform_key = self._get_platform_key()
        platform_tag = self.NODE_PLATFORM_TAGS.get(platform_key)
        if not platform_tag:
            raise ValueError(f"Unsupported platform for Node.js: {platform_key}")

        if system in {"Linux", "Darwin"}:
            ext = "tar.gz"
        elif system == "Windows":
            ext = "zip"
        else:
            raise ValueError(f"Unsupported operating system: {system}")

        filename = f"node-v{self.NODE_VERSION}-{platform_tag}.{ext}"
        url = f"{self.NODE_RELEASE_BASE}/v{self.NODE_VERSION}/{filename}"
        return url, ext, filename

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

    def _verify_checksum(self, file_path: Path, filename: str) -> bool:
        """
        Verify the checksum of the downloaded file.

        Returns:
            True if checksum matches, False otherwise.
        """
        if self.binary_type == "caddy":
            platform_key = self._get_platform_key()
            expected_checksum = self.CADDY_CHECKSUMS.get(platform_key)

            if not expected_checksum:
                logger.warning(f"No checksum available for platform: {platform_key}")
                return False

            logger.info(f"Verifying SHA-512 checksum for {file_path.name}...")

            sha512_hash = hashlib.sha512()
            with open(file_path, "rb") as f:
                for chunk in iter(lambda: f.read(8192), b""):
                    sha512_hash.update(chunk)

            actual_checksum = sha512_hash.hexdigest()

            if actual_checksum == expected_checksum:
                logger.info("✓ Checksum verification passed")
                return True

            logger.error(
                "✗ Checksum verification failed!\n"
                f"  Expected: {expected_checksum}\n"
                f"  Got:      {actual_checksum}"
            )
            return False

        # Node.js uses SHA-256 checksums published alongside releases
        expected_checksum = self._fetch_node_checksum(filename)
        if not expected_checksum:
            logger.error("✗ Failed to retrieve expected checksum for Node.js download")
            return False

        logger.info(f"Verifying SHA-256 checksum for {file_path.name}...")

        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                sha256_hash.update(chunk)

        actual_checksum = sha256_hash.hexdigest()

        if actual_checksum == expected_checksum:
            logger.info("✓ Checksum verification passed")
            return True

        logger.error(
            "✗ Checksum verification failed!\n"
            f"  Expected: {expected_checksum}\n"
            f"  Got:      {actual_checksum}"
        )
        return False

    def download_and_extract(
        self, progress_callback: Optional[callable] = None
    ) -> None:
        """
        Download the target binary for current OS and extract it.

        Args:
            progress_callback: Optional callback function(downloaded_bytes, total_bytes)
        """
        url, ext, filename = self.get_download_info()

        # Download to temporary file with retry logic
        max_retries = 3
        retry_delay = 2  # seconds

        with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp_file:
            tmp_path = Path(tmp_file.name)

            for attempt in range(1, max_retries + 1):
                try:
                    print(f"Downloading {self.binary_type} from {url}...")
                    if attempt > 1:
                        print(f"Retry attempt {attempt}/{max_retries}...")

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
                    break  # Success - exit retry loop

                except (requests.exceptions.RequestException, OSError) as e:
                    logger.error(f"Failed to download {self.binary_type}: {e}")
                    print(f"Failed to download {self.binary_type}: {e}")

                    if attempt < max_retries:
                        # Exponential backoff: 2s, 4s, 8s, etc.
                        wait_time = retry_delay * (2 ** (attempt - 1))
                        print(f"Retrying in {wait_time} seconds...")
                        time.sleep(wait_time)

                        # Reset file position for retry
                        tmp_file.seek(0)
                        tmp_file.truncate()
                    else:
                        # All retries exhausted
                        raise RuntimeError(
                            f"Failed to download {self.binary_type} after {max_retries} attempts. "
                            f"Last error: {e}"
                        )

        # Verify checksum before extraction
        if not self._verify_checksum(tmp_path, filename):
            tmp_path.unlink(missing_ok=True)
            raise ValueError(
                "Downloaded file failed checksum verification. "
                "This could indicate a corrupted download or a security issue. "
                "Please try again or download manually from the official release website."
            )

        # Extract the binary (outside with block to ensure file is closed on Windows)
        try:
            self._extract_binary(tmp_path, ext)
            print(
                f"{self.binary_type.capitalize()} binary extracted to {self.binary_path}"
            )
        finally:
            # Clean up temporary file
            tmp_path.unlink(missing_ok=True)

    def _extract_binary(self, archive_path: Path, ext: str) -> None:
        """Extract the target binary from the archive."""
        binary_name = self._get_binary_name()

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

            extracted_binary = self._find_extracted_binary(
                tmp_dir_path, binary_name, ext
            )
            if not extracted_binary.exists():
                raise FileNotFoundError(f"Binary {binary_name} not found in archive")

            # Ensure parent directory exists
            self.binary_path.parent.mkdir(parents=True, exist_ok=True)

            # Copy binary to final location
            import shutil

            shutil.copy2(extracted_binary, self.binary_path)

            # Make executable (Windows ignores this, which is fine)
            self.binary_path.chmod(
                self.binary_path.stat().st_mode
                | stat.S_IXUSR
                | stat.S_IXGRP
                | stat.S_IXOTH
            )

            # On macOS, remove Gatekeeper quarantine attribute from downloaded binaries
            # NOTE: This is macOS-specific and cannot be eliminated. macOS automatically
            # adds the com.apple.quarantine attribute to files downloaded from the internet,
            # which prevents them from running via subprocess without user interaction.
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
                        check=False,
                    )
                except Exception:
                    pass  # Ignore errors, attribute may not exist

    def verify_binary(self) -> bool:
        """
        Verify the binary works by running a version command.
        Returns True if successful, False otherwise.
        """
        if not self.binary_path.exists():
            return False

        try:
            result = subprocess.run(
                self._get_verify_command(),
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
        In bundled mode, uses pre-bundled Caddy. In development mode, downloads if needed.
        Returns True if binary is ready, False if download failed.
        """
        # IMPORTANT: Check for bundled mode FIRST before any other checks
        # This ensures PyInstaller executables always use the bundled binary
        bundled_path = self.get_bundled_binary_path()
        if bundled_path:
            logger.info(
                f"Running in bundled mode, using {self.binary_type} from {bundled_path}"
            )
            print(f"Using bundled {self.binary_type} binary from {bundled_path}")
            # Update binary_path to point to bundled binary
            self.binary_path = bundled_path
            if self.verify_binary():
                return True
            else:
                logger.error(
                    f"Bundled {self.binary_type} binary failed verification at {bundled_path}"
                )
                return False

        # Development mode: check if already exists
        if self.verify_binary():
            logger.info(
                f"{self.binary_type.capitalize()} binary already exists at {self.binary_path}"
            )
            print(
                f"{self.binary_type.capitalize()} binary already exists at {self.binary_path}"
            )
            return True

        # Development mode: download if needed
        logger.info(
            f"{self.binary_type.capitalize()} binary not found. Starting download..."
        )
        try:
            self.download_and_extract()
            return self.verify_binary()
        except Exception as e:
            logger.error(f"Failed to download {self.binary_type}: {e}")
            print(f"Failed to download {self.binary_type}: {e}")
            return False

    def _find_extracted_binary(
        self, tmp_dir_path: Path, binary_name: str, ext: str
    ) -> Path:
        if self.binary_type == "caddy":
            return tmp_dir_path / binary_name

        platform_key = self._get_platform_key()
        platform_tag = self.NODE_PLATFORM_TAGS.get(platform_key)
        if not platform_tag:
            raise ValueError(f"Unsupported platform for Node.js: {platform_key}")

        node_dir = f"node-v{self.NODE_VERSION}-{platform_tag}"
        if ext == "tar.gz":
            return tmp_dir_path / node_dir / "bin" / binary_name
        else:
            return tmp_dir_path / node_dir / binary_name

    def _fetch_node_checksum(self, filename: str) -> Optional[str]:
        platform_key = self._get_platform_key()
        if platform_key not in self.NODE_PLATFORM_TAGS:
            return None

        checksums_url = (
            f"{self.NODE_RELEASE_BASE}/v{self.NODE_VERSION}/{self.NODE_SHASUMS_FILE}"
        )
        try:
            response = requests.get(checksums_url, timeout=30)
            response.raise_for_status()
        except Exception as exc:
            logger.error(f"Failed to download Node.js checksums: {exc}")
            return None

        for line in response.text.splitlines():
            parts = line.strip().split()
            if len(parts) != 2:
                continue
            checksum, name = parts
            if name == filename:
                return checksum

        logger.error(f"Checksum for {filename} not found in {self.NODE_SHASUMS_FILE}")
        return None

    def _get_verify_command(self) -> list:
        if self.binary_type == "caddy":
            return [str(self.binary_path), "version"]
        return [str(self.binary_path), "--version"]
