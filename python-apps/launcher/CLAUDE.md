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
- Don't use Circus streams (`stdout_stream`/`stderr_stream`) - they're not supported on Windows. Instead, configure processes to write logs directly to files (e.g., Caddy's native logging in Caddyfile).

### Cross platform requirements
Always choose solutions that will work on Linux, Windows and MacOS. Point out if they won't. Development happens on Linux and MacOS, so make sure to catch Windows incompatibilities early.


### Quickly get CI output
You can get output of the latest CI run on github with:
gh run list --workflow=python-launcher-ci.yml --limit 1 --json conclusion,status,headBranch,databaseId -q '.[] | "\(.conclusion // .status) -
    \(.headBranch) - \(.databaseId)"' && gh run view $(gh run list --workflow=python-launcher-ci.yml --limit 1 --json databaseId -q '.[0].databaseId') --log-failed

## Internationalization (i18n)

The launcher supports multilingual UI with automatic OS language detection using Babel/gettext.

### Supported Languages
- English (en) - base language
- German (de)
- Italian (it)

### Adding New Translatable Strings
When adding user-facing strings, wrap them with the translation function:
```python
from launcher.i18n import _
label = _("Click Here")
message = _("Error: {0}").format(error_detail)
```

After adding new strings:
1. Extract: `uv run pybabel extract -F babel.cfg -o launcher/locales/launcher.pot .`
2. Update: `uv run pybabel update -i launcher/locales/launcher.pot -d launcher/locales`
3. Edit `.po` files in `launcher/locales/{lang}/LC_MESSAGES/launcher.po`
4. Compile: `uv run pybabel compile -d launcher/locales -D launcher`

### What to Translate
- ✅ All UI elements (menus, dialogs, buttons, status messages)
- ❌ Console output (keep in English for debugging)
- ❌ Log messages (keep in English for debugging)

See `I18N.md` for full documentation.
