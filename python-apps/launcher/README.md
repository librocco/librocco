# Launcher - Cross-Platform Tray Icon Application

A minimal cross-platform system tray application built with Python 3.13 and PyQt6.

## Features

- Cross-platform support (Linux, macOS, Windows)
- System tray icon with context menu
- Desktop notifications
- Clean and minimal codebase

## Requirements

- Python 3.13+
- PyQt6

## Development Setup

This project uses [uv](https://github.com/astral-sh/uv) for dependency management.

### Install Dependencies

```bash
uv sync
```

### Prepare Bundled Binaries

The launcher bundles both Caddy and Node.js for local development and packaged builds.

```bash
uv run python scripts/download_caddy_for_build.py
uv run python scripts/download_node_for_build.py
```

These scripts download platform-specific binaries into `python-apps/launcher/bundled_binaries/`.

### Run the Application

```bash
uv run python main.py
```

Print manual commands for starting Caddy and the sync server:

```bash
uv run python main.py --print-commands
```

Or activate the virtual environment first:

```bash
source .venv/bin/activate  # On Linux/macOS
# or
.venv\Scripts\activate     # On Windows

python main.py
```

## Usage

Once running, the application will:
1. Show a tray icon in your system tray
2. Display a startup notification
3. Right-click the tray icon to access the menu:
   - **Show Message**: Display a test notification
   - **Quit**: Exit the application

## Project Structure

```
.
main.py              # Main application code
pyproject.toml       # Project configuration and dependencies
README.md            # This file
.python-version      # Python version specification
```

## Customization

### Custom Icon

To use a custom icon instead of the default system icon, replace line 22 in `main.py`:

```python
# Current:
icon = self.app.style().standardIcon(QApplication.Style.StandardPixmap.SP_ComputerIcon)

# Replace with:
from PyQt6.QtGui import QIcon
icon = QIcon("path/to/your/icon.png")
```

### Add More Menu Actions

Add new actions in the `__init__` method of the `TrayApp` class:

```python
custom_action = QAction("My Action", self.menu)
custom_action.triggered.connect(self.my_custom_method)
self.menu.addAction(custom_action)
```

## Platform Notes

### Linux
- Requires a desktop environment with system tray support (GNOME with extensions, KDE Plasma, XFCE, etc.)
- On GNOME, you may need the "AppIndicator" extension

### macOS
- Tray icon appears in the menu bar
- Works on macOS 10.14+

### Windows
- Tray icon appears in the notification area
- Works on Windows 10+

## License

This project is open source and available for any use.
