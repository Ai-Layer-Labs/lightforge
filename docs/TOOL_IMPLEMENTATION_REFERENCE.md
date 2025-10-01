# Tool Implementation Reference

## How Tools Connect to Code in RCRT

Tool breadcrumbs must reference their code implementation. This creates a discoverable, yet executable system.

## Implementation Types

### 1. Builtin Tools (Bundled with tools-runner)
```json
{
  "implementation": {
    "type": "builtin",
    "runtime": "nodejs",
    "module": "@rcrt-builder/tools",
    "export": "builtinTools.random"
  }
}
```

### 2. External Module
```json
{
  "implementation": {
    "type": "module",
    "runtime": "nodejs",
    "module": "my-custom-tools",
    "export": "myTool",
    "version": "1.0.0"
  }
}
```

### 3. HTTP Endpoint
```json
{
  "implementation": {
    "type": "http",
    "endpoint": "https://api.example.com/tools/my-tool",
    "method": "POST",
    "auth": {
      "type": "bearer",
      "secret": "secret:my-tool-api-key"
    }
  }
}
```

### 4. JavaScript Breadcrumb
```json
{
  "implementation": {
    "type": "breadcrumb",
    "runtime": "javascript",
    "breadcrumb_id": "tool-impl-my-tool-v1",
    "handler": "execute"
  }
}
```

### 5. Container
```json
{
  "implementation": {
    "type": "container",
    "image": "my-org/my-tool:latest",
    "runtime": "docker",
    "port": 8080,
    "path": "/execute"
  }
}
```

## Tool Runner Implementation Lookup

```javascript
class ToolRunner {
  async loadTool(toolBreadcrumb) {
    const { implementation } = toolBreadcrumb.context;
    
    switch (implementation.type) {
      case 'builtin':
        // Load from bundled modules
        const module = await import(implementation.module);
        return getNestedProperty(module, implementation.export);
        
      case 'module':
        // Dynamic import from npm
        const pkg = await import(implementation.module);
        return pkg[implementation.export];
        
      case 'http':
        // Create HTTP wrapper
        return createHttpTool(implementation);
        
      case 'breadcrumb':
        // Load JavaScript from breadcrumb
        const codeBreadcrumb = await client.getBreadcrumb(implementation.breadcrumb_id);
        return createJsRunner(codeBreadcrumb.context.code);
        
      case 'container':
        // Create container client
        return createContainerTool(implementation);
    }
  }
}
```

## Benefits

1. **Discovery**: Tools found via breadcrumbs
2. **Flexibility**: Multiple implementation types
3. **Security**: Clear execution boundaries
4. **Versioning**: Code versions tracked
5. **Distribution**: Tools from any source

## Example: Complete Tool Definition

```json
{
  "schema_name": "tool.v1",
  "title": "PDF Generator",
  "tags": ["tool", "tool:pdf-generator"],
  "context": {
    "name": "pdf-generator",
    "version": "2.0.0",
    
    "implementation": {
      "type": "module",
      "runtime": "nodejs",
      "module": "@company/pdf-tools",
      "export": "generatePDF",
      "version": "2.0.0",
      "requirements": {
        "node": ">=18.0.0",
        "memory": "512MB"
      }
    },
    
    "definition": {
      "inputSchema": {
        "type": "object",
        "properties": {
          "html": { "type": "string" },
          "options": { "type": "object" }
        },
        "required": ["html"]
      },
      "outputSchema": {
        "type": "object",
        "properties": {
          "pdf": { 
            "type": "string",
            "format": "base64",
            "description": "Base64 encoded PDF"
          },
          "pages": { "type": "number" }
        }
      }
    }
  }
}
```

## Tool Discovery Flow

1. **Agent**: "I need a PDF generator"
2. **Search**: Find `tool.v1` breadcrumbs with PDF in description
3. **Select**: Choose tool based on capabilities
4. **Execute**: Tool runner loads implementation
5. **Run**: Execute with proper runtime

This makes tools truly pluggable while maintaining RCRT principles!
