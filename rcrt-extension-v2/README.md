# RCRT Browser Extension v2

Enterprise-grade browser extension powered by RCRT with semantic search, multi-tab context tracking, and real-time collaboration.

## Features

- **Save Pages as Notes** - Capture web pages with high-quality markdown conversion
- **Semantic Search** - Find notes by meaning, not just keywords (pgvector)
- **Multi-Tab Context** - All tabs tracked, agents see active tab + can search all tabs
- **AI Chat** - Conversation with agents that have full context
- **Real-Time Processing** - 4 agents process notes in parallel (tags, summary, insights, ELI5)
- **Collaboration** - Multi-user workspaces with real-time SSE updates
- **Dashboard Integration** - View notes in 3D knowledge graph
- **Unlimited Storage** - PostgreSQL backend (no 10MB limit)

## Installation

### Prerequisites

- RCRT server running on `localhost:8081`
- Node.js 18+
- Chrome or Edge browser

### Setup

```bash
# Install dependencies
npm install

# Build extension
npm run build

# Load in Chrome
1. Go to chrome://extensions/
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist` folder
```

## Architecture

See [Design Document](../docs/RCRT_BROWSER_EXTENSION_V2_DESIGN.md) for complete architecture details.

## Development

```bash
# Development mode (watch)
npm run dev

# Type checking
npm run type-check

# Build for production
npm run build
```

## License

Part of the RCRT ecosystem.

