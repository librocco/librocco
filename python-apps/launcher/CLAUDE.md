# Project Notes for Claude

## PyQt6 Gotchas

### QSystemTrayIcon.isSystemTrayAvailable() requires QApplication
When using PyQt6, `QSystemTrayIcon.isSystemTrayAvailable()` **must** be called after a `QApplication` instance has been created. Calling it before will cause a segmentation fault.

### QStyle Import
Use `QStyle.StandardPixmap` not `QApplication.Style.StandardPixmap`. Import `QStyle` from `PyQt6.QtWidgets`:
```python
from PyQt6.QtWidgets import QStyle
icon = app.style().standardIcon(QStyle.StandardPixmap.SP_ComputerIcon)
```

## Circus Process Supervisor Gotchas

### Circus arbiter requires event loop in thread
Circus/Tornado requires an asyncio event loop when running the arbiter in a background thread. The `_run_arbiter()` method in `daemon_manager.py` already handles this setup - don't call `arbiter.start()` directly without it.

### Circus watcher configuration
- `get_arbiter()` expects watcher configs as **dictionaries**, not `Watcher` objects
- `arbiter.watchers` is a **list**, not a dict - iterate to find watcher by name:
```python
def _get_watcher(self, daemon_name: str):
    for watcher in self.arbiter.watchers:
        if watcher.name == daemon_name:
            return watcher
    return None
```

Always choose solutions that will work on Linux, Windows and MacOS. Point out if they won't. Development happens on Linux and MacOS, so make sure to catch Windows incompatibilities early.
