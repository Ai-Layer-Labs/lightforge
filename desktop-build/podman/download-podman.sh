#!/bin/bash
# Download Podman Desktop for Windows and macOS

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLATFORM="${1:-all}"

echo "📥 Downloading Podman Desktop..."
echo ""

# Podman Desktop version
PODMAN_VERSION="1.14.1"
BASE_URL="https://github.com/containers/podman-desktop/releases/download/v${PODMAN_VERSION}"

download_file() {
    local url=$1
    local output=$2
    local description=$3
    
    echo "  Downloading $description..."
    if command -v curl >/dev/null 2>&1; then
        curl -L -o "$output" "$url" || return 1
    elif command -v wget >/dev/null 2>&1; then
        wget -O "$output" "$url" || return 1
    else
        echo "  ✗ Neither curl nor wget found"
        return 1
    fi
    return 0
}

# Download for Windows
if [ "$PLATFORM" = "windows" ] || [ "$PLATFORM" = "all" ]; then
    echo "📦 Podman Desktop for Windows"
    
    # Download Windows installer
    if download_file \
        "$BASE_URL/podman-desktop-${PODMAN_VERSION}-setup.exe" \
        "$SCRIPT_DIR/podman-desktop-windows.exe" \
        "Podman Desktop Windows Installer"; then
        echo "  ✓ Podman Desktop for Windows downloaded"
        size=$(du -h "$SCRIPT_DIR/podman-desktop-windows.exe" | cut -f1)
        echo "    Size: $size"
    else
        echo "  ✗ Download failed"
        echo "    Please download manually from:"
        echo "    https://github.com/containers/podman-desktop/releases/tag/v${PODMAN_VERSION}"
    fi
    echo ""
fi

# Download for macOS
if [ "$PLATFORM" = "mac" ] || [ "$PLATFORM" = "all" ]; then
    echo "📦 Podman Desktop for macOS"
    
    # Download macOS DMG (universal)
    if download_file \
        "$BASE_URL/podman-desktop-${PODMAN_VERSION}-universal.dmg" \
        "$SCRIPT_DIR/podman-desktop-mac.dmg" \
        "Podman Desktop macOS (Universal)"; then
        echo "  ✓ Podman Desktop for macOS downloaded"
        size=$(du -h "$SCRIPT_DIR/podman-desktop-mac.dmg" | cut -f1)
        echo "    Size: $size"
    else
        echo "  ✗ Download failed"
        echo "    Please download manually from:"
        echo "    https://github.com/containers/podman-desktop/releases/tag/v${PODMAN_VERSION}"
    fi
    echo ""
fi

# Download Helium browser
if [ "$PLATFORM" = "windows" ] || [ "$PLATFORM" = "all" ]; then
    echo "📦 Helium Browser for Windows"
    
    HELIUM_VERSION="0.5.8.1"
    HELIUM_URL="https://github.com/imputnet/helium-windows/releases/download/$HELIUM_VERSION/helium_${HELIUM_VERSION}_x64-windows.zip"
    
    if download_file "$HELIUM_URL" "$SCRIPT_DIR/helium-windows.zip" "Helium Windows x64"; then
        echo "  ✓ Helium Windows downloaded"
        size=$(du -h "$SCRIPT_DIR/helium-windows.zip" | cut -f1)
        echo "    Size: $size"
    fi
fi

echo ""
echo "✅ All downloads complete!"
echo ""
echo "📝 Note: Podman Desktop is Docker-compatible and includes:"
echo "  - Podman engine (container runtime)"
echo "  - podman compose (docker-compose replacement)"
echo "  - All necessary dependencies"
echo ""
echo "Next: Build system tray app and create installer"

