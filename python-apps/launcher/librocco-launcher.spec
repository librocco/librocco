# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file for Librocco Launcher.

This spec file bundles the launcher application with all necessary dependencies:
- Caddy binary (pre-downloaded to bundled_binaries/)
- Web client build (from apps/web-client/build/)
- Translation files (launcher/locales/)
- Python dependencies

Usage:
    pyinstaller librocco-launcher.spec
"""

import platform
import sys
from pathlib import Path

# Determine current platform
IS_WINDOWS = platform.system() == 'Windows'
IS_MACOS = platform.system() == 'Darwin'
IS_LINUX = platform.system() == 'Linux'

# Paths
LAUNCHER_DIR = Path('.').resolve()
PROJECT_ROOT = LAUNCHER_DIR.parent.parent
WEB_CLIENT_BUILD = PROJECT_ROOT / 'apps' / 'web-client' / 'build'
BUNDLED_BINARIES = LAUNCHER_DIR / 'bundled_binaries'

# Binary name
CADDY_BINARY = 'caddy.exe' if IS_WINDOWS else 'caddy'

# Collect data files
datas = []

# 1. Web client build directory (served by Caddy)
if WEB_CLIENT_BUILD.exists():
    datas.append((str(WEB_CLIENT_BUILD), 'app'))
else:
    print(f"WARNING: Web client build not found at {WEB_CLIENT_BUILD}")
    print("Please build the web client first: cd apps/web-client && rushx build:prod-rootdir")

# 2. Translation files
locales_dir = LAUNCHER_DIR / 'launcher' / 'locales'
if locales_dir.exists():
    for lang_dir in locales_dir.iterdir():
        if lang_dir.is_dir():
            mo_files = lang_dir / 'LC_MESSAGES'
            if mo_files.exists():
                datas.append((str(mo_files), f'launcher/locales/{lang_dir.name}/LC_MESSAGES'))

# Collect binaries
binaries = []

# Caddy binary (must be downloaded first using scripts/download_caddy_for_build.py)
caddy_path = BUNDLED_BINARIES / CADDY_BINARY
if caddy_path.exists():
    binaries.append((str(caddy_path), 'bundled_binaries'))
else:
    print(f"ERROR: Caddy binary not found at {caddy_path}")
    print("Please run: ./scripts/download_caddy_for_build.py")
    sys.exit(1)

# Hidden imports (dependencies that PyInstaller might miss)
hiddenimports = [
    'circus',
    'circus.arbiter',
    'circus.watcher',
    'platformdirs',
    'PyQt6.QtCore',
    'PyQt6.QtGui',
    'PyQt6.QtWidgets',
    'babel.numbers',
    'babel.dates',
]

block_cipher = None

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='librocco-launcher',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=not IS_WINDOWS,  # Show console on Linux/macOS, hide on Windows
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

# Platform-specific settings
if IS_MACOS:
    app = BUNDLE(
        exe,
        name='Librocco Launcher.app',
        icon=None,
        bundle_identifier='com.librocco.launcher',
        info_plist={
            'CFBundleShortVersionString': '1.0.0',
            'NSHighResolutionCapable': True,
        },
    )
