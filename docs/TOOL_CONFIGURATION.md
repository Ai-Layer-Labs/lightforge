# Tool Configuration Guide

Complete guide to configuring tools in the RCRT system using the dynamic UI schema system.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Configuration Concepts](#configuration-concepts)
4. [Creating Configurable Tools](#creating-configurable-tools)
5. [Using Configuration in Tools](#using-configuration-in-tools)
6. [Dashboard Configuration UI](#dashboard-configuration-ui)
7. [Configuration Best Practices](#configuration-best-practices)
8. [Troubleshooting](#troubleshooting)

## Overview

The RCRT tool configuration system enables:

✅ **Dynamic UI Generation** - Tools define their own configuration UI
✅ **Zero Dashboard Changes** - New tools work automatically
✅ **Type-Safe Validation** - Client and server-side validation
✅ **Secret Management** - Secure handling of API keys and passwords
✅ **Version Control** - Configuration stored as breadcrumbs
✅ **Hot Reloading** - Update configuration without restarting tools

## Quick Start

### 1. Mark Tool as Configurable

Add `ui_schema` to your `tool.code.v1` breadcrumb:

```json
{
  "schema_name": "tool.code.v1",
  "context": {
    "name": "my-tool",
    "description": "My awesome tool",
    "ui_schema": {
      "configurable": true,
      "config_fields": [
        {
          "key": "apiKey",
          "label": "API Key",
          "type": "secret",
          "ui_type": "secret-select",
          "description": "API key for authentication",
          "required": true,
          "secret_name": "MY_TOOL_API_KEY"
        },
        {
          "key": "endpoint",
          "label": "API Endpoint",
          "type": "string",
          "ui_type": "text",
          "default_value": "https://api.example.com",
          "required": false
        }
      ]
    }
  }
}
```

### 2. Load Configuration in Tool

In your tool's `execute` function:

```typescript
export async function execute(input: Input, context: Context): Promise<Output> {
  // Get config from breadcrumb if config_id provided
  let config: any = {};
  if (input.config_id || context.request.trigger_event?.context?.config_id) {
    const configId = input.config_id || context.request.trigger_event?.context?.config_id;
    try {
      const configBreadcrumb = await context.api.getBreadcrumb(configId);
      if (configBreadcrumb.schema_name === 'tool.config.v1') {
        config = configBreadcrumb.context.config || {};
      }
    } catch (error) {
      console.warn(`Failed to load config from ${configId}:`, error);
    }
  }
  
  // Use configuration
  const apiKey = context.secrets[config.apiKey] || context.secrets['MY_TOOL_API_KEY'];
  const endpoint = input.endpoint || config.endpoint || 'https://api.example.com';
  
  // ... rest of tool logic
}
```

### 3. Configure in Dashboard

1. Open RCRT dashboard
2. Find your tool in the canvas
3. Click on it
4. Click "⚙️ Configure" button
5. Fill in configuration fields
6. Click "💾 Save Configuration"

Done! Your tool will now use the saved configuration.

## Configuration Concepts

### Configuration Hierarchy

Configuration values are resolved in this order (first match wins):

1. **Tool Request Input** - Explicit parameters passed to the tool
2. **Config Breadcrumb** - User's saved configuration
3. **Default Value** - Tool's default from `ui_schema`
4. **Fallback** - Hardcoded fallback in tool code

Example:

```typescript
// Input parameter > config > default > fallback
const temperature = 
  input.temperature ??           // 1. From tool request
  config.temperature ??          // 2. From config breadcrumb
  0.7;                          // 3. Fallback default
```

### Configuration Breadcrumbs

When users save configuration, a `tool.config.v1` breadcrumb is created:

```json
{
  "schema_name": "tool.config.v1",
  "title": "My Tool Configuration",
  "tags": ["tool:config", "tool:config:my-tool", "workspace:tools"],
  "context": {
    "tool_name": "my-tool",
    "tool_id": "abc-123",
    "config": {
      "apiKey": "MY_TOOL_API_KEY",      // Secret reference
      "endpoint": "https://api.example.com",
      "maxRetries": 3,
      "timeout": 30000
    },
    "last_updated": "2025-10-30T12:00:00Z"
  }
}
```

### Secret References

API keys and passwords are stored as references to RCRT secrets:

**In config breadcrumb:**
```json
{
  "apiKey": "OPENROUTER_API_KEY"  // Reference to secret name
}
```

**In tool code:**
```typescript
// Resolve secret reference
const apiKey = context.secrets[config.apiKey];
// apiKey now contains the actual secret value
```

**Benefits:**
- Secrets never stored in config breadcrumbs
- Central secret management
- Easy rotation (update secret, all tools use new value)
- Audit trail via secret system

## Creating Configurable Tools

### Field Types and When to Use Them

#### text / textarea
**Use for:** URLs, paths, descriptive text

```json
{
  "key": "systemPrompt",
  "label": "System Prompt",
  "type": "string",
  "ui_type": "textarea",
  "description": "Instructions for the AI model",
  "default_value": "You are a helpful assistant.",
  "placeholder": "Enter your system prompt..."
}
```

#### number
**Use for:** Counts, ports, timeouts, any discrete numeric value

```json
{
  "key": "maxRetries",
  "label": "Max Retries",
  "type": "number",
  "ui_type": "number",
  "description": "Maximum retry attempts",
  "default_value": 3,
  "validation": {
    "min": 0,
    "max": 10
  }
}
```

#### slider
**Use for:** Temperatures, probabilities, percentages (continuous ranges)

```json
{
  "key": "temperature",
  "label": "Temperature",
  "type": "number",
  "ui_type": "slider",
  "description": "Controls randomness (0.0 = deterministic, 2.0 = very random)",
  "default_value": 0.7,
  "validation": {
    "min": 0.0,
    "max": 2.0,
    "step": 0.1
  }
}
```

#### boolean
**Use for:** Feature flags, enable/disable options

```json
{
  "key": "enableCaching",
  "label": "Enable Caching",
  "type": "boolean",
  "ui_type": "boolean",
  "description": "Cache responses to reduce API calls",
  "default_value": true
}
```

#### select (static)
**Use for:** Predefined choices

```json
{
  "key": "strategy",
  "label": "Strategy",
  "type": "string",
  "ui_type": "select",
  "description": "Execution strategy",
  "default_value": "balanced",
  "options": [
    { "value": "fast", "label": "Fast (Lower Quality)" },
    { "value": "balanced", "label": "Balanced" },
    { "value": "quality", "label": "Quality (Slower)" }
  ]
}
```

#### select (dynamic from breadcrumbs)
**Use for:** Model lists, resource lists, anything stored in breadcrumbs

```json
{
  "key": "model",
  "label": "Model",
  "type": "string",
  "ui_type": "select",
  "description": "LLM model to use",
  "default_value": "gpt-4",
  "options_source": {
    "type": "breadcrumb-search",
    "schema_name": "models.catalog.v1",
    "tag": "models:available",
    "value_path": "$.context.models[*].id",
    "label_path": "$.context.models[*].name"
  }
}
```

#### secret-select
**Use for:** API keys, tokens, passwords, any sensitive data

```json
{
  "key": "apiKey",
  "label": "API Key",
  "type": "secret",
  "ui_type": "secret-select",
  "description": "Authentication key",
  "required": true,
  "secret_name": "MY_TOOL_API_KEY",
  "help_text": "💡 Create a secret named MY_TOOL_API_KEY"
}
```

#### json
**Use for:** Complex objects, nested configuration

```json
{
  "key": "customHeaders",
  "label": "Custom Headers",
  "type": "json",
  "ui_type": "json",
  "description": "Additional HTTP headers",
  "default_value": {
    "User-Agent": "RCRT-Tool/1.0"
  }
}
```

### Validation

#### Required Fields

```json
{
  "key": "apiKey",
  "label": "API Key",
  "type": "secret",
  "ui_type": "secret-select",
  "required": true  // ← User must provide this
}
```

#### Numeric Ranges

```json
{
  "key": "timeout",
  "label": "Timeout (ms)",
  "type": "number",
  "ui_type": "number",
  "validation": {
    "min": 1000,    // At least 1 second
    "max": 120000   // At most 2 minutes
  }
}
```

#### String Patterns

```json
{
  "key": "email",
  "label": "Email Address",
  "type": "string",
  "ui_type": "text",
  "validation": {
    "pattern": "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
  }
}
```

## Using Configuration in Tools

### Basic Pattern

```typescript
export async function execute(input: Input, context: Context): Promise<Output> {
  // 1. Load config breadcrumb
  let config: any = {};
  if (input.config_id) {
    const configBreadcrumb = await context.api.getBreadcrumb(input.config_id);
    config = configBreadcrumb.context.config || {};
  }
  
  // 2. Resolve values (input > config > default)
  const apiKey = context.secrets[config.apiKey];
  const endpoint = input.endpoint || config.endpoint || 'https://default.api.com';
  const timeout = input.timeout ?? config.timeout ?? 30000;
  
  // 3. Use configuration
  const response = await fetch(endpoint, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(timeout)
  });
  
  return { /* ... */ };
}
```

### Advanced: Configuration Validation

```typescript
export async function execute(input: Input, context: Context): Promise<Output> {
  // Load config
  const config = await loadConfig(input, context);
  
  // Validate configuration
  if (!config.apiKey) {
    throw new Error('API key is required. Configure the tool in the dashboard.');
  }
  
  const apiKey = context.secrets[config.apiKey];
  if (!apiKey) {
    throw new Error(`Secret '${config.apiKey}' not found. Create it first.`);
  }
  
  if (config.timeout < 1000 || config.timeout > 120000) {
    throw new Error('Timeout must be between 1000 and 120000 ms');
  }
  
  // ... rest of tool logic
}
```

### Advanced: Configuration Defaults Helper

```typescript
function getConfigValue<T>(
  input: any,
  config: any,
  key: string,
  defaultValue: T
): T {
  return input[key] ?? config[key] ?? defaultValue;
}

export async function execute(input: Input, context: Context): Promise<Output> {
  const config = await loadConfig(input, context);
  
  const temperature = getConfigValue(input, config, 'temperature', 0.7);
  const maxTokens = getConfigValue(input, config, 'maxTokens', 4000);
  const model = getConfigValue(input, config, 'model', 'gpt-4');
  
  // ...
}
```

## Dashboard Configuration UI

### User Flow

1. **Find Tool**: User clicks on tool node in dashboard canvas
2. **View Details**: Tool information shown in details panel
3. **Check Configurability**: If `ui_schema.configurable === true`, "⚙️ Configure" button appears
4. **Edit Configuration**: Clicking configure shows dynamic form based on `ui_schema.config_fields`
5. **Validate**: Form validates inputs client-side (required, min/max, patterns)
6. **Save**: Creates/updates `tool.config.v1` breadcrumb
7. **Use**: Tool loads configuration on next execution

### Features

- **Dynamic Form Rendering**: Form automatically generated from `ui_schema`
- **Smart Defaults**: Fields pre-populated with defaults or existing config
- **Inline Validation**: Errors shown immediately as user types
- **Secret Dropdown**: Lists all available secrets, highlights recommended one
- **Model Dropdown**: Automatically populates from model catalogs
- **Help Text**: Descriptions and hints shown for each field
- **Required Indicators**: Required fields marked with red asterisk

### Non-Configurable Tools

If `ui_schema.configurable === false` or no `ui_schema` present:
- No "Configure" button shown
- Tool works with hardcoded defaults or request parameters only

## Configuration Best Practices

### 1. Provide Sensible Defaults

✅ **Good:**
```json
{
  "key": "timeout",
  "label": "Request Timeout",
  "default_value": 30000,  // Most users won't need to change this
  "validation": { "min": 1000, "max": 300000 }
}
```

❌ **Bad:**
```json
{
  "key": "timeout",
  "label": "Request Timeout",
  "required": true  // Forces every user to set this
}
```

### 2. Use Appropriate UI Types

✅ **Good:**
```json
{
  "key": "temperature",
  "ui_type": "slider",  // Visual, easy to understand
  "validation": { "min": 0.0, "max": 2.0, "step": 0.1 }
}
```

❌ **Bad:**
```json
{
  "key": "temperature",
  "ui_type": "text",  // User might enter invalid values
  "validation": { "pattern": "^[0-2]\\.[0-9]$" }
}
```

### 3. Write Clear Descriptions

✅ **Good:**
```json
{
  "label": "Max Tokens",
  "description": "Maximum tokens in response (1 token ≈ 4 characters)",
  "help_text": "Higher values allow longer responses but cost more"
}
```

❌ **Bad:**
```json
{
  "label": "MT",
  "description": "Max toks"
}
```

### 4. Group Related Fields

Order fields logically:
1. Required fields first
2. Common/frequently-changed fields
3. Advanced/rarely-changed fields

```json
{
  "config_fields": [
    // 1. Required
    { "key": "apiKey", "required": true },
    // 2. Common
    { "key": "model" },
    { "key": "temperature" },
    // 3. Advanced
    { "key": "timeout" },
    { "key": "maxRetries" }
  ]
}
```

### 5. Use Secrets for Sensitive Data

✅ **Good:**
```json
{
  "key": "apiKey",
  "type": "secret",
  "ui_type": "secret-select"
}
```

❌ **Bad:**
```json
{
  "key": "apiKey",
  "type": "string",
  "ui_type": "text"  // API key visible in plain text!
}
```

### 6. Validate Configuration

Always validate configuration in tool code:

```typescript
if (!config.apiKey) {
  throw new Error('API key not configured');
}

if (config.maxTokens < 1 || config.maxTokens > 32000) {
  throw new Error('maxTokens must be between 1 and 32000');
}
```

Don't rely solely on client-side validation.

## Troubleshooting

### Configuration Not Loading

**Symptom**: Tool uses defaults instead of saved configuration

**Solution:**
1. Check that tool accepts `config_id` in input schema
2. Verify config breadcrumb exists (search for `tool:config:{toolname}`)
3. Check tool code loads config correctly
4. Look for errors in tool execution logs

### Secret Not Found

**Symptom**: Error "Secret 'XXX' not found"

**Solution:**
1. Create the secret in RCRT secrets manager
2. Ensure secret name matches exactly (case-sensitive)
3. Check secret has not expired
4. Verify tool has permission to access secret

### Invalid Configuration

**Symptom**: Tool fails with validation error

**Solution:**
1. Check configuration values in `tool.config.v1` breadcrumb
2. Verify values meet validation constraints (min/max, pattern)
3. Ensure required fields are present
4. Check for type mismatches (string vs number)

### Form Not Showing

**Symptom**: No "Configure" button in dashboard

**Solution:**
1. Verify `ui_schema.configurable === true` in tool breadcrumb
2. Check `config_fields` array is not empty
3. Ensure tool breadcrumb is `tool.code.v1` schema
4. Refresh dashboard (Ctrl+R)

### Dynamic Options Not Loading

**Symptom**: Select dropdown empty or shows "Loading..."

**Solution:**
1. Check `options_source` configuration
2. Verify breadcrumb schema/tag exists
3. Check JSONPath expressions (`value_path`, `label_path`)
4. Look for errors in browser console
5. Test breadcrumb search manually in API

## See Also

- [UI Schema Reference](./UI_SCHEMA_REFERENCE.md) - Complete field type reference
- [Self-Contained Tools](./SELF_CONTAINED_TOOLS.md) - Tool architecture
- [Migration Status](./MIGRATION_STATUS.md) - Current status

