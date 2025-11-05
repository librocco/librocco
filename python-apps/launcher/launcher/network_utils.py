"""
Network utilities for hostname resolution and certificate management.
"""

import socket
import platform
import subprocess
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger("launcher")


def get_local_hostname() -> str:
    """
    Get the hostname that will resolve on the local network.

    Returns a .local hostname for mDNS/Bonjour resolution.
    On macOS and Linux, .local hostnames work out of the box.
    On Windows, it requires Bonjour Print Services or similar.
    """
    hostname = socket.gethostname()
    # Remove any domain suffix if present
    hostname = hostname.split('.')[0]
    # Return hostname with .local suffix for mDNS
    return f"{hostname}.local"


def get_caddy_root_ca_path(caddy_data_dir: Path) -> Path:
    """
    Get the path to Caddy's internal CA root certificate.

    Caddy stores its internal CA at:
    {CADDY_DATA_DIR}/pki/authorities/local/root.crt
    """
    return caddy_data_dir / "pki" / "authorities" / "local" / "root.crt"


def install_ca_certificate(cert_path: Path) -> tuple[bool, Optional[str]]:
    """
    Install a CA certificate to the system trust store.

    Returns: (success, error_message)

    Cross-platform approach:
    - Linux: Uses certutil (NSS), update-ca-certificates, or trust command
    - macOS: Uses security add-trusted-cert
    - Windows: Uses certutil.exe
    """
    if not cert_path.exists():
        return False, f"Certificate file not found: {cert_path}"

    system = platform.system()

    try:
        if system == "Darwin":  # macOS
            # Add to system keychain with trust settings
            subprocess.run(
                [
                    "sudo", "security", "add-trusted-cert",
                    "-d",  # Add to admin cert store
                    "-r", "trustRoot",  # Trust as root
                    "-k", "/Library/Keychains/System.keychain",
                    str(cert_path)
                ],
                check=True,
                capture_output=True,
                text=True
            )
            logger.info("Successfully installed CA certificate to macOS system keychain")
            return True, None

        elif system == "Linux":
            # Try multiple methods as different distros use different tools

            # Method 1: Try update-ca-certificates (Debian/Ubuntu)
            ca_dir = Path("/usr/local/share/ca-certificates")
            if ca_dir.exists():
                target = ca_dir / "librocco-launcher.crt"
                subprocess.run(
                    ["sudo", "cp", str(cert_path), str(target)],
                    check=True,
                    capture_output=True
                )
                subprocess.run(
                    ["sudo", "update-ca-certificates"],
                    check=True,
                    capture_output=True
                )
                logger.info("Successfully installed CA certificate using update-ca-certificates")
                return True, None

            # Method 2: Try trust command (RHEL/Fedora)
            try:
                subprocess.run(
                    ["sudo", "trust", "anchor", str(cert_path)],
                    check=True,
                    capture_output=True
                )
                logger.info("Successfully installed CA certificate using trust command")
                return True, None
            except (subprocess.CalledProcessError, FileNotFoundError):
                pass

            # Method 3: Try certutil for NSS databases (Firefox, Chrome)
            try:
                # Find NSS certificate databases in common locations
                import os
                home = Path.home()
                nss_dirs = [
                    home / ".pki" / "nssdb",  # Chrome/Chromium
                    home / ".mozilla" / "firefox",  # Firefox
                ]

                for nss_dir in nss_dirs:
                    if nss_dir.exists():
                        if "firefox" in str(nss_dir):
                            # Find Firefox profile directories
                            for profile_dir in nss_dir.iterdir():
                                if profile_dir.is_dir():
                                    subprocess.run(
                                        ["certutil", "-A", "-n", "Librocco Launcher CA",
                                         "-t", "C,,", "-i", str(cert_path),
                                         "-d", f"sql:{profile_dir}"],
                                        check=True,
                                        capture_output=True
                                    )
                        else:
                            subprocess.run(
                                ["certutil", "-A", "-n", "Librocco Launcher CA",
                                 "-t", "C,,", "-i", str(cert_path),
                                 "-d", f"sql:{nss_dir}"],
                                check=True,
                                capture_output=True
                            )

                logger.info("Successfully installed CA certificate to NSS databases")
                return True, None
            except (subprocess.CalledProcessError, FileNotFoundError):
                pass

            return False, "Could not install certificate: No supported method found (tried update-ca-certificates, trust, certutil)"

        elif system == "Windows":
            # Use certutil.exe to add to Root store
            subprocess.run(
                ["certutil", "-addstore", "Root", str(cert_path)],
                check=True,
                capture_output=True,
                text=True
            )
            logger.info("Successfully installed CA certificate to Windows Root store")
            return True, None

        else:
            return False, f"Unsupported platform: {system}"

    except subprocess.CalledProcessError as e:
        error_msg = f"Failed to install certificate: {e.stderr if e.stderr else str(e)}"
        logger.error(error_msg)
        return False, error_msg
    except Exception as e:
        error_msg = f"Unexpected error installing certificate: {str(e)}"
        logger.error(error_msg, exc_info=e)
        return False, error_msg


def check_ca_installed(cert_path: Path) -> bool:
    """
    Check if the CA certificate is already installed in the system trust store.

    Returns: True if installed, False otherwise
    """
    if not cert_path.exists():
        return False

    system = platform.system()

    try:
        if system == "Darwin":  # macOS
            # Check system keychain
            result = subprocess.run(
                ["security", "find-certificate", "-a", "-c", "Caddy Local Authority",
                 "/Library/Keychains/System.keychain"],
                capture_output=True,
                text=True
            )
            return result.returncode == 0

        elif system == "Linux":
            # Check if the cert file exists in the CA certificates directory
            ca_file = Path("/usr/local/share/ca-certificates/librocco-launcher.crt")
            return ca_file.exists()

        elif system == "Windows":
            # Check Root store
            result = subprocess.run(
                ["certutil", "-store", "Root"],
                capture_output=True,
                text=True
            )
            return "Caddy Local Authority" in result.stdout

        else:
            return False

    except Exception as e:
        logger.debug(f"Error checking if CA is installed: {e}")
        return False
