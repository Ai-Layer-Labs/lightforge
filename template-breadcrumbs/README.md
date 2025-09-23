# RCRT Template Breadcrumbs System

## Overview

Template breadcrumbs are the teaching mechanism for RCRT. They demonstrate best practices, patterns, and proper use of features like `llm_hints` through working examples.

## Philosophy

> "The best documentation is executable examples"

Templates in RCRT are not just static documentation - they're active breadcrumbs that:
- Agents can discover and learn from
- Demonstrate `llm_hints` usage by using them
- Show patterns through structure
- Evolve based on usage

## Template Types

### 1. Structure Templates (`template.v1`)
Show exact structure for creating specific schema types.

**Example:** `tool-catalog-template.json`
- Shows how to structure a tool catalog
- Demonstrates proper `llm_hints` for tool discovery
- Includes placeholders for customization

### 2. Pattern Guides (`guide.pattern.v1`)
Demonstrate reusable patterns and techniques.

**Example:** `transform-patterns-guide.json`
- Collection of transform patterns
- Shows different transform types (template, jq, extract)
- Includes input/output examples

### 3. Integration Guides (`guide.integration.v1`)
Show how multiple components work together.

**Example:** `agent-learning-guide.json`
- How agents discover and use templates
- Integration between templates and agent behavior
- System-wide learning patterns

### 4. Meta Guides (`guide.meta.v1`)
Teach about the template system itself.

**Example:** `template-creation-guide.json`
- How to create effective templates
- Meta-patterns for self-documentation
- Template system best practices

## How `llm_hints` Work

Every template breadcrumb includes `llm_hints` that demonstrate self-documentation:

```json
{
  "llm_hints": {
    "transform": {
      "summary": {
        "type": "template",
        "template": "Concise description: {{context.key_field}}"
      },
      "key_points": {
        "type": "extract",
        "value": "$.important_array[*].name"
      }
    },
    "mode": "replace"  // LLM sees only transformed view
  }
}
```

### Transform Types

1. **Template** - Handlebars-style string formatting
2. **Extract** - JSONPath field extraction  
3. **JQ** - Complex JSON transformations
4. **Literal** - Static values

### Modes

- `replace` - LLM sees only transformed fields
- `merge` - Transformed fields added to original

## Loading Templates

```bash
# Load all templates into RCRT
node load-template-breadcrumbs.js

# Or import and use programmatically
import { loadTemplateBreadcrumbs } from './load-template-breadcrumbs.js';
await loadTemplateBreadcrumbs();
```

## Agent Integration

Agents can discover templates through subscriptions:

```json
{
  "subscriptions": {
    "selectors": [
      {
        "any_tags": ["template:", "guide:"],
        "schema_name": "template.v1"
      }
    ]
  }
}
```

Then apply learned patterns when creating breadcrumbs.

## Creating New Templates

1. **Identify the Pattern** - What needs teaching?
2. **Choose Template Type** - Structure, pattern, integration, or meta?
3. **Create Clear Structure** - Use placeholders like `{workspace}`
4. **Add Examples** - Concrete usage examples
5. **Include `llm_hints`** - Demonstrate self-documentation
6. **Test** - Create instances from your template

## Benefits

- **Self-Improving** - System learns from templates
- **Consistent** - Shared patterns across all components
- **Discoverable** - Agents find templates automatically
- **Evolvable** - Templates are just breadcrumbs, easy to update
- **LLM-Optimized** - Every template shows proper `llm_hints` usage

## Next Steps

1. Load templates: `node load-template-breadcrumbs.js`
2. View in dashboard: http://localhost:8082
3. Create breadcrumbs following template patterns
4. Watch agents discover and apply patterns
5. Create new templates for your patterns

The template system makes RCRT self-documenting and self-improving!
