# UI Schema Reference

This document describes the `ui_schema` structure used in `tool.code.v1` breadcrumbs to define dynamic, auto-generated configuration UIs in the RCRT dashboard.

## Overview

The `ui_schema` enables tools to declare their configurable parameters and how they should be displayed in the dashboard, eliminating the need for hardcoded UI forms.

## Schema Structure

```typescript
interface UISchema {
  configurable: boolean;           // Whether tool has configurable parameters
  config_fields?: UIConfigField[];  // Array of configuration fields
}
```

## Configuration Field

```typescript
interface UIConfigField {
  key: string;                      // Config key (e.g., 'apiKey', 'temperature')
  label: string;                    // Human-readable label for UI
  type: 'string' | 'number' | 'boolean' | 'secret' | 'json';
  ui_type: 'text' | 'textarea' | 'number' | 'slider' | 'boolean' | 'select' | 'secret-select' | 'json';
  description?: string;             // Help text shown under label
  default_value?: any;              // Default value if not set
  required?: boolean;               // Whether field is required
  placeholder?: string;             // Placeholder text for inputs
  help_text?: string;               // Additional help/hint text
  secret_name?: string;             // Recommended secret name (for secret-select)
  validation?: {
    min?: number;                   // Minimum value (for numbers)
    max?: number;                   // Maximum value (for numbers)
    step?: number;                  // Step size (for sliders/numbers)
    pattern?: string;               // Regex pattern (for strings)
  };
  options?: Array<{                 // Static options for select
    value: any;
    label: string;
  }>;
  options_source?: {                // Dynamic options loading
    type: 'breadcrumb-search' | 'api';
    // For breadcrumb-search:
    schema_name?: string;
    tag?: string;
    value_path?: string;            // JSONPath to extract value
    label_path?: string;            // JSONPath to extract label
    // For api:
    url?: string;
    value_field?: string;
    label_field?: string;
  };
}
```

## UI Field Types

### text
Single-line text input.

**Use for:** API endpoints, URLs, simple text configuration.

```json
{
  "key": "endpoint",
  "label": "API Endpoint",
  "type": "string",
  "ui_type": "text",
  "description": "API server URL",
  "placeholder": "https://api.example.com",
  "required": true
}
```

### textarea
Multi-line text input.

**Use for:** Long descriptions, JSON templates, multi-line configuration.

```json
{
  "key": "systemPrompt",
  "label": "System Prompt",
  "type": "string",
  "ui_type": "textarea",
  "description": "System instructions for the model",
  "placeholder": "You are a helpful assistant...",
  "default_value": ""
}
```

### number
Number input with validation.

**Use for:** Ports, timeouts, counts, any numeric value without a slider.

```json
{
  "key": "maxTokens",
  "label": "Max Tokens",
  "type": "number",
  "ui_type": "number",
  "description": "Maximum tokens per response",
  "default_value": 4000,
  "validation": {
    "min": 1,
    "max": 32000
  }
}
```

### slider
Visual slider with numeric display.

**Use for:** Temperature, confidence, percentages, any value with a well-defined range.

```json
{
  "key": "temperature",
  "label": "Temperature",
  "type": "number",
  "ui_type": "slider",
  "description": "Response creativity (0.0 - 2.0)",
  "default_value": 0.7,
  "validation": {
    "min": 0.0,
    "max": 2.0,
    "step": 0.1
  }
}
```

### boolean
Toggle switch for on/off values.

**Use for:** Feature flags, enable/disable options.

```json
{
  "key": "enableLogging",
  "label": "Enable Logging",
  "type": "boolean",
  "ui_type": "boolean",
  "description": "Log all API requests and responses",
  "default_value": false
}
```

### select
Dropdown with static or dynamic options.

**Use for:** Model selection, provider selection, predefined choices.

**Static Options:**
```json
{
  "key": "provider",
  "label": "Provider",
  "type": "string",
  "ui_type": "select",
  "description": "LLM provider to use",
  "options": [
    { "value": "openai", "label": "OpenAI" },
    { "value": "anthropic", "label": "Anthropic" },
    { "value": "google", "label": "Google" }
  ]
}
```

**Dynamic from Breadcrumbs:**
```json
{
  "key": "defaultModel",
  "label": "Default Model",
  "type": "string",
  "ui_type": "select",
  "description": "Default model when none specified",
  "default_value": "google/gemini-2.0-flash-exp",
  "options_source": {
    "type": "breadcrumb-search",
    "schema_name": "openrouter.models.catalog.v1",
    "tag": "openrouter:models",
    "value_path": "$.context.models[*].id",
    "label_path": "$.context.models[*].name"
  }
}
```

**Dynamic from API:**
```json
{
  "key": "region",
  "label": "Region",
  "type": "string",
  "ui_type": "select",
  "description": "Deployment region",
  "options_source": {
    "type": "api",
    "url": "/api/regions",
    "value_field": "id",
    "label_field": "name"
  }
}
```

### secret-select
Dropdown of available RCRT secrets.

**Use for:** API keys, tokens, passwords, any sensitive configuration.

```json
{
  "key": "apiKey",
  "label": "API Key",
  "type": "secret",
  "ui_type": "secret-select",
  "description": "API key for authentication",
  "required": true,
  "secret_name": "OPENROUTER_API_KEY",
  "help_text": "💡 Recommended secret name: OPENROUTER_API_KEY"
}
```

**Features:**
- Shows all available secrets from RCRT secrets manager
- Recommended secret (via `secret_name`) appears first with a ⭐
- Warning shown if no secrets exist
- Values stored as secret references in config breadcrumbs

### json
JSON editor with syntax highlighting and validation.

**Use for:** Complex objects, nested configuration, structured data.

```json
{
  "key": "headers",
  "label": "Custom Headers",
  "type": "json",
  "ui_type": "json",
  "description": "Additional HTTP headers to send",
  "default_value": {
    "User-Agent": "RCRT-Tool/1.0"
  }
}
```

## Complete Examples

### Simple Tool (No Configuration)

```json
{
  "schema_name": "tool.code.v1",
  "context": {
    "name": "calculator",
    "description": "Perform mathematical calculations",
    "ui_schema": {
      "configurable": false
    }
  }
}
```

### LLM Tool (Complex Configuration)

```json
{
  "schema_name": "tool.code.v1",
  "context": {
    "name": "openrouter",
    "description": "OpenRouter - Access to 100+ LLM models",
    "ui_schema": {
      "configurable": true,
      "config_fields": [
        {
          "key": "apiKey",
          "label": "API Key",
          "type": "secret",
          "ui_type": "secret-select",
          "description": "OpenRouter API key for authentication",
          "required": true,
          "secret_name": "OPENROUTER_API_KEY",
          "help_text": "💡 Recommended secret name: OPENROUTER_API_KEY"
        },
        {
          "key": "defaultModel",
          "label": "Default Model",
          "type": "string",
          "ui_type": "select",
          "description": "Default model when none specified",
          "default_value": "google/gemini-2.0-flash-exp",
          "required": false,
          "options_source": {
            "type": "breadcrumb-search",
            "schema_name": "openrouter.models.catalog.v1",
            "tag": "openrouter:models",
            "value_path": "$.context.models[*].id",
            "label_path": "$.context.models[*].name"
          }
        },
        {
          "key": "maxTokens",
          "label": "Max Tokens",
          "type": "number",
          "ui_type": "number",
          "description": "Maximum tokens per response",
          "default_value": 4000,
          "required": false,
          "validation": {
            "min": 1,
            "max": 32000
          }
        },
        {
          "key": "temperature",
          "label": "Temperature",
          "type": "number",
          "ui_type": "slider",
          "description": "Response creativity (0.0 - 2.0)",
          "default_value": 0.7,
          "required": false,
          "validation": {
            "min": 0.0,
            "max": 2.0,
            "step": 0.1
          }
        }
      ]
    }
  }
}
```

### Local Tool (Simple Configuration)

```json
{
  "schema_name": "tool.code.v1",
  "context": {
    "name": "ollama_local",
    "description": "Ollama - Local LLM inference",
    "ui_schema": {
      "configurable": true,
      "config_fields": [
        {
          "key": "ollamaHost",
          "label": "Ollama Host",
          "type": "string",
          "ui_type": "text",
          "description": "Ollama server endpoint",
          "default_value": "http://localhost:11434",
          "placeholder": "http://localhost:11434",
          "help_text": "URL where Ollama is running"
        },
        {
          "key": "defaultModel",
          "label": "Default Model",
          "type": "string",
          "ui_type": "text",
          "description": "Default Ollama model to use",
          "default_value": "llama3.1:8b",
          "placeholder": "llama3.1:8b",
          "help_text": "Model name (e.g., llama3.1:8b, codellama:7b, mistral)"
        }
      ]
    }
  }
}
```

## Validation

### Client-Side Validation

The dashboard automatically validates:
- **Required fields**: Must have a value
- **Number ranges**: Must be within min/max
- **Patterns**: Must match regex (for strings)
- **JSON syntax**: Must be valid JSON (for json fields)

Validation errors are displayed inline under each field.

### Server-Side Validation

Tools should also validate configuration at runtime and throw descriptive errors if configuration is invalid.

## Best Practices

1. **Use appropriate UI types**: Match the field type to the data (slider for 0-1 ranges, select for predefined choices, etc.)

2. **Provide helpful descriptions**: Users should understand what each field does without reading documentation

3. **Set sensible defaults**: Most users should be able to use the tool without changing configuration

4. **Use secret-select for sensitive data**: Never use text fields for passwords/keys

5. **Leverage dynamic options**: Load model lists, available resources, etc. from breadcrumbs or APIs

6. **Validate inputs**: Set min/max/pattern constraints to prevent invalid configuration

7. **Group related fields**: Order fields logically (required first, then common, then advanced)

8. **Use help_text for tips**: Provide examples, recommendations, or warnings

## Configuration Storage

When a user saves configuration via the dashboard, a `tool.config.v1` breadcrumb is created/updated:

```json
{
  "schema_name": "tool.config.v1",
  "title": "OpenRouter Configuration",
  "tags": ["tool:config", "tool:config:openrouter", "workspace:tools"],
  "context": {
    "tool_name": "openrouter",
    "tool_id": "breadcrumb-id-of-tool",
    "config": {
      "apiKey": "OPENROUTER_API_KEY",        // Secret reference
      "defaultModel": "google/gemini-2.0-flash-exp",
      "maxTokens": 4000,
      "temperature": 0.7
    },
    "last_updated": "2025-10-30T..."
  }
}
```

Tools load this configuration at runtime via:
- Direct `config_id` parameter in tool requests
- Automatic search for `tool:config:{toolname}` tags

## Migration from Hardcoded UI

**Before** (Hardcoded in Dashboard):
```typescript
// In DetailsPanel.tsx
switch (toolName) {
  case 'openrouter':
    return [
      { key: 'apiKey', label: 'API Key', type: 'secret', ... },
      { key: 'model', label: 'Model', type: 'select', ... },
      // ... 50 lines of hardcoded config
    ];
}
```

**After** (Dynamic from Tool Breadcrumb):
```json
// In tool.code.v1 breadcrumb
{
  "ui_schema": {
    "configurable": true,
    "config_fields": [...]
  }
}
```

**Dashboard Code:**
```typescript
// Automatically renders from ui_schema
<DynamicConfigForm tool={tool} config={config} ... />
```

**Benefits:**
- Zero dashboard changes for new tools
- Tools self-document their configuration
- Agents can create configurable tools
- Consistent UX across all tools
- Configuration versioned with tool code

## See Also

- [Tool Configuration Guide](./TOOL_CONFIGURATION.md) - Comprehensive configuration guide
- [Self-Contained Tools](./SELF_CONTAINED_TOOLS.md) - Tool system architecture
- [Migration Status](./MIGRATION_STATUS.md) - Current migration progress

