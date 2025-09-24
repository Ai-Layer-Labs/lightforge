# RCRT Browser Extension Guide

## 🧩 Overview

The RCRT Browser Extension provides a convenient chat interface to interact with your RCRT system directly from your browser. It connects to your local RCRT instance and enables AI-powered conversations with tool execution.

## 🚀 Installation

### Automatic Installation

After running the main setup:
```bash
./install-extension.sh
```

This script will:
- Check if the extension is built
- Build it if necessary (requires Node.js)
- Open the extension folder
- Provide step-by-step installation instructions

### Manual Installation

1. **Build the extension** (if not already built):
   ```bash
   cd extension
   npm install
   npm run build
   ```

2. **Install in Chrome/Edge**:
   - Open `chrome://extensions/` or `edge://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `extension/dist` folder
   - The RCRT icon will appear in your toolbar

3. **Install in Firefox** (temporary):
   - Open `about:debugging`
   - Click "This Firefox"
   - Click "Load Temporary Add-on"
   - Navigate to `extension/dist`
   - Select `manifest.json`

## 📋 Features

### Chat Interface
- **Natural Language**: Talk to RCRT in plain English
- **Context Aware**: Maintains conversation history
- **Real-time**: Live updates via Server-Sent Events (SSE)

### Tool Integration
- **File Storage**: Save and retrieve files
- **Web Search**: Search the internet
- **Code Execution**: Run code snippets
- **Custom Tools**: Any tools registered in RCRT

### Visual Design
- **Dark Theme**: Easy on the eyes
- **Message Types**: 
  - User messages (teal)
  - Assistant responses (gray)
  - Tool invocations (purple)
  - System messages (gray/red)
- **Smooth Animations**: Pleasant interaction feedback

## 🔧 Configuration

The extension automatically connects to:
- **RCRT API**: `http://localhost:8081`
- **Authentication**: JWT-based (automatic)

No manual configuration needed if RCRT is running on default ports.

## 💬 Usage

1. **Click the RCRT icon** in your browser toolbar
2. **Type your message** in the chat input
3. **Press Enter** or click Send
4. **Watch the response** appear in real-time

### Example Conversations

**Basic Chat**:
```
You: Hello! What can you help me with?
Assistant: I can help you with various tasks...
```

**File Operations**:
```
You: Save this text to a file called notes.txt: "Important meeting at 3pm"
Assistant: I'll save that text to notes.txt for you...
[Tool: file-storage] Saving content to notes.txt
```

**Web Search**:
```
You: Search for the latest news about AI
Assistant: I'll search for the latest AI news...
[Tool: web-search] Searching for "latest news about AI"
```

## 🛠️ Troubleshooting

### Extension Not Working?

1. **Check RCRT is running**:
   ```bash
   docker compose ps
   ```
   All services should show as "healthy"

2. **Check browser console** (F12):
   - Look for connection errors
   - Check for CORS issues

3. **Verify API access**:
   ```bash
   curl http://localhost:8081/health
   ```
   Should return "ok"

### Common Issues

**"Connection Failed" Error**:
- Ensure RCRT services are running
- Check if port 8081 is accessible
- Try refreshing the extension

**No Response from Assistant**:
- Check if agent-runner is active
- Verify OpenRouter API key is set
- Look at agent-runner logs: `docker compose logs -f agent-runner`

**Tool Execution Failures**:
- Check tools-runner logs: `docker compose logs -f tools-runner`
- Ensure required API keys are configured

## 🔐 Security

- **Local Only**: Extension only connects to localhost
- **JWT Auth**: Secure token-based authentication
- **No External Data**: All processing happens locally

## 🚧 Development

### Building from Source
```bash
cd extension
npm install
npm run dev    # Development mode with hot reload
npm run build  # Production build
```

### File Structure
```
extension/
├── src/
│   ├── popup/          # Chat UI components
│   ├── lib/            # RCRT client library
│   └── background/     # Service worker
├── manifest.json       # Extension manifest
└── dist/              # Built extension
```

### Modifying the Extension

1. **Change UI**: Edit files in `src/popup/`
2. **Update styling**: Modify Tailwind classes
3. **Add features**: Extend `RCRTExtensionClient`
4. **Test changes**: Run `npm run dev`

## 📝 Tips

1. **Pin the extension** for quick access
2. **Use keyboard shortcuts** (configurable in browser)
3. **Clear chat history** with the Clear button
4. **Expand code blocks** by clicking them
5. **Copy messages** with the copy button

## 🔄 Updates

To update the extension after changes:

1. Pull latest code
2. Rebuild: `cd extension && npm run build`
3. In browser extensions page, click "Reload" button
4. Refresh any open extension popups

## 🤝 Contributing

To contribute to the extension:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

Focus areas for contribution:
- UI/UX improvements
- New tool integrations
- Performance optimizations
- Accessibility features
- Multi-language support
