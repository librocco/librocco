#!/bin/bash
# Script to remove Librocco Launcher CA certificates for testing
# Usage: ./remove-test-certs.sh

set -e

echo "=== Removing Librocco Launcher CA Certificates ==="
echo ""

# Check for running browsers (they lock NSS databases)
echo "Checking for running browsers..."
RUNNING_BROWSERS=()

if pgrep -f "chrome" > /dev/null 2>&1; then
    RUNNING_BROWSERS+=("Chrome")
fi

if pgrep -f "firefox" > /dev/null 2>&1; then
    RUNNING_BROWSERS+=("Firefox")
fi

if pgrep -f "brave" > /dev/null 2>&1; then
    RUNNING_BROWSERS+=("Brave")
fi

if [ ${#RUNNING_BROWSERS[@]} -gt 0 ]; then
    echo ""
    echo "⚠️  WARNING: The following browsers are running:"
    for browser in "${RUNNING_BROWSERS[@]}"; do
        echo "   - $browser"
    done
    echo ""
    echo "Browser databases are locked while browsers are running."
    echo "Certificate removal may appear to succeed but will corrupt the databases."
    echo ""
    echo "Please close all browser windows and run this script again."
    echo ""
    exit 1
fi

echo "✓ No browsers running"
echo ""

# 1. Remove system-level certificate
echo "1. Removing system certificate..."
SYSTEM_CERT="/usr/local/share/ca-certificates/librocco-launcher.crt"
if [ -f "$SYSTEM_CERT" ]; then
    sudo rm -f "$SYSTEM_CERT"
    echo "   ✓ Removed $SYSTEM_CERT"

    # Update CA certificates
    sudo update-ca-certificates
    echo "   ✓ Updated system CA certificates"
else
    echo "   - System certificate not found (already removed)"
fi

echo ""

# 2. Remove from Chrome/Chromium/Brave NSS database
echo "2. Removing from Chrome/Chromium/Brave NSS database..."
NSS_DIR="$HOME/.pki/nssdb"
if [ -d "$NSS_DIR" ]; then
    if command -v certutil &> /dev/null; then
        # Check if certificate exists
        if certutil -L -d "sql:$NSS_DIR" 2>/dev/null | grep -q "Librocco Launcher CA"; then
            certutil -D -n "Librocco Launcher CA" -d "sql:$NSS_DIR"
            echo "   ✓ Removed from $NSS_DIR"
        else
            echo "   - Certificate not found in NSS database (already removed or never installed)"
        fi
    else
        echo "   ⚠ certutil not available, skipping NSS database cleanup"
        echo "     Install with: sudo apt install libnss3-tools"
    fi
else
    echo "   - NSS database directory not found"
fi

echo ""

# 3. Remove from Firefox profiles
echo "3. Removing from Firefox profiles..."
FIREFOX_DIR="$HOME/.mozilla/firefox"
if [ -d "$FIREFOX_DIR" ]; then
    FOUND_PROFILES=0
    REMOVED_COUNT=0

    for profile_dir in "$FIREFOX_DIR"/*; do
        if [ -d "$profile_dir" ] && [ -f "$profile_dir/cert9.db" ]; then
            FOUND_PROFILES=1
            profile_name=$(basename "$profile_dir")

            if command -v certutil &> /dev/null; then
                # Check if certificate exists
                if certutil -L -d "sql:$profile_dir" 2>/dev/null | grep -q "Librocco Launcher CA"; then
                    certutil -D -n "Librocco Launcher CA" -d "sql:$profile_dir"
                    echo "   ✓ Removed from Firefox profile: $profile_name"
                    REMOVED_COUNT=$((REMOVED_COUNT + 1))
                fi
            else
                echo "   ⚠ certutil not available, cannot clean Firefox profiles"
                break
            fi
        fi
    done

    if [ $FOUND_PROFILES -eq 0 ]; then
        echo "   - No Firefox profiles found"
    elif [ $REMOVED_COUNT -eq 0 ]; then
        echo "   - Certificate not found in any Firefox profiles (already removed or never installed)"
    fi
else
    echo "   - Firefox directory not found"
fi

echo ""
echo "=== Certificate Removal Complete ==="
echo ""
echo "You can now test the 'Remove Browser Warning' feature again."
