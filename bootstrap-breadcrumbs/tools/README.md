# Tool Definitions - Moved to Tool Folders!

## 🎯 Clean Design Implemented

Tools are now located WITH their implementations!

**New Location**: `rcrt-visual-builder/packages/tools/src/`

Each tool has its own folder containing:
- `definition.json` ← Bootstrap definition  
- Implementation files ← Tool code
- README.md (optional)
- Tests (optional)

## Structure

```
rcrt-visual-builder/packages/tools/src/
├── calculator/
│   └── definition.json
├── random/
│   └── definition.json
├── echo/
│   └── definition.json
├── timer/
│   └── definition.json
├── workflow/
│   └── definition.json
├── agent-helper/
│   └── definition.json
├── agent-loader/
│   └── definition.json
├── breadcrumb-crud/
│   └── definition.json
├── file-tools/
│   ├── file-storage.ts
│   └── definition.json
├── context-tools/
│   ├── context-builder-tool.ts
│   └── definition.json
├── browser-tools/
│   ├── browser-context-capture-tool.ts
│   └── definition.json
└── llm-tools/
    ├── openrouter.ts
    ├── ollama.ts
    ├── definition-openrouter.json
    └── definition-ollama.json
```

## How Bootstrap Works

`bootstrap.js` now scans tool folders:

```javascript
// Scans: rcrt-visual-builder/packages/tools/src/
// Finds: */definition.json files
// Creates: tool.v1 breadcrumbs
// Result: All tools auto-discovered!
```

## Adding a New Tool

```bash
# 1. Create folder
mkdir rcrt-visual-builder/packages/tools/src/my-tool

# 2. Create definition.json
cat > rcrt-visual-builder/packages/tools/src/my-tool/definition.json
{
  "schema_name": "tool.v1",
  "title": "My Tool",
  "tags": ["tool", "tool:my-tool", "workspace:tools"],
  "context": {
    "name": "my-tool",
    "implementation": {
      "folder": "my-tool"
    },
    "definition": {...}
  }
}

# 3. Create implementation
cat > rcrt-visual-builder/packages/tools/src/my-tool/my-tool.ts
export class MyTool {
  async execute(input, context) {
    return { result: '...' };
  }
}

# 4. Bootstrap
cd bootstrap-breadcrumbs && node bootstrap.js
```

**Done!** Tool is live.

## See Full Documentation

- Tool implementation: `rcrt-visual-builder/packages/tools/`
- Bootstrap process: `bootstrap-breadcrumbs/bootstrap.js`
- Clean design doc: `CLEAN_TOOL_DESIGN_IMPLEMENTED.md`

---

**Tools are now with their code - the clean design you wanted!** ✅