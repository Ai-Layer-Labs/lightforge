# Self-Contained Tools System

## Overview

RCRT now supports **self-contained tools** stored as breadcrumbs (`tool.code.v1`) that execute in a sandboxed Deno runtime. This enables the system to create, manage, and execute tools completely self-contained without requiring code deployments.

## Key Features

### 🔒 **Sandboxed Execution**
- Tools run in isolated Deno processes with granular permissions
- Network access limited to specific domains
- No filesystem or subprocess access by default
- Resource limits (timeout, memory, CPU)

### 📦 **Breadcrumb Storage**
- Tool code stored as `tool.code.v1` breadcrumbs
- Version-controlled and searchable
- Includes code, schemas, permissions, examples, and limits

### 🔄 **Parallel Migration**
- Old (`tool.v1`) and new (`tool.code.v1`) systems run simultaneously
- Automatic routing: prefers `tool.code.v1`, falls back to `tool.v1`
- Zero downtime migration path

### 🛡️ **Multi-Layer Validation**
- **Code Validator**: Checks for dangerous patterns, required exports
- **Schema Validator**: Validates input/output schemas and examples
- **Permission Validator**: Enforces security rules

### 🎯 **Agent-Creatable**
- Agents can create tools using `tool.create.request.v1` breadcrumbs
- System validates and deploys tools automatically
- Full RCRT API access within tools via serialized context

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                      tools-runner                            │
│                                                              │
│  ┌──────────────┐              ┌─────────────────────┐     │
│  │  ToolLoader  │              │  DenoToolRuntime    │     │
│  │              │              │                     │     │
│  │ - tool.v1    │──────────────│ - tool.code.v1      │     │
│  │ - tool.code.v1│  (routing)  │ - DenoExecutor      │     │
│  └──────────────┘              │ - ExecutionQueue    │     │
│                                │ - ContextSerializer │     │
│                                └─────────────────────┘     │
│                                         │                   │
│                                         ▼                   │
│                                  ┌────────────┐            │
│                                  │ Deno Process│            │
│                                  │ (Sandboxed) │            │
│                                  └────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Tool Request** arrives as `tool.request.v1` breadcrumb
2. **ToolLoader** checks for `tool.code.v1` first, then `tool.v1`
3. If `tool.code.v1`:
   - **DenoToolRuntime** loads tool definition
   - **ContextSerializer** builds execution context
   - **DenoExecutor** spawns sandboxed Deno process
   - Tool executes with limited permissions
   - Result returned as `tool.response.v1` breadcrumb
4. If `tool.v1`: Falls back to legacy execution

## Tool Definition Schema

### `tool.code.v1` Breadcrumb Structure

```json
{
  "schema_name": "tool.code.v1",
  "title": "My Tool",
  "tags": ["tool", "tool:my-tool", "workspace:tools"],
  "context": {
    "name": "my-tool",
    "description": "What the tool does",
    "version": "1.0.0",
    "code": {
      "language": "typescript",
      "source": "export async function execute(input, context) { ... }"
    },
    "input_schema": {
      "type": "object",
      "properties": { ... },
      "required": [...]
    },
    "output_schema": {
      "type": "object",
      "properties": { ... }
    },
    "permissions": {
      "net": ["api.example.com"],
      "read": false,
      "write": false,
      "env": false,
      "run": false
    },
    "limits": {
      "timeout_ms": 30000,
      "memory_mb": 128,
      "cpu_percent": 50
    },
    "required_secrets": ["API_KEY"],
    "examples": [
      {
        "description": "Example usage",
        "input": { ... },
        "output": { ... },
        "explanation": "..."
      }
    ]
  }
}
```

### Tool Code Requirements

Every tool must export an async `execute` function:

```typescript
interface Input {
  // Your input fields
}

interface Output {
  // Your output fields
}

interface Context {
  secrets: Record<string, string>;
  api: RcrtApi;  // HTTP API wrapper
  request: {
    id: string;
    workspace: string;
    agentId?: string;
  };
}

export async function execute(input: Input, context: Context): Promise<Output> {
  // Tool implementation
  return { ... };
}
```

## RCRT API Access

Tools can interact with RCRT through the injected `context.api`:

```typescript
// Get a breadcrumb
const breadcrumb = await context.api.getBreadcrumb(id);

// Create a breadcrumb
const result = await context.api.createBreadcrumb({
  schema_name: 'result.v1',
  title: 'Result',
  tags: ['result'],
  context: { data }
});

// Update a breadcrumb
await context.api.updateBreadcrumb(id, version, { context: { updated: true } });

// Search breadcrumbs
const results = await context.api.searchBreadcrumbs({
  schema_name: 'user.message.v1',
  tag: 'workspace:tools'
});

// Vector search
const matches = await context.api.vectorSearch({
  q: 'search query',
  nn: 5,
  schema_name: 'document.v1'
});
```

## Security Model

### Permission Types

- **`net`**: Network access
  - `false`: No network access
  - `true`: All network access (not recommended)
  - `["domain1.com", "api.example.com"]`: Specific domains only
  
- **`read`**: Filesystem read (generally blocked for user tools)
- **`write`**: Filesystem write (generally blocked for user tools)
- **`env`**: Environment variables (use `context.secrets` instead)
- **`run`**: Subprocess execution (blocked for user tools)
- **`ffi`**: Foreign Function Interface (never allowed)
- **`hrtime`**: High-resolution timing (blocked to prevent timing attacks)

### Validation Rules

1. **Code Validation**:
   - No `eval()`, `Function()`, or dynamic imports
   - No `require()` or filesystem access
   - Must export `execute` function
   - No dangerous Node.js APIs

2. **Permission Validation**:
   - Max 5 network domains
   - No private/local network access (localhost, 127.0.0.1, 192.168.*, etc.)
   - No filesystem or subprocess access for user tools

3. **Schema Validation**:
   - Input/output schemas must be valid JSON Schema
   - All properties should have descriptions
   - Required fields must exist in properties
   - At least one example required

## Resource Limits

```json
{
  "limits": {
    "timeout_ms": 30000,     // Max execution time (required)
    "memory_mb": 128,        // Max memory usage (optional)
    "cpu_percent": 50        // Max CPU usage (optional)
  }
}
```

- **timeout_ms**: Tool execution is killed after this duration
- **memory_mb**: Memory limit (future implementation)
- **cpu_percent**: CPU throttling (future implementation)

## Migrated Tools

The following tools have been migrated to `tool.code.v1`:

### Simple Tools
- ✅ **calculator** - Mathematical calculations
- ✅ **echo** - Testing/debugging
- ✅ **timer** - Delays/timeouts
- ✅ **random** - Random number generation

### Complex Tools (In Progress)
- ⏳ **openrouter** - LLM API integration
- ⏳ **context-builder** - Context assembly
- ⏳ **ollama** - Local LLM integration
- ⏳ **browser-context-capture** - Browser state capture

## Tool Templates

RCRT provides standardized templates for common tool types:

1. **HTTP API Tool** (80% of tools)
   - External API calls
   - Authentication handling
   - Response mapping

2. **RCRT Data Tool**
   - Breadcrumb search/manipulation
   - Context assembly
   - Data aggregation

3. **Transform Tool**
   - Data format conversion
   - Calculations
   - Pure functions

4. **Async Event Tool**
   - Multi-step workflows
   - Event correlation
   - Request/response patterns

See `docs/TOOL_CREATION_GUIDE.md` for detailed templates and examples.

## Usage

### For Users

Tools are automatically available once loaded. Simply invoke them:

```json
{
  "schema_name": "tool.request.v1",
  "tags": ["tool:request", "workspace:tools"],
  "context": {
    "tool": "calculator",
    "input": {
      "expression": "2 + 2"
    },
    "requestId": "req-123"
  }
}
```

### For Developers

1. **Create Tool Definition**:
   ```bash
   # Add JSON file to bootstrap-breadcrumbs/tools-self-contained/
   vi bootstrap-breadcrumbs/tools-self-contained/my-tool.json
   ```

2. **Bootstrap System**:
   ```bash
   cd bootstrap-breadcrumbs
   node bootstrap.js
   ```

3. **Tool is Live**:
   Tools are immediately available after bootstrap.

### For Agents

Agents can create tools using `tool.create.request.v1` breadcrumbs:

```json
{
  "schema_name": "tool.create.request.v1",
  "tags": ["tool:request", "workspace:tools"],
  "context": {
    "request_id": "uuid",
    "agent_id": "agent-123",
    "tool_spec": {
      "name": "my-new-tool",
      "description": "...",
      "code": { "language": "typescript", "source": "..." },
      "input_schema": { ... },
      "output_schema": { ... },
      "permissions": { ... },
      "examples": [ ... ]
    }
  }
}
```

System responds with `tool.create.response.v1` containing validation results and tool ID.

## Setup

### Requirements

- **Deno**: Installed in tools-runner container (automatic with Docker)
- **Node.js**: For bootstrap script
- **RCRT**: Version 2.0+ with breadcrumb system

### Installation

1. **Docker** (Recommended):
   ```bash
   ./setup.sh
   ```
   - Deno is automatically installed in tools-runner container
   - Self-contained tools work out-of-the-box

2. **Local Development**:
   ```bash
   # Install Deno
   curl -fsSL https://deno.land/install.sh | sh
   
   # Start tools-runner
   cd rcrt-visual-builder/apps/tools-runner
   pnpm run dev
   ```

### Verification

Check tools-runner logs for:
```
🦕 Initializing Deno Tool Runtime...
✅ Deno runtime initialized with 4 self-contained tools
```

## Migration Strategy

### Phase 1: Foundation ✅
- Deno runtime implementation
- Validators and security
- Context serialization

### Phase 2: Parallel Execution ✅
- Load both tool.v1 and tool.code.v1
- Route to appropriate executor
- Graceful fallback

### Phase 3: Simple Tools ✅
- Migrate calculator, echo, timer, random
- Validate approach
- Gather feedback

### Phase 4: Complex Tools ⏳
- Migrate OpenRouter (API keys, secrets)
- Migrate Context Builder (state management)
- Migrate remaining tools

### Phase 5: Agent Tool Creation 📋
- Implement tool.create.request.v1 flow
- Add validation and deployment pipeline
- Enable full self-service

### Phase 6: Deprecation 📋
- Remove tool.v1 support
- Clean up legacy code
- Update documentation

## Performance

### Benchmarks

- **Cold Start**: ~100ms (Deno process spawn)
- **Warm Execution**: ~10ms (cached Deno instance)
- **Concurrency**: 5 parallel executions by default
- **Memory**: ~30MB per Deno process

### Optimization

1. **Process Pooling**: Reuse Deno processes (future)
2. **Code Caching**: Cache compiled code (future)
3. **Concurrency Tuning**: Adjust via `ExecutionQueue`

## Troubleshooting

### "Deno not found"
```
⚠️ Deno runtime initialization failed
```
**Solution**: Install Deno or rebuild Docker image

### "Permission denied"
```
Failed to execute: Network access denied
```
**Solution**: Add required domains to `permissions.net`

### "Timeout"
```
Tool execution timed out after 30000ms
```
**Solution**: Increase `limits.timeout_ms` or optimize tool code

### "Invalid tool code"
```
Code must export an async function named "execute"
```
**Solution**: Ensure proper function signature:
```typescript
export async function execute(input, context) { ... }
```

## Future Enhancements

- **Process Pooling**: Reuse Deno processes for better performance
- **Hot Reload**: Update tools without restart
- **Debug Mode**: Enhanced logging and tracing
- **Visual Editor**: GUI for tool creation
- **Marketplace**: Share tools across RCRT instances
- **TypeScript Types**: Generate types from schemas
- **Testing Framework**: Built-in tool testing utilities

## References

- [Deno Manual](https://deno.land/manual)
- [JSON Schema](https://json-schema.org/)
- [RCRT Principles](./RCRT_PRINCIPLES.md)
- [Tool Creation Guide](./TOOL_CREATION_GUIDE.md)
- [API Reference](./QUICK_REFERENCE.md)

