#!/bin/bash
# RCRT Browser Extension Installation Helper

echo "🧩 RCRT Browser Extension Installer"
echo "==================================="
echo ""

# Check if extension is built
if [ ! -d "extension/dist" ]; then
    echo "⚠️  Extension not built yet. Building now..."
    
    # Check for Node.js
    if ! command -v npm >/dev/null 2>&1; then
        echo "❌ Node.js is required but not installed."
        echo "   Please install Node.js from https://nodejs.org/"
        exit 1
    fi
    
    # Build extension
    echo "📦 Installing dependencies..."
    (cd extension && npm install) || {
        echo "❌ Failed to install dependencies"
        exit 1
    }
    
    echo "🔨 Building extension..."
    (cd extension && npm run build) || {
        echo "❌ Failed to build extension"
        exit 1
    }
    
    echo "✅ Extension built successfully!"
fi

# Get absolute path
EXTENSION_PATH=$(cd extension/dist && pwd)

echo ""
echo "✅ Extension is ready at: $EXTENSION_PATH"
echo ""
echo "📋 Installation Instructions:"
echo ""
echo "For Chrome:"
echo "  1. Open chrome://extensions/"
echo "  2. Enable 'Developer mode' (toggle in top right)"
echo "  3. Click 'Load unpacked'"
echo "  4. Navigate to: $EXTENSION_PATH"
echo "  5. Select this folder and click 'Select Folder'"
echo ""
echo "For Edge:"
echo "  1. Open edge://extensions/"
echo "  2. Enable 'Developer mode' (toggle on left side)"
echo "  3. Click 'Load unpacked'"
echo "  4. Navigate to: $EXTENSION_PATH"
echo "  5. Select this folder and click 'Select Folder'"
echo ""
echo "For Firefox (Developer Edition):"
echo "  1. Open about:debugging"
echo "  2. Click 'This Firefox'"
echo "  3. Click 'Load Temporary Add-on'"
echo "  4. Navigate to: $EXTENSION_PATH"
echo "  5. Select the manifest.json file"
echo ""
echo "🚀 After installation:"
echo "  - Look for the RCRT icon in your browser toolbar"
echo "  - Click it to open the chat interface"
echo "  - Start chatting with your AI assistant!"
echo ""
echo "💡 Tips:"
echo "  - Pin the extension for easy access"
echo "  - The extension connects to your local RCRT at localhost:8081"
echo "  - Make sure RCRT services are running (docker compose up -d)"

# Open file explorer at the extension directory (Windows/Mac/Linux)
echo ""
echo "📂 Opening extension folder..."
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    # Windows
    explorer "$(cygpath -w "$EXTENSION_PATH")"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    open "$EXTENSION_PATH"
elif command -v xdg-open >/dev/null 2>&1; then
    # Linux with xdg-open
    xdg-open "$EXTENSION_PATH"
else
    echo "   Please navigate to: $EXTENSION_PATH"
fi
