"""
Network utilities for hostname resolution and certificate management.
"""

import socket
import platform
import subprocess
import logging
import sys
import psutil
from pathlib import Path
from typing import Optional, Callable

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
    hostname = hostname.split(".")[0]
    # Return hostname with .local suffix for mDNS
    return f"{hostname}.local"


def get_caddy_root_ca_path(caddy_data_dir: Path) -> Path:
    """
    Get the path to Caddy's internal CA root certificate.

    Caddy stores its internal CA at:
    {CADDY_DATA_DIR}/pki/authorities/local/root.crt
    """
    return caddy_data_dir / "pki" / "authorities" / "local" / "root.crt"


def run_with_elevation(command: list[str], graphical: bool = True) -> tuple[bool, Optional[str]]:
    """
    Run a command with elevated privileges (admin/root) in a cross-platform way.

    Args:
        command: The command to run as a list of strings
        graphical: Whether to prefer graphical privilege prompts (default: True)

    Returns:
        (success, error_message)

    Implementation notes:
    - macOS: Uses osascript with AppleScript for graphical prompts
    - Linux: Uses pkexec for graphical prompts, falls back to sudo in terminal
    - Windows: Uses ShellExecuteW with 'runas' verb for UAC prompts
    """
    system = platform.system()

    try:
        if system == "Darwin":  # macOS
            # Use AppleScript's "do shell script ... with administrator privileges"
            # This shows the native macOS privilege prompt
            shell_command = " ".join(f'"{arg}"' if " " in arg else arg for arg in command)
            applescript = f'do shell script "{shell_command}" with administrator privileges'

            result = subprocess.run(
                ["osascript", "-e", applescript],
                capture_output=True,
                text=True,
                check=False
            )

            if result.returncode == 0:
                return True, None
            else:
                error_msg = result.stderr.strip() if result.stderr else "Unknown error"
                return False, error_msg

        elif system == "Linux":
            if graphical:
                # Try pkexec first (graphical, works with most desktop environments)
                try:
                    result = subprocess.run(
                        ["pkexec"] + command,
                        capture_output=True,
                        text=True,
                        check=False
                    )

                    if result.returncode == 0:
                        return True, None
                    else:
                        error_msg = result.stderr.strip() if result.stderr else "Unknown error"
                        return False, error_msg

                except FileNotFoundError:
                    # pkexec not available, fall back to sudo
                    logger.debug("pkexec not found, falling back to sudo")
                    pass

            # Fall back to sudo (works in terminal)
            result = subprocess.run(
                ["sudo"] + command,
                capture_output=True,
                text=True,
                check=False
            )

            if result.returncode == 0:
                return True, None
            else:
                error_msg = result.stderr.strip() if result.stderr else "Unknown error"
                return False, error_msg

        elif system == "Windows":
            # Use Windows ShellExecuteW with 'runas' verb for UAC prompt
            import ctypes
            from ctypes import wintypes

            # ShellExecuteW function signature
            # HINSTANCE ShellExecuteW(
            #   HWND    hwnd,
            #   LPCWSTR lpOperation,
            #   LPCWSTR lpFile,
            #   LPCWSTR lpParameters,
            #   LPCWSTR lpDirectory,
            #   INT     nShowCmd
            # )

            shell32 = ctypes.windll.shell32
            shell32.ShellExecuteW.argtypes = [
                wintypes.HWND,
                wintypes.LPCWSTR,
                wintypes.LPCWSTR,
                wintypes.LPCWSTR,
                wintypes.LPCWSTR,
                ctypes.c_int
            ]
            shell32.ShellExecuteW.restype = wintypes.HINSTANCE

            # Extract program and parameters
            program = command[0]
            parameters = " ".join(f'"{arg}"' if " " in arg else arg for arg in command[1:])

            # SW_HIDE = 0 (hide window for silent operations)
            # Return value > 32 means success
            result = shell32.ShellExecuteW(
                None,                  # hwnd
                "runas",               # operation (run as administrator)
                program,               # file to execute
                parameters,            # parameters
                None,                  # directory
                0                      # SW_HIDE
            )

            if result > 32:
                return True, None
            else:
                # Error codes: https://docs.microsoft.com/en-us/windows/win32/api/shellapi/nf-shellapi-shellexecutew
                error_codes = {
                    0: "Out of memory or resources",
                    2: "File not found",
                    3: "Path not found",
                    5: "Access denied",
                    8: "Out of memory",
                    26: "Sharing violation",
                    27: "File association not complete",
                    28: "DDE timeout",
                    29: "DDE transaction failed",
                    30: "DDE busy",
                    31: "No file association",
                    32: "DLL not found",
                }
                error_msg = error_codes.get(result, f"Unknown error code: {result}")
                return False, error_msg

        else:
            return False, f"Unsupported platform: {system}"

    except Exception as e:
        error_msg = f"Failed to elevate privileges: {str(e)}"
        logger.error(error_msg, exc_info=e)
        return False, error_msg


def detect_running_browsers() -> list[str]:
    """
    Detect which browsers are currently running.

    Returns:
        List of browser names (e.g., ["Chrome", "Firefox", "Brave"])
    """
    running_browsers = []

    # Browser process names to check
    browser_patterns = {
        "Chrome": ["chrome", "google-chrome"],
        "Firefox": ["firefox"],
        "Brave": ["brave", "brave-browser"],
    }

    try:
        for proc in psutil.process_iter(['name', 'exe']):
            try:
                proc_name = proc.info['name'].lower() if proc.info['name'] else ""
                proc_exe = proc.info['exe'].lower() if proc.info['exe'] else ""

                for browser, patterns in browser_patterns.items():
                    if browser not in running_browsers:
                        for pattern in patterns:
                            if pattern in proc_name or pattern in proc_exe:
                                running_browsers.append(browser)
                                break
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
    except Exception as e:
        logger.debug(f"Error detecting running browsers: {e}")

    return running_browsers


def check_certutil_available() -> bool:
    """
    Check if certutil is available on the system.

    Returns:
        True if certutil is available, False otherwise
    """
    try:
        result = subprocess.run(
            ["certutil", "--help"],
            capture_output=True,
            check=False,
            timeout=5
        )
        return result.returncode in (0, 1)  # certutil returns 1 for --help on some systems
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def detect_package_manager() -> Optional[tuple[str, list[str]]]:
    """
    Detect the package manager and return the command to install libnss3-tools.

    Returns:
        (package_manager_name, install_command) or None if not detected
    """
    system = platform.system()

    if system != "Linux":
        return None

    # Check for apt (Debian/Ubuntu)
    try:
        subprocess.run(["apt", "--version"], capture_output=True, check=True, timeout=5)
        return ("apt", ["apt", "install", "-y", "libnss3-tools"])
    except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
        pass

    # Check for dnf (Fedora/RHEL 8+)
    try:
        subprocess.run(["dnf", "--version"], capture_output=True, check=True, timeout=5)
        return ("dnf", ["dnf", "install", "-y", "nss-tools"])
    except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
        pass

    # Check for yum (RHEL/CentOS 7)
    try:
        subprocess.run(["yum", "--version"], capture_output=True, check=True, timeout=5)
        return ("yum", ["yum", "install", "-y", "nss-tools"])
    except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
        pass

    # Check for zypper (openSUSE)
    try:
        subprocess.run(["zypper", "--version"], capture_output=True, check=True, timeout=5)
        return ("zypper", ["zypper", "install", "-y", "mozilla-nss-tools"])
    except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
        pass

    return None


def install_nss_tools(use_elevation: bool = True) -> tuple[bool, Optional[str]]:
    """
    Install NSS tools (certutil) using the system package manager.

    Args:
        use_elevation: Whether to use privilege elevation (default: True)

    Returns:
        (success, error_message)
    """
    pm_info = detect_package_manager()

    if pm_info is None:
        return False, "Could not detect package manager"

    pm_name, install_cmd = pm_info
    logger.info(f"Installing NSS tools using {pm_name}...")

    if use_elevation:
        success, error = run_with_elevation(install_cmd, graphical=True)
        if success:
            logger.info(f"Successfully installed NSS tools using {pm_name}")
            return True, None
        else:
            return False, error
    else:
        try:
            result = subprocess.run(
                install_cmd,
                capture_output=True,
                text=True,
                check=False,
                timeout=300  # 5 minutes timeout for package installation
            )
            if result.returncode == 0:
                logger.info(f"Successfully installed NSS tools using {pm_name}")
                return True, None
            else:
                error_msg = result.stderr.strip() if result.stderr else "Installation failed"
                return False, error_msg
        except subprocess.TimeoutExpired:
            return False, "Package installation timed out"
        except Exception as e:
            return False, f"Installation failed: {str(e)}"


def install_ca_certificate(cert_path: Path, use_elevation: bool = True) -> tuple[bool, Optional[str]]:
    """
    Install a CA certificate to the system trust store.

    Args:
        cert_path: Path to the CA certificate file
        use_elevation: Whether to use privilege elevation (default: True)

    Returns:
        (success, error_message)

    Cross-platform approach:
    - macOS: Uses security add-trusted-cert (requires elevation)
    - Linux: Uses update-ca-certificates or trust command (requires elevation)
    - Windows: Uses certutil to add to Root store (tries elevated, falls back to user-level)
    """
    if not cert_path.exists():
        return False, f"Certificate file not found: {cert_path}"

    system = platform.system()

    try:
        if system == "Darwin":  # macOS
            # Add to system keychain with trust settings
            command = [
                "security",
                "add-trusted-cert",
                "-d",  # Add to admin cert store
                "-r",
                "trustRoot",  # Trust as root
                "-k",
                "/Library/Keychains/System.keychain",
                str(cert_path),
            ]

            if use_elevation:
                success, error = run_with_elevation(command, graphical=True)
                if success:
                    logger.info(
                        "Successfully installed CA certificate to macOS system keychain"
                    )
                    return True, None
                else:
                    return False, error
            else:
                # Without elevation, this will likely fail
                result = subprocess.run(
                    command,
                    capture_output=True,
                    text=True,
                    check=False
                )
                if result.returncode == 0:
                    logger.info(
                        "Successfully installed CA certificate to macOS system keychain"
                    )
                    return True, None
                else:
                    return False, result.stderr.strip() if result.stderr else "Installation failed"

        elif system == "Linux":
            # Try multiple methods as different distros use different tools
            # We try ALL methods (system-level AND NSS database) to ensure both curl and browsers work

            system_installed = False
            nss_installed = False

            # Method 1: Try update-ca-certificates (Debian/Ubuntu)
            ca_dir = Path("/usr/local/share/ca-certificates")
            if ca_dir.exists():
                target = ca_dir / "librocco.crt"

                if use_elevation:
                    # Copy cert file with elevation
                    success1, error1 = run_with_elevation(
                        ["cp", str(cert_path), str(target)],
                        graphical=True
                    )
                    if not success1:
                        logger.warning(f"Failed to copy certificate: {error1}")
                        # Continue to try other methods
                    else:
                        # Update certificates with elevation
                        success2, error2 = run_with_elevation(
                            ["update-ca-certificates"],
                            graphical=True
                        )
                        if success2:
                            logger.info(
                                "Successfully installed CA certificate using update-ca-certificates"
                            )
                            system_installed = True
                        else:
                            logger.warning(f"Failed to update CA certificates: {error2}")

            # Method 2: Try trust command (RHEL/Fedora) - only if Method 1 didn't work
            if not system_installed:
                try:
                    command = ["trust", "anchor", str(cert_path)]

                    if use_elevation:
                        success, error = run_with_elevation(command, graphical=True)
                        if success:
                            logger.info("Successfully installed CA certificate using trust command")
                            system_installed = True
                        else:
                            logger.warning(f"Failed with trust command: {error}")
                    else:
                        result = subprocess.run(
                            command,
                            capture_output=True,
                            text=True,
                            check=False
                        )
                        if result.returncode == 0:
                            logger.info("Successfully installed CA certificate using trust command")
                            system_installed = True
                except FileNotFoundError:
                    logger.debug("trust command not available on this system")

            # Method 3: Try certutil for NSS databases (Firefox, Chrome, Brave) - no elevation needed
            # Always try this, even if system-level installation succeeded
            try:
                home = Path.home()
                nss_dirs = [
                    home / ".pki" / "nssdb",  # Chrome/Chromium/Brave (shared database)
                    home / ".mozilla" / "firefox",  # Firefox
                ]

                installed_count = 0
                for nss_dir in nss_dirs:
                    if nss_dir.exists():
                        if "firefox" in str(nss_dir):
                            # Find Firefox profile directories
                            for profile_dir in nss_dir.iterdir():
                                if profile_dir.is_dir():
                                    result = subprocess.run(
                                        [
                                            "certutil",
                                            "-A",
                                            "-n",
                                            "Librocco CA",
                                            "-t",
                                            "C,,",
                                            "-i",
                                            str(cert_path),
                                            "-d",
                                            f"sql:{profile_dir}",
                                        ],
                                        capture_output=True,
                                        text=True,
                                        check=False
                                    )
                                    if result.returncode == 0:
                                        installed_count += 1
                        else:
                            result = subprocess.run(
                                [
                                    "certutil",
                                    "-A",
                                    "-n",
                                    "Librocco CA",
                                    "-t",
                                    "C,,",
                                    "-i",
                                    str(cert_path),
                                    "-d",
                                    f"sql:{nss_dir}",
                                ],
                                capture_output=True,
                                text=True,
                                check=False
                            )
                            if result.returncode == 0:
                                installed_count += 1

                if installed_count > 0:
                    logger.info(f"Successfully installed CA certificate to {installed_count} NSS databases")
                    nss_installed = True
            except FileNotFoundError:
                logger.debug("certutil not available on this system")

            # Return success if at least system-level installation worked
            if system_installed:
                return True, None

            # If system-level failed but NSS succeeded, that's still somewhat useful
            if nss_installed:
                return True, None

            return (
                False,
                "Could not install certificate: No supported method found (tried update-ca-certificates, trust, certutil)",
            )

        elif system == "Windows":
            # Try to install to system Root store (requires admin)
            command = ["certutil", "-addstore", "Root", str(cert_path)]

            if use_elevation:
                success, error = run_with_elevation(command, graphical=True)
                if success:
                    logger.info("Successfully installed CA certificate to Windows Root store")
                    return True, None
                else:
                    # If elevation failed, try user-level installation as fallback
                    logger.warning(f"System-level installation failed: {error}, trying user-level")

            # Fall back to user-level installation (no admin required)
            result = subprocess.run(
                ["certutil", "-addstore", "-user", "Root", str(cert_path)],
                capture_output=True,
                text=True,
                check=False
            )

            if result.returncode == 0:
                logger.info("Successfully installed CA certificate to Windows user-level Root store")
                return True, None
            else:
                error_msg = result.stderr.strip() if result.stderr else "Installation failed"
                return False, error_msg

        else:
            return False, f"Unsupported platform: {system}"

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
                [
                    "security",
                    "find-certificate",
                    "-a",
                    "-c",
                    "Librocco CA",
                    "/Library/Keychains/System.keychain",
                ],
                capture_output=True,
                text=True,
            )
            return result.returncode == 0

        elif system == "Linux":
            # Check if the cert file exists in the CA certificates directory
            ca_file = Path("/usr/local/share/ca-certificates/librocco.crt")
            system_installed = ca_file.exists()

            # Also check if NSS database has the certificate (for Chrome/Firefox)
            nss_installed = False
            if check_certutil_available():
                try:
                    # Check Chrome/Chromium NSS database
                    nss_dir = Path.home() / ".pki" / "nssdb"
                    if nss_dir.exists():
                        result = subprocess.run(
                            ["certutil", "-L", "-d", f"sql:{nss_dir}"],
                            capture_output=True,
                            text=True,
                            check=False,
                            timeout=5
                        )
                        if "Librocco CA" in result.stdout:
                            nss_installed = True
                except (FileNotFoundError, subprocess.TimeoutExpired):
                    pass

            # Return True only if both system and NSS database have the certificate
            return system_installed and nss_installed

        elif system == "Windows":
            # Check Root store
            result = subprocess.run(
                ["certutil", "-store", "Root"], capture_output=True, text=True
            )
            return "Librocco CA" in result.stdout

        else:
            return False

    except Exception as e:
        logger.debug(f"Error checking if CA is installed: {e}")
        return False
