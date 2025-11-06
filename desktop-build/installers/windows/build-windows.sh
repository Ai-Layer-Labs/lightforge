#!/bin/bash
# Build Windows installer with Podman

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="$SCRIPT_DIR/../../dist"

echo "🪟 Building Podman-based Windows installer..."
echo ""

# Find NSIS
MAKENSIS=""
if command -v makensis >/dev/null 2>&1; then
    MAKENSIS="makensis"
elif [ -f "/c/Program Files (x86)/NSIS/makensis.exe" ]; then
    MAKENSIS="/c/Program Files (x86)/NSIS/makensis.exe"
elif [ -f "/c/Program Files/NSIS/makensis.exe" ]; then
    MAKENSIS="/c/Program Files/NSIS/makensis.exe"
else
    echo "❌ NSIS not found!"
    exit 1
fi

echo "✓ Found NSIS: $MAKENSIS"

mkdir -p "$DIST_DIR"

# Build installer
echo "Running makensis..."
"$MAKENSIS" installer.nsi

if [ -f "RCRT-Setup.exe" ]; then
    mv "RCRT-Setup.exe" "$DIST_DIR/"
    echo ""
    echo "✅ Windows installer created!"
    echo "   Location: $DIST_DIR/RCRT-Setup.exe"
    ls -lh "$DIST_DIR/RCRT-Setup.exe"
else
    echo "❌ Installer creation failed"
    exit 1
fi

