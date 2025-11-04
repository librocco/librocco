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

Always choose solutions that will work on Linux, Windows and MacOS. Point out if they won't. Development happens on Linux and MacOS, so make sure to catch Windows incompatibilities early.
