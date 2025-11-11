"""Tests for network_utils certificate management functions."""

import platform
import subprocess
import os
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
import pytest

from launcher.network_utils import (
    get_caddy_root_ca_path,
    check_ca_installed,
    install_ca_certificate,
    run_with_elevation,
)


class TestGetCaddyRootCaPath:
    """Tests for get_caddy_root_ca_path function."""

    def test_returns_correct_path(self, temp_data_dir):
        """Test that the function returns the expected CA certificate path."""
        caddy_data_dir = temp_data_dir / "caddy-data"
        expected_path = caddy_data_dir / "pki" / "authorities" / "local" / "root.crt"

        result = get_caddy_root_ca_path(caddy_data_dir)

        assert result == expected_path
        assert isinstance(result, Path)


class TestRunWithElevation:
    """Tests for run_with_elevation function (mocked)."""

    @pytest.mark.skipif(
        platform.system() != "Darwin",
        reason="macOS-specific test"
    )
    @patch("subprocess.run")
    def test_macos_elevation_success(self, mock_run):
        """Test macOS privilege elevation using osascript."""
        # Mock successful osascript execution
        mock_run.return_value = subprocess.CompletedProcess(
            args=["osascript", "-e", "..."],
            returncode=0,
            stdout="",
            stderr=""
        )

        command = ["security", "add-trusted-cert", "-k", "/path/to/keychain", "/path/to/cert"]
        success, error = run_with_elevation(command, graphical=True)

        assert success is True
        assert error is None
        assert mock_run.called
        # Check that osascript was called
        call_args = mock_run.call_args[0][0]
        assert call_args[0] == "osascript"
        assert "-e" in call_args

    @pytest.mark.skipif(
        platform.system() != "Darwin",
        reason="macOS-specific test"
    )
    @patch("subprocess.run")
    def test_macos_elevation_failure(self, mock_run):
        """Test macOS privilege elevation failure."""
        mock_run.return_value = subprocess.CompletedProcess(
            args=["osascript", "-e", "..."],
            returncode=1,
            stdout="",
            stderr="User cancelled"
        )

        command = ["security", "add-trusted-cert", "-k", "/path/to/keychain", "/path/to/cert"]
        success, error = run_with_elevation(command, graphical=True)

        assert success is False
        assert error == "User cancelled"

    @pytest.mark.skipif(
        platform.system() != "Linux",
        reason="Linux-specific test"
    )
    @patch("subprocess.run")
    def test_linux_elevation_with_pkexec(self, mock_run):
        """Test Linux privilege elevation using pkexec."""
        mock_run.return_value = subprocess.CompletedProcess(
            args=["pkexec", "cp", "source", "dest"],
            returncode=0,
            stdout="",
            stderr=""
        )

        command = ["cp", "source", "dest"]
        success, error = run_with_elevation(command, graphical=True)

        assert success is True
        assert error is None
        call_args = mock_run.call_args[0][0]
        assert call_args[0] == "pkexec"

    @pytest.mark.skipif(
        platform.system() != "Linux",
        reason="Linux-specific test"
    )
    @patch("subprocess.run")
    def test_linux_elevation_fallback_to_sudo(self, mock_run):
        """Test Linux privilege elevation falls back to sudo when pkexec fails."""
        # First call (pkexec) raises FileNotFoundError, second call (sudo) succeeds
        mock_run.side_effect = [
            FileNotFoundError("pkexec not found"),
            subprocess.CompletedProcess(
                args=["sudo", "cp", "source", "dest"],
                returncode=0,
                stdout="",
                stderr=""
            )
        ]

        command = ["cp", "source", "dest"]
        success, error = run_with_elevation(command, graphical=True)

        assert success is True
        assert error is None
        # Check that sudo was called
        call_args = mock_run.call_args[0][0]
        assert call_args[0] == "sudo"

    @pytest.mark.skipif(
        platform.system() != "Windows",
        reason="Windows-specific test"
    )
    @patch("ctypes.windll.shell32.ShellExecuteW")
    def test_windows_elevation_success(self, mock_shell_execute):
        """Test Windows privilege elevation using ShellExecuteW."""
        # Return value > 32 means success
        mock_shell_execute.return_value = 42

        command = ["certutil", "-addstore", "Root", "cert.crt"]
        success, error = run_with_elevation(command, graphical=True)

        assert success is True
        assert error is None
        assert mock_shell_execute.called

    @pytest.mark.skipif(
        platform.system() != "Windows",
        reason="Windows-specific test"
    )
    @patch("ctypes.windll.shell32.ShellExecuteW")
    def test_windows_elevation_failure(self, mock_shell_execute):
        """Test Windows privilege elevation failure."""
        # Return value <= 32 means failure
        mock_shell_execute.return_value = 5  # Access denied

        command = ["certutil", "-addstore", "Root", "cert.crt"]
        success, error = run_with_elevation(command, graphical=True)

        assert success is False
        assert "Access denied" in error


class TestCheckCaInstalled:
    """Tests for check_ca_installed function (mocked)."""

    def test_returns_false_when_cert_does_not_exist(self, temp_data_dir):
        """Test that check_ca_installed returns False when cert file doesn't exist."""
        nonexistent_cert = temp_data_dir / "nonexistent.crt"

        result = check_ca_installed(nonexistent_cert)

        assert result is False

    @pytest.mark.skipif(
        platform.system() != "Darwin",
        reason="macOS-specific test"
    )
    @patch("subprocess.run")
    def test_macos_ca_installed(self, mock_run, temp_data_dir):
        """Test checking if CA is installed on macOS."""
        # Create a dummy cert file
        cert_path = temp_data_dir / "test.crt"
        cert_path.write_text("dummy cert")

        # Mock successful find-certificate
        mock_run.return_value = subprocess.CompletedProcess(
            args=["security", "find-certificate", "..."],
            returncode=0,
            stdout="Certificate found",
            stderr=""
        )

        result = check_ca_installed(cert_path)

        assert result is True
        call_args = mock_run.call_args[0][0]
        assert "security" in call_args
        assert "find-certificate" in call_args

    @pytest.mark.skipif(
        platform.system() != "Darwin",
        reason="macOS-specific test"
    )
    @patch("subprocess.run")
    def test_macos_ca_not_installed(self, mock_run, temp_data_dir):
        """Test checking if CA is not installed on macOS."""
        cert_path = temp_data_dir / "test.crt"
        cert_path.write_text("dummy cert")

        # Mock failed find-certificate (cert not found)
        mock_run.return_value = subprocess.CompletedProcess(
            args=["security", "find-certificate", "..."],
            returncode=1,
            stdout="",
            stderr="Certificate not found"
        )

        result = check_ca_installed(cert_path)

        assert result is False

    @pytest.mark.skipif(
        platform.system() != "Linux",
        reason="Linux-specific test"
    )
    @patch("pathlib.Path.exists")
    def test_linux_ca_installed(self, mock_exists, temp_data_dir):
        """Test checking if CA is installed on Linux."""
        cert_path = temp_data_dir / "test.crt"
        cert_path.write_text("dummy cert")

        # Mock that the cert file exists in ca-certificates directory
        mock_exists.return_value = True

        result = check_ca_installed(cert_path)

        assert result is True

    @pytest.mark.skipif(
        platform.system() != "Windows",
        reason="Windows-specific test"
    )
    @patch("subprocess.run")
    def test_windows_ca_installed(self, mock_run, temp_data_dir):
        """Test checking if CA is installed on Windows."""
        cert_path = temp_data_dir / "test.crt"
        cert_path.write_text("dummy cert")

        # Mock certutil output showing the certificate
        mock_run.return_value = subprocess.CompletedProcess(
            args=["certutil", "-store", "Root"],
            returncode=0,
            stdout="Caddy Local Authority\nSome other cert",
            stderr=""
        )

        result = check_ca_installed(cert_path)

        assert result is True


class TestInstallCaCertificate:
    """Tests for install_ca_certificate function (mocked)."""

    def test_returns_false_when_cert_does_not_exist(self, temp_data_dir):
        """Test that install_ca_certificate returns False when cert file doesn't exist."""
        nonexistent_cert = temp_data_dir / "nonexistent.crt"

        success, error = install_ca_certificate(nonexistent_cert)

        assert success is False
        assert "not found" in error.lower()

    @pytest.mark.skipif(
        platform.system() != "Darwin",
        reason="macOS-specific test"
    )
    @patch("launcher.network_utils.run_with_elevation")
    def test_macos_installation_success(self, mock_elevation, temp_data_dir):
        """Test successful CA installation on macOS."""
        cert_path = temp_data_dir / "test.crt"
        cert_path.write_text("dummy cert")

        # Mock successful elevation
        mock_elevation.return_value = (True, None)

        success, error = install_ca_certificate(cert_path, use_elevation=True)

        assert success is True
        assert error is None
        assert mock_elevation.called
        call_args = mock_elevation.call_args[0][0]
        assert "security" in call_args
        assert "add-trusted-cert" in call_args

    @pytest.mark.skipif(
        platform.system() != "Linux",
        reason="Linux-specific test"
    )
    @patch("launcher.network_utils.run_with_elevation")
    @patch("pathlib.Path.exists")
    def test_linux_installation_success_update_ca(self, mock_exists, mock_elevation, temp_data_dir):
        """Test successful CA installation on Linux using update-ca-certificates."""
        cert_path = temp_data_dir / "test.crt"
        cert_path.write_text("dummy cert")

        # Mock that ca-certificates directory exists
        mock_exists.return_value = True

        # Mock successful elevation for both cp and update-ca-certificates
        mock_elevation.side_effect = [
            (True, None),  # cp command
            (True, None),  # update-ca-certificates command
        ]

        success, error = install_ca_certificate(cert_path, use_elevation=True)

        assert success is True
        assert error is None
        assert mock_elevation.call_count == 2

    @pytest.mark.skipif(
        platform.system() != "Windows",
        reason="Windows-specific test"
    )
    @patch("launcher.network_utils.run_with_elevation")
    def test_windows_installation_system_level(self, mock_elevation, temp_data_dir):
        """Test successful CA installation on Windows at system level."""
        cert_path = temp_data_dir / "test.crt"
        cert_path.write_text("dummy cert")

        # Mock successful elevation
        mock_elevation.return_value = (True, None)

        success, error = install_ca_certificate(cert_path, use_elevation=True)

        assert success is True
        assert error is None
        call_args = mock_elevation.call_args[0][0]
        assert "certutil" in call_args
        assert "-addstore" in call_args

    @pytest.mark.skipif(
        platform.system() != "Windows",
        reason="Windows-specific test"
    )
    @patch("launcher.network_utils.run_with_elevation")
    @patch("subprocess.run")
    def test_windows_installation_fallback_user_level(self, mock_run, mock_elevation, temp_data_dir):
        """Test Windows CA installation falls back to user level when elevation fails."""
        cert_path = temp_data_dir / "test.crt"
        cert_path.write_text("dummy cert")

        # Mock elevation failure
        mock_elevation.return_value = (False, "User cancelled")

        # Mock successful user-level installation
        mock_run.return_value = subprocess.CompletedProcess(
            args=["certutil", "-addstore", "-user", "Root", str(cert_path)],
            returncode=0,
            stdout="",
            stderr=""
        )

        success, error = install_ca_certificate(cert_path, use_elevation=True)

        assert success is True
        assert error is None
        # Verify user-level certutil was called
        call_args = mock_run.call_args[0][0]
        assert "certutil" in call_args
        assert "-user" in call_args


@pytest.mark.skipif(
    not os.environ.get("CI"),
    reason="Integration tests only run in CI with actual system modification"
)
class TestCertificateInstallationIntegration:
    """Integration tests that actually install certificates (CI only)."""

    def test_install_and_verify_certificate(self, temp_data_dir):
        """Test actual certificate installation in CI environment."""
        # Create a self-signed test certificate
        cert_path = temp_data_dir / "test-ca.crt"

        # Generate a simple self-signed certificate using openssl
        # This is a minimal cert just for testing the installation mechanism
        cert_content = """-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJAKHHCgVZU6F5MA0GCSqGSIb3DQEBCwUAMBExDzANBgNVBAMMBnRl
c3RjYTAeFw0yNDAxMDEwMDAwMDBaFw0yNTAxMDEwMDAwMDBaMBExDzANBgNVBAMM
BnRlc3RjYTCBnzANBgkqhkiG9w0BAQEFAAOBjQAwgYkCgYEAx6TN0RzwGc7hRSud
cLtNvNvdEJX9pMTqG1FkJdPqOqGmLlqQbPzQxlLt7VBbQQqYZxMn8rPr5P5YV5Gq
HEWmHqYLCE4h3nKnbQqPZGPdSEKWGqLzR3vEq0WQZbGm0XH8YQqQzQN8ZQYH9P2N
K6HzMqLLCm0C5YHQ8YQZQR8CAwEAATANBgkqhkiG9w0BAQsFAAOBgQCQVQxPWG6Y
Z8YHQ0YK5YHQ8YQ5YHQ8YQ6YHQ8YQ7YHQ8YQ8YHQ8YQ9YHQ8YQ0=
-----END CERTIFICATE-----"""
        cert_path.write_text(cert_content)

        # Attempt installation
        success, error = install_ca_certificate(cert_path, use_elevation=True)

        # In CI, we have passwordless sudo/admin, so this should succeed
        # We just verify the command executes without error; verification with
        # check_ca_installed() requires the certificate to have a specific name
        # ("Caddy Local Authority") which our test cert doesn't have
        assert success, f"Installation should succeed in CI environment: {error}"
