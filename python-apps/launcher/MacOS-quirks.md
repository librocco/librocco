# macOS-Specific Quirks and Solutions

This document details macOS-specific issues encountered during development and their solutions.

## 1. Path with Spaces Issue (CRITICAL)

### Problem
On macOS, the standard user data directory contains spaces:
```
~/Library/Application Support/librocco-launcher/
```

When using Circus process supervisor to launch Caddy via subprocess, paths with spaces cause failures:
```
WARNING:circus:error in 'caddy': [Errno 13] Permission denied: '/Users/monica/Library/Application'
```

The path gets truncated at the space, treating `/Users/monica/Library/Application` as the target instead of the full path `/Users/monica/Library/Application Support/...`.

### Root Cause
Circus (or its underlying subprocess handling) has issues with paths containing spaces, even when properly quoted. This is specifically problematic on macOS where the standard `Application Support` directory inherently contains a space.

### Solution
Use a hidden directory in the user's home folder on macOS instead of the system standard location:

```python
import platform
if platform.system() == "Darwin":
    home = Path.home()
    self.data_dir = home / f".{self.APP_NAME}"
    self.config_dir = home / f".{self.APP_NAME}" / "config"
else:
    # Use platformdirs for Linux/Windows
    self.data_dir = Path(user_data_dir(self.APP_NAME, self.APP_AUTHOR))
    self.config_dir = Path(user_config_dir(self.APP_NAME, self.APP_AUTHOR))
```

**Result:**
- macOS: `~/.librocco-launcher/` (no spaces)
- Linux: `~/.local/share/librocco-launcher/` (no spaces)
- Windows: `%APPDATA%\librocco-launcher\` (no spaces)

### Additional Safeguards
Even with space-free paths, these practices help ensure robustness:

1. **Resolve all paths to absolute paths:**
```python
caddy_binary = self.caddy_binary.resolve()
caddyfile = self.caddyfile.resolve()
```

2. **Explicitly disable shell mode in Circus:**
```python
{
    "shell": False,  # Don't use shell (important for paths with spaces)
    "use_sockets": False,  # Use standard subprocess
}
```

---

## 2. Gatekeeper and Code Signing

### Problem
Downloaded binaries on macOS may be rejected by Gatekeeper, causing "permission denied" errors when executed via subprocess, even if they work when run manually from the terminal.

### Symptoms
- Binary has correct execute permissions (`-rwxr-xr-x`)
- Binary runs fine when executed directly from terminal
- Binary fails with "permission denied" when launched via subprocess
- `spctl -a -v` shows: `rejected, source=no usable signature`

### Solution
Remove the quarantine attribute after downloading:

```python
if platform.system() == "Darwin":
    try:
        subprocess.run(
            ["xattr", "-d", "com.apple.quarantine", str(self.binary_path)],
            capture_output=True,
            check=False,  # Don't fail if attribute doesn't exist
        )
    except Exception:
        pass  # Ignore errors, attribute may not exist
```

**Note:** This is implemented in `launcher/binary_manager.py:130-140`

### Verification
Check if a binary has quarantine attributes:
```bash
xattr -l /path/to/binary
```

Check Gatekeeper status:
```bash
spctl -a -v /path/to/binary
```

Check code signature:
```bash
codesign -dv /path/to/binary
```

---

## 3. Directory Permissions

### Standard Behavior
macOS `~/Library/Application Support/` has restrictive permissions:
```
drwx------+ 53 monica  staff  1696 ~/Library/
```

The `+` indicates extended attributes (ACLs). However, subdirectories created within it are typically user-writable and don't cause issues.

### Our Approach
By using `~/.librocco-launcher/` instead, we avoid any potential ACL complications and follow the Unix convention for hidden application data.

---

## 4. PyQt6 on macOS

### QSystemTrayIcon.isSystemTrayAvailable()
Must be called **after** creating a `QApplication` instance. Calling it before causes a segmentation fault.

**Correct:**
```python
app = QApplication(sys.argv)
if QSystemTrayIcon.isSystemTrayAvailable():
    # Safe to use system tray
```

**Incorrect:**
```python
if QSystemTrayIcon.isSystemTrayAvailable():  # SEGFAULT!
    app = QApplication(sys.argv)
```

---

## 5. Circus Process Supervisor on macOS

### Asyncio Event Loop Required
When running Circus arbiter in a background thread, you must set up an asyncio event loop for that thread:

```python
def _run_arbiter(self) -> None:
    try:
        import asyncio
        asyncio.set_event_loop(asyncio.new_event_loop())
        self.arbiter.start()
    except Exception as e:
        print(f"Arbiter error: {e}")
```

### Watcher Configuration
- Pass watcher configs as **dictionaries**, not `Watcher` objects
- `arbiter.watchers` is a **list**, not a dict - iterate to find watcher by name

---

## Testing on macOS

### Quick Checks
1. Verify Caddy binary location:
```bash
ls -la ~/.librocco-launcher/binaries/caddy
```

2. Check for quarantine attributes:
```bash
xattr -l ~/.librocco-launcher/binaries/caddy
```

3. Test Caddy manually:
```bash
~/.librocco-launcher/binaries/caddy version
```

4. Check logs:
```bash
tail -f ~/.librocco-launcher/logs/caddy-stderr.log
tail -f ~/.librocco-launcher/logs/caddy-stdout.log
```

### Clean Start
To completely reset the launcher:
```bash
rm -rf ~/.librocco-launcher
uv run ./main.py
```

---

## Recommendations for Cross-Platform Development

1. **Avoid paths with spaces** whenever possible, especially when working with subprocess/Circus
2. **Always test on macOS** if you're developing on Linux - macOS has unique quirks
3. **Use `platform.system()` checks** for macOS-specific workarounds
4. **Document platform differences** as they're discovered
5. **Test binary downloads and execution** separately from application logic

---

## Related Files

- `launcher/config.py:17-28` - macOS path configuration
- `launcher/daemon_manager.py:40-81` - Circus watcher with path handling
- `launcher/binary_manager.py:124-140` - Binary permissions and quarantine removal
- `CLAUDE.md` - Additional PyQt6 and Circus gotchas
