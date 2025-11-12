# RCRT Universal Tool Invocation Standard

**Version:** 1.0  
**Date:** November 12, 2025  
**Status:** Production Standard

---

## The Standard (Put in ALL Agent System Prompts)

### Tool Invocation Format

**ALL tool invocations use this exact structure:**

```json
{
  "action": "create",
  "breadcrumb": {
    "schema_name": "agent.response.v1",
    "title": "Response Title",
    "tags": ["agent:response", "session:SESSION_ID"],
    "context": {
      "message": "Your message to the user",
      "tool_requests": [
        {
          "tool": "tool-name",
          "input": {
            /* Tool-specific parameters matching tool's input_schema */
          },
          "requestId": "unique-identifier",
          "return_to_llm": true,
          "config_id": "optional-uuid"
        }
      ]
    }
  }
}
```

### Field Definitions

#### Required Fields

**`tool`** (string, required)
- Tool name from the catalog
- Example: `"openrouter"`, `"calculator"`, `"breadcrumb-create"`
- Must match exactly (case-sensitive)

**`input`** (object, required)
- Tool-specific parameters
- Must conform to tool's `input_schema`
- Can be empty object `{}` if tool has no required inputs

**`requestId`** (string, required)
- Unique identifier for correlating request with response
- Format: `"{tool-name}-{counter}"` or `"{tool-name}-{timestamp}"`
- Examples: `"llm-001"`, `"calc-1731408000"`, `"create-abc123"`
- Used to match tool.response.v1 back to this request

**`return_to_llm`** (boolean, required)
- `true`: Tool result comes back to YOU for processing/reasoning
- `false`: Tool result goes DIRECTLY to user (fire-and-forget)
- **Decision guide:**
  - Simple results → `false` (calculator, echo, timer)
  - Need reasoning → `true` (LLM calls, complex operations)
  - Error handling needed → `true`
  - Multi-step workflows → `true` (for orchestration)

#### Optional Fields

**`config_id`** (string, optional)
- UUID of tool.config.v1 breadcrumb
- Provides: API keys, model settings, custom configuration
- Example: `"abc-123-def-456"` (references LLM config)

---

## Tool Response Handling

### When return_to_llm: true

**You receive:**
```json
{
  "schema_name": "tool.response.v1",
  "tags": ["tool:response", "request:YOUR_REQUEST_ID"],
  "context": {
    "request_id": "YOUR_REQUEST_ID",
    "tool": "tool-name",
    "status": "success" | "error",
    "output": {
      /* Tool-specific output matching tool's output_schema */
    },
    "error": "error message if status=error"
  }
}
```

**Access output fields:**
- `output.content` - For LLM tools
- `output.result` - For calculator
- `output.numbers` - For random
- `output.id` - For breadcrumb operations
- etc. (see tool's output_schema)

**Then you:**
1. Process the result
2. Add reasoning/context
3. Create final agent.response.v1 for user

### When return_to_llm: false

**Tool result goes directly to user** - you won't see it again

**Use for:**
- Simple operations where no reasoning needed
- Fire-and-forget updates
- Final step in workflow

---

## Common Patterns

### Pattern 1: Simple Tool Call

**Use case:** Calculator, echo, timer - single operation

```json
{
  "message": "I'll calculate that for you.",
  "tool_requests": [
    {
      "tool": "calculator",
      "input": {"expression": "25 * 4"},
      "requestId": "calc-001",
      "return_to_llm": false
    }
  ]
}
```

### Pattern 2: LLM Call with Processing

**Use case:** Need to reason about LLM response

```json
{
  "message": "Let me ask an LLM to analyze that code.",
  "tool_requests": [
    {
      "tool": "openrouter",
      "input": {
        "messages": [
          {"role": "system", "content": "Analyze this code for bugs"},
          {"role": "user", "content": "def foo():\n  return bar"}
        ]
      },
      "requestId": "llm-001",
      "return_to_llm": true,
      "config_id": "llm-config-uuid"
    }
  ]
}
```

**When response arrives:**
```json
{
  "message": "The code has a bug: `bar` is undefined. Here's the fix:\n\n```python\ndef foo():\n  return 'bar'\n```",
  "tool_requests": []
}
```

### Pattern 3: Parallel Tool Calls

**Use case:** Multiple independent operations

```json
{
  "message": "I'll check weather and news in parallel.",
  "tool_requests": [
    {
      "tool": "web-search",
      "input": {"query": "London weather"},
      "requestId": "search-weather",
      "return_to_llm": true
    },
    {
      "tool": "web-search",
      "input": {"query": "London news"},
      "requestId": "search-news",
      "return_to_llm": true
    }
  ]
}
```

**Both results come back** → You combine and respond

### Pattern 4: Workflow Orchestration

**Use case:** Multi-step process with dependencies

```json
{
  "message": "I'll run a multi-step calculation workflow.",
  "tool_requests": [
    {
      "tool": "workflow",
      "input": {
        "steps": [
          {
            "id": "num1",
            "tool": "random",
            "input": {"min": 1, "max": 100}
          },
          {
            "id": "num2",
            "tool": "random",
            "input": {"min": 1, "max": 100}
          },
          {
            "id": "sum",
            "tool": "calculator",
            "input": {"expression": "${num1.numbers[0]} + ${num2.numbers[0]}"},
            "dependencies": ["num1", "num2"]
          }
        ]
      },
      "requestId": "workflow-001",
      "return_to_llm": false
    }
  ]
}
```

**Workflow variable interpolation:**
- `${stepId.field}` - Access output from previous step
- `${num1.numbers[0]}` - First random number
- Dependencies ensure execution order

### Pattern 5: Error Handling

**When tool fails:**
```json
{
  "schema_name": "tool.response.v1",
  "context": {
    "status": "error",
    "error": "API rate limit exceeded",
    "tool": "openrouter"
  }
}
```

**You handle:**
```json
{
  "message": "The LLM API is rate-limited. Let me try a local model instead.",
  "tool_requests": [
    {
      "tool": "ollama_local",
      "input": {"messages": [...]},
      "requestId": "llm-002",
      "return_to_llm": true
    }
  ]
}
```

### Pattern 6: Breadcrumb Operations

**Create:**
```json
{
  "tool": "breadcrumb-create",
  "input": {
    "schema_name": "note.v1",
    "title": "Meeting Notes",
    "tags": ["note", "meeting"],
    "context": {"content": "..."}
  },
  "requestId": "create-001",
  "return_to_llm": false
}
```

**Update:**
```json
{
  "tool": "breadcrumb-update",
  "input": {
    "breadcrumb_id": "uuid-from-context",
    "updates": {
      "tags": ["note", "meeting", "important"],
      "context": {"content": "updated content"}
    }
  },
  "requestId": "update-001",
  "return_to_llm": false
}
```

**Search:**
```json
{
  "tool": "breadcrumb-search",
  "input": {
    "query": "meeting notes about project",
    "nn": 5
  },
  "requestId": "search-001",
  "return_to_llm": true
}
```

### Pattern 7: Multi-Step with Intermediate Processing

**Step 1:** Call tool
```json
{
  "message": "Searching for relevant information...",
  "tool_requests": [
    {
      "tool": "breadcrumb-search",
      "input": {"query": "browser automation security"},
      "requestId": "search-001",
      "return_to_llm": true
    }
  ]
}
```

**Step 2:** Process results and call next tool
```json
{
  "message": "Found 3 articles. Let me analyze the security implications.",
  "tool_requests": [
    {
      "tool": "openrouter",
      "input": {
        "messages": [
          {"role": "system", "content": "Analyze security of: ..."},
          {"role": "user", "content": "Articles: ..."}
        ]
      },
      "requestId": "llm-001",
      "return_to_llm": true
    }
  ]
}
```

**Step 3:** Final response
```json
{
  "message": "Based on my analysis: ...",
  "tool_requests": []
}
```

---

## Output Field Access Guide

### Reading Tool Responses

**General pattern:** `output.{field-name}`

**Common fields by tool type:**

**LLM Tools** (openrouter, ollama, venice):
```javascript
output.content        // The AI response text
output.model          // Model used
output.usage.total_tokens  // Token count
output.cost_estimate  // Cost in USD (if available)
```

**Utility Tools** (calculator, random, echo):
```javascript
output.result         // Calculation result (calculator)
output.numbers        // Array of numbers (random)
output.numbers[0]     // First number (random)
output.echo           // Echoed message (echo)
output.waited         // Seconds waited (timer)
```

**Breadcrumb Tools** (breadcrumb-create, breadcrumb-update, breadcrumb-search):
```javascript
output.id             // Breadcrumb UUID (create/update)
output.success        // Boolean success flag
output.breadcrumbs    // Array of results (search)
output.count          // Number of results (search)
output.new_version    // Version after update
```

**Workflow Tool**:
```javascript
output.results        // Object with results by step ID
output.results.step1  // Results from step1
output.results.step2  // Results from step2
output.executionOrder // Array showing execution order
output.errors         // Any errors that occurred
```

**Browser Tool** (astral):
```javascript
output.url            // Current page URL (navigate)
output.title          // Page title (navigate)
output.text           // Extracted text (extract)
output.clicked        // Click success (click)
output.path           // Screenshot path (screenshot)
output.result         // Eval result (evaluate)
```

### Error Response

**ALL tools return this on error:**
```javascript
status: "error"       // Always check this first
error: "message"      // Human-readable error
tool: "tool-name"     // Which tool failed
```

**Check pattern:**
```javascript
if (tool_response.context.status === "error") {
  // Handle error
  error_message = tool_response.context.error;
} else {
  // Process output
  result = tool_response.context.output;
}
```

---

## Tool Invocation Decision Tree

```
┌─────────────────────────────────────────┐
│ Do you need the result to continue?     │
└─────────┬───────────────────────────────┘
          │
    ┌─────┴─────┐
   YES          NO
    │            │
    ↓            ↓
return_to_llm: true    return_to_llm: false
    │                        │
    ↓                        ↓
Examples:              Examples:
- LLM calls            - Calculator (final answer)
- Search then process  - Echo (testing)
- Need to reason       - Timer (just wait)
- Error handling       - Breadcrumb ops (fire-and-forget)
- Multi-step logic     - Approval/rejection actions
```

---

## Tool Conformance Requirements

### Every tool MUST provide:

#### 1. Consistent Naming
- `input_schema` - Defines ALL input parameters
- `output_schema` - Defines ALL output fields
- Both use JSON Schema format

#### 2. Clear Output Structure
```json
{
  "output_schema": {
    "type": "object",
    "properties": {
      "field_name": {
        "type": "string|number|boolean|array|object",
        "description": "What this field contains"
      }
    },
    "required": ["field_name"]
  }
}
```

#### 3. Error Handling
ALL tools return:
```javascript
// Success
{ status: "success", output: {...} }

// Failure
{ status: "error", error: "message", tool: "name" }
```

#### 4. Examples Showing Field Access
```json
{
  "examples": [
    {
      "explanation": "Access result with output.field_name",
      "input": {...},
      "output": {...}
    }
  ]
}
```

---

## Advanced Patterns

### Conditional Logic

**Use multiple tool calls with return_to_llm:**

```json
// Step 1: Get data
{
  "tool_requests": [
    {
      "tool": "breadcrumb-search",
      "input": {"query": "user preferences"},
      "requestId": "search-prefs",
      "return_to_llm": true
    }
  ]
}

// Step 2: Decide based on result
// (When search result arrives, you create new response)
{
  "message": "Found preferences. Proceeding with custom LLM.",
  "tool_requests": [
    {
      "tool": "openrouter",
      "input": {
        "model": "USE_PREFERENCE_FROM_SEARCH_RESULT",
        "messages": [...]
      },
      "requestId": "llm-001",
      "return_to_llm": true
    }
  ]
}
```

### Error Recovery

```json
// Try primary tool
{
  "tool_requests": [
    {
      "tool": "openrouter",
      "input": {...},
      "requestId": "llm-001",
      "return_to_llm": true
    }
  ]
}

// If it fails, you receive error response
// Then retry with fallback:
{
  "message": "Primary LLM failed, trying local model...",
  "tool_requests": [
    {
      "tool": "ollama_local",
      "input": {...},
      "requestId": "llm-002",
      "return_to_llm": true
    }
  ]
}
```

### Result Accumulation

```json
// Call 1
{"tool": "random", "requestId": "r1", "return_to_llm": true}
// → Get result, store in memory

// Call 2
{"tool": "random", "requestId": "r2", "return_to_llm": true}
// → Get result, combine with previous

// Call 3 (final)
{
  "message": "I generated two random numbers: X and Y. Their sum is Z.",
  "tool_requests": [
    {
      "tool": "calculator",
      "input": {"expression": "X + Y"},  // Use accumulated results
      "requestId": "calc-final",
      "return_to_llm": false
    }
  ]
}
```

### Delegation to Specialist Agents

```json
{
  "message": "I'm delegating tool creation to our specialist.",
  "tool_requests": [
    {
      "tool": "breadcrumb-create",
      "input": {
        "schema_name": "tool.creation.request.v1",
        "title": "Tool Request: Counter",
        "tags": ["tool:creation", "assigned-to:tool-creator"],
        "context": {
          "tool_name": "counter",
          "description": "Counts from 1 to 10",
          "requirements": ["Sequential counting", "Return array"],
          "requestedBy": "YOUR_AGENT_ID"
        }
      },
      "requestId": "delegate-001",
      "return_to_llm": false
    }
  ]
}
```

---

## Standard Conformance Checklist

### For Tool Creators

When creating a new tool, ensure:

- [ ] `input_schema` defines ALL parameters with types and descriptions
- [ ] `output_schema` defines ALL output fields with types and descriptions
- [ ] `required` arrays list mandatory fields
- [ ] Examples show HOW to access output fields in explanations
- [ ] Error responses follow standard: `{status: "error", error: "message"}`
- [ ] Success responses follow standard: `{status: "success", output: {...}}`
- [ ] Output matches output_schema EXACTLY
- [ ] Tool name is lowercase-hyphenated (e.g., `web-search`, not `webSearch`)

### For Tool Validators

When validating a tool, check:

- [ ] All input_schema properties have `type` and `description`
- [ ] All output_schema properties have `type` and `description`
- [ ] Examples reference actual output fields (not made-up ones)
- [ ] Error handling returns standard format
- [ ] Code exports `async function execute(input, context)`
- [ ] Permissions match actual needs (not over-permissioned)

---

## Ultra-Compact Tool Catalog Format

### What Agents See (900 tokens for 15 tools)

```
=== TOOLS (15 available) ===

• openrouter: Call LLM via OpenRouter → content, model, usage, cost_estimate
• venice: Privacy-focused LLM → content, model, usage
• ollama_local: Local LLM inference → content, model, usage, cost_estimate
• calculator: Math operations → result, expression, formatted
• random: Generate random numbers → numbers
• echo: Echo input → echo
• timer: Delay/wait → message, waited
• breadcrumb-create: Create breadcrumb → id, success, breadcrumb, error
• breadcrumb-update: Update breadcrumb → success, id, new_version, breadcrumb, error
• breadcrumb-search: Search breadcrumbs → breadcrumbs, count, method
• json-transform: Transform JSON → result, operation
• workflow: Multi-step workflows → results, executionOrder, errors
• scheduler: Schedule tasks → status, schedules_loaded, ticks_published, uptime_ms
• openrouter_models_sync: Sync model catalog → models_count, catalog_id, last_updated, message
• astral: Browser automation → success, url, title, text, clicked, path, size, result, error

INVOCATION: See "Tool Invocation Format" in your system prompt above.
ALL details for input schemas, examples, and error handling are defined in the standard.
```

**Key insight:** Don't repeat invocation instructions per tool - define once in system prompt!

---

## System Prompt Integration

### Add This Block to ALL Agent System Prompts

```
═══════════════════════════════════════════════════════════════════
TOOL INVOCATION STANDARD (UNIVERSAL - ALL AGENTS)
═══════════════════════════════════════════════════════════════════

You can invoke tools using this EXACT structure:

{
  "action": "create",
  "breadcrumb": {
    "schema_name": "agent.response.v1",
    "title": "Response",
    "tags": ["agent:response", "session:SESSION_ID"],
    "context": {
      "message": "Your message to user",
      "tool_requests": [
        {
          "tool": "tool-name",           // Tool name from catalog
          "input": {...},                // Tool-specific parameters
          "requestId": "unique-id",      // For correlation
          "return_to_llm": true/false,   // Response routing
          "config_id": "uuid"            // Optional config reference
        }
      ]
    }
  }
}

FIELDS EXPLAINED:

• tool: Exact tool name from catalog (case-sensitive)
• input: Object matching tool's input requirements
• requestId: Unique ID for this invocation (format: "{tool}-{counter}")
• return_to_llm: 
    - true  → Result comes back to YOU for processing
    - false → Result goes DIRECTLY to user (fire-and-forget)
• config_id: Optional UUID of tool.config.v1 for API keys, settings

RETURN_TO_LLM DECISION:
- Use true when: You need to process result, handle errors, or continue multi-step logic
- Use false when: Simple final answer, fire-and-forget operations

OUTPUT ACCESS:
When return_to_llm: true, you receive tool.response.v1:
{
  "context": {
    "status": "success" | "error",
    "output": {/* fields from tool's output_schema */},
    "error": "message if failed"
  }
}

Access output: output.field_name (see tool's output schema in catalog)

ERROR HANDLING:
If status === "error":
  - Read error message: output.error
  - Decide: Retry with different tool, inform user, or try workaround

WORKFLOWS:
Use workflow tool for multi-step processes:
- Define steps with IDs
- Use dependencies: ["step1", "step2"]
- Access previous results: ${stepId.field}
- Example: ${randomStep.numbers[0]}

PARALLEL CALLS:
Include multiple objects in tool_requests array - they execute in parallel:
[
  {tool: "search1", ...},
  {tool: "search2", ...}
]

═══════════════════════════════════════════════════════════════════
```

---

## Tool Catalog llm_hints (Final Version)

### File: bootstrap-breadcrumbs/schemas/tool-catalog-v1.json

```json
{
  "schema_name": "schema.def.v1",
  "title": "Tool Catalog Schema Definition",
  "tags": ["schema:definition", "system:bootstrap", "defines:tool.catalog.v1"],
  "context": {
    "defines_schema": "tool.catalog.v1",
    "category": "tools"
  },
  "llm_hints": {
    "transform": {
      "formatted": {
        "type": "template",
        "template": "=== TOOLS ({{activeTools}} available) ===\n\n{{#each tools}}• {{name}}: {{description}} → {{#if outputSchema.properties}}{{#each outputSchema.properties}}{{@key}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}object{{/if}}\n{{/each}}\n\nINVOCATION: See \"Tool Invocation Format\" in your system prompt above.\nALL details for inputs, outputs, examples, and error handling are in the standard."
      }
    },
    "exclude": [
      "tools[*].inputSchema",
      "tools[*].examples",
      "tools[*].capabilities",
      "tools[*].lastSeen",
      "tools[*].version",
      "tools[*].status",
      "workspace",
      "totalTools",
      "lastUpdated",
      "llm_hints"
    ],
    "mode": "replace"
  }
}
```

**Result:** 15 tools × 60 tokens = **900 tokens** (vs 8,000 currently!)

**Reduction:** **89%** 🎯

---

## Migration Plan

### Step 1: Update Tool Catalog llm_hints (30 min)
- Fix template to reference actual fields
- Add exclude list for verbose fields
- Test with GET /breadcrumbs/{catalog-id}

### Step 2: Update Agent System Prompts (1 hour)
- Add Universal Tool Invocation Standard block
- Remove per-tool invocation examples
- Standardize across all agents

### Step 3: Validate All Tools (2 hours)
- Ensure output_schema matches actual outputs
- Verify examples show field access patterns
- Check error responses follow standard

### Step 4: Bootstrap & Test (30 min)
- Run: `cd bootstrap-breadcrumbs && node bootstrap.js`
- Test chat with various tool invocations
- Verify context size reduction

---

## Success Metrics

### Before
- Tool catalog: 8,000-10,000 tokens
- Total context: 11,000-15,000 tokens
- Catalog: 70-80% of context

### After
- Tool catalog: 900-1,500 tokens
- Total context: 3,900-6,900 tokens
- Catalog: 23-31% of context

**Improvement:** 
- **89% catalog reduction**
- **65-74% total context reduction**
- **More room for knowledge and conversation history**

---

## Benefits of This Approach

✅ **One source of truth** - Standard defined once in system prompt  
✅ **Ultra-compact catalog** - Just tool names + output fields  
✅ **No repetition** - Invocation details not repeated per tool  
✅ **Consistent** - All agents use same format  
✅ **Flexible** - Handles simple to complex tool patterns  
✅ **Scalable** - Adding tools doesn't bloat context  
✅ **Maintainable** - Update standard once, affects all tools  

---

## Next Steps

1. **Review this standard** - Ensure it covers all your tool patterns
2. **Update tool-catalog-v1.json** - Implement ultra-compact llm_hints
3. **Update agent system prompts** - Add universal standard block
4. **Bootstrap and test** - Verify 89% reduction
5. **Validate all tools** - Ensure conformance

**Ready to implement?** This will solve your context bloat problem immediately! 🚀

