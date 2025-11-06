# tool.code.v1 Schema Documentation

## Overview

The `tool.code.v1` schema defines self-contained tools that execute in a sandboxed Deno runtime. These tools are pure RCRT breadcrumbs containing their complete implementation.

## Schema Structure

```typescript
{
  "schema_name": "tool.code.v1",
  "title": string,
  "tags": string[],  // Must include: "tool", "tool:{name}", "workspace:tools", "self-contained"
  "context": {
    "name": string,
    "description": string,
    "version": string,
    "code": {
      "language": "typescript" | "javascript",
      "source": string  // Tool implementation with execute() function
    },
    "input_schema": object,   // JSON Schema for input
    "output_schema": object,  // JSON Schema for output
    "required_secrets": string[],  // Secret names needed
    "limits": {
      "memory_mb": number,
      "timeout_ms": number,
      "cpu_percent": number
    },
    "permissions": {
      "network": boolean | string[],  // Network access
      "breadcrumbs": {
        "read": string[],   // Schema names readable
        "write": string[]   // Schema names writable
      }
    },
    "examples": Array<{
      "input": object,
      "output": object,
      "description": string
    }>,
    "ui_schema"?: {
      "configurable": boolean,
      "config_fields"?: Array<UIConfigField>
    },
    "subscriptions"?: Array<{
      "schema_name": string,
      "tag"?: string,
      "description": string
    }>,
    "bootstrap"?: {
      "enabled": boolean,
      "mode": "once" | "continuous" | "disabled",
      "priority"?: number,
      "wait_for"?: string[],
      "input"?: object
    }
  }
}
```

## Bootstrap Configuration

The `bootstrap` field controls how a tool behaves during tools-runner startup.

### Fields

#### `enabled` (required)
- **Type**: `boolean`
- **Description**: Whether the tool should auto-start during bootstrap
- **Default**: `false`

#### `mode` (required if enabled)
- **Type**: `"once" | "continuous" | "disabled"`
- **Description**: Execution mode during bootstrap
  - `"once"`: Execute once and exit (e.g., data sync, initialization)
  - `"continuous"`: Keep running (e.g., scheduler, webhook listener)
  - `"disabled"`: Never auto-start
- **Default**: `"disabled"`

#### `priority` (optional)
- **Type**: `number` (0-100)
- **Description**: Execution priority. Higher numbers start first.
- **Default**: `50`
- **Examples**:
  - `100`: Critical system tools (scheduler)
  - `75`: High-priority services (health monitors)
  - `50`: Normal priority (data sync)
  - `25`: Low priority (cleanup tasks)

#### `wait_for` (optional)
- **Type**: `string[]`
- **Description**: Array of tool names this tool depends on. Will wait for these tools to complete before starting.
- **Default**: `[]`
- **Example**: `["scheduler", "health_monitor"]`

#### `input` (optional)
- **Type**: `object`
- **Description**: Input parameters to pass to the tool during bootstrap execution
- **Default**: `{}`
- **Note**: Must conform to tool's `input_schema`

### Bootstrap Trigger Event

Tools executed during bootstrap receive a special trigger event:

```typescript
context.request.trigger_event = {
  schema_name: "system.startup.v1",
  timestamp: "2025-10-30T10:00:00Z"
}
```

Tools can detect bootstrap invocation and behave accordingly:

```typescript
export async function execute(input: Input, context: Context): Promise<Output> {
  const isBootstrap = context.request.trigger_event?.schema_name === 'system.startup.v1';
  
  if (isBootstrap) {
    // Bootstrap-specific logic (e.g., check if initialization needed)
    console.log('Running from bootstrap...');
  }
  
  // ... rest of tool logic
}
```

### Examples

#### Example 1: One-time Initialization Tool

```json
{
  "schema_name": "tool.code.v1",
  "title": "OpenRouter Models Sync Tool",
  "context": {
    "name": "openrouter_models_sync",
    "bootstrap": {
      "enabled": true,
      "mode": "once",
      "priority": 50,
      "input": {
        "force_refresh": false
      }
    }
  }
}
```

**Behavior**: Runs once on startup. Checks if models catalog exists or is stale, syncs if needed.

#### Example 2: Continuous Service Tool

```json
{
  "schema_name": "tool.code.v1",
  "title": "Scheduler Tool",
  "context": {
    "name": "scheduler",
    "bootstrap": {
      "enabled": true,
      "mode": "continuous",
      "priority": 100
    }
  }
}
```

**Behavior**: Starts immediately on bootstrap and runs continuously, checking schedules and publishing tick breadcrumbs.

#### Example 3: Tool with Dependencies

```json
{
  "schema_name": "tool.code.v1",
  "title": "Health Monitor Tool",
  "context": {
    "name": "health_monitor",
    "bootstrap": {
      "enabled": true,
      "mode": "continuous",
      "priority": 75,
      "wait_for": ["scheduler"]
    }
  }
}
```

**Behavior**: Waits for scheduler to start, then begins continuous health monitoring.

#### Example 4: No Bootstrap

```json
{
  "schema_name": "tool.code.v1",
  "title": "Calculator Tool",
  "context": {
    "name": "calculator"
    // No bootstrap field = disabled by default
  }
}
```

**Behavior**: Only executes when explicitly invoked via `tool.request.v1` or event subscription.

### Bootstrap Execution Order

Tools are executed in this order:

1. **Sort by priority** (descending: 100, 75, 50...)
2. **Respect dependencies** (wait_for)
3. **Execute by mode**:
   - `"once"` tools: Execute sequentially, wait for completion
   - `"continuous"` tools: Start and let run in background

### Best Practices

1. **Use `"once"` for idempotent initialization**
   - Data sync that checks if update needed
   - Creating default breadcrumbs if missing
   - One-time setup tasks

2. **Use `"continuous"` for long-running services**
   - Schedulers
   - Webhook listeners
   - Monitoring tools
   - Event processors

3. **Set appropriate priorities**
   - System tools (scheduler): 90-100
   - Services (monitors): 70-89
   - Data sync: 40-60
   - Cleanup: 10-39

4. **Make bootstrap execution idempotent**
   - Check if work is needed before doing it
   - Don't fail if already initialized
   - Use `force_refresh` input parameter for optional forcing

5. **Use `wait_for` for dependencies**
   - If your tool needs scheduler ticks, wait for `"scheduler"`
   - If you query breadcrumbs created by another tool, wait for it

## Subscriptions

Tools can subscribe to breadcrumb events (separate from bootstrap):

```json
"subscriptions": [
  {
    "schema_name": "schedule.tick.v1",
    "tag": "interval:daily",
    "description": "Run every day"
  }
]
```

**Note**: Bootstrap and subscriptions are independent:
- Bootstrap: Runs during tools-runner startup
- Subscriptions: Runs when matching breadcrumbs are created/updated

A tool can have both!

## See Also

- [Schedule System](./SCHEDULE_SYSTEM.md) - Schedule definitions and tick breadcrumbs
- [Dynamic Configuration](../DYNAMIC_CONFIG_IMPLEMENTATION_SUMMARY.md) - UI schema for configuration

