# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file for Librocco Launcher.

This spec file bundles the launcher application with all necessary dependencies:
- Node.js binary (pre-downloaded to bundled_binaries/)
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
BUNDLED_SYNCSERVER = LAUNCHER_DIR / 'bundled_syncserver'

# Binary names
CADDY_BINARY = 'caddy.exe' if IS_WINDOWS else 'caddy'
NODE_BINARY = 'node.exe' if IS_WINDOWS else 'node'

# Collect data files
datas = []

# 1. Web client build directory (served by Caddy)
# Explicitly collect all files in the directory recursively
if WEB_CLIENT_BUILD.exists():
    # Manually add all files in the web client build directory
    for file_path in WEB_CLIENT_BUILD.rglob('*'):
        if file_path.is_file():
            # Get relative path from web client build dir
            rel_path = file_path.relative_to(WEB_CLIENT_BUILD)
            # Add as (source, destination_dir)
            datas.append((str(file_path), str(Path('app') / rel_path.parent)))
    print(f"INFO: Collected {len([d for d in datas if 'app' in str(d[1])])} web client files")
else:
    print(f"WARNING: Web client build not found at {WEB_CLIENT_BUILD}")
    print("Please build the web client first: cd apps/web-client && rushx build:prod-rootdir")

# 2. Sync server bundle (Node.js sync server with dependencies)
# Explicitly collect all files in the sync server directory
if BUNDLED_SYNCSERVER.exists():
    for file_path in BUNDLED_SYNCSERVER.rglob('*'):
        if file_path.is_file():
            rel_path = file_path.relative_to(BUNDLED_SYNCSERVER)
            datas.append((str(file_path), str(Path('bundled_binaries/syncserver') / rel_path.parent)))
    print(f"INFO: Collected {len([d for d in datas if 'syncserver' in str(d[1])])} sync server files")
else:
    print(f"WARNING: Sync server bundle not found at {BUNDLED_SYNCSERVER}")
    print("Please run: ./scripts/package_syncserver_for_build.py")

# 3. Translation files
locales_dir = LAUNCHER_DIR / 'launcher' / 'locales'
if locales_dir.exists():
    for lang_dir in locales_dir.iterdir():
        if lang_dir.is_dir():
            mo_files = lang_dir / 'LC_MESSAGES'
            if mo_files.exists():
                datas.append((str(mo_files), f'launcher/locales/{lang_dir.name}/LC_MESSAGES'))

# 4. Favicon for tray icon
favicon_path = PROJECT_ROOT / 'assets' / 'favicon.svg'
if favicon_path.exists():
    datas.append((str(favicon_path), 'assets'))
else:
    print(f"WARNING: Favicon not found at {favicon_path}")
    print("Tray icon will not work without the favicon.")

# Collect binaries
binaries = []

# Node.js binary (must be downloaded first using scripts/download_node_for_build.py)
node_path = BUNDLED_BINARIES / NODE_BINARY
if node_path.exists():
    binaries.append((str(node_path), 'bundled_binaries'))
else:
    print(f"ERROR: Node.js binary not found at {node_path}")
    print("Please run: ./scripts/download_node_for_build.py")
    sys.exit(1)

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
    console=IS_WINDOWS or IS_LINUX,  # Hide console on macOS (GUI-only app), show on Windows/Linux
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
            'LSUIElement': '1',  # Run as menu bar app only (no Dock icon, no empty menu bar)
        },
    )
