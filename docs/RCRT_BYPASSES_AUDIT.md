# RCRT Bypasses Audit - What Else Is Wrong?

## Bypasses Found

### 1. ✅ FIXED: ToolPromptAdapter
**Location:** `packages/runtime/src/agent/tool-prompt-adapter.ts`  
**Issue:** Manually transforming tool catalog instead of using llm_hints  
**Status:** DELETED ✅

### 2. ⚠️ Manual Context Formatting in Agent
**Location:** `packages/runtime/src/agent/agent-executor.ts` line 142  
**Issue:**
```javascript
content: `Context:\n${JSON.stringify(context, null, 2)}\n\nUser message: ${userMessage}`
```

**Should be:**
```javascript
// Create a breadcrumb for the LLM request with llm_hints
{
  "context": {
    "tools": [...],
    "history": [...],
    "userMessage": "..."
  },
  "llm_hints": {
    "transform": {
      "llm_prompt": {
        "type": "template",
        "template": "Context:\n{{{json context.tools}}}\n\nHistory:\n{{{json context.history}}}\n\nUser: {{context.userMessage}}"
      }
    }
  }
}

// Then use the transformed field
content: requestContext.llm_prompt
```

**Why it's wrong:** Manually stringifying JSON instead of using RCRT's template system

### 3. ⚠️ Manual Chat History Transformation
**Location:** `packages/runtime/src/agent/agent-executor.ts` lines 376-393  
**Issue:**
```javascript
// Manually mapping breadcrumbs to chat format
const chatHistory = allMessages.map(msg => {
  if (msg.schema_name === 'user.message.v1') {
    return {
      role: 'user',
      content: msg.context?.message
    };
  }
  // ...
});
```

**Should be:**
```javascript
// user.message.v1 breadcrumb should have llm_hints:
{
  "schema_name": "user.message.v1",
  "context": {
    "message": "Hello"
  },
  "llm_hints": {
    "transform": {
      "chat_format": {
        "type": "literal",
        "literal": {
          "role": "user",
          "content": "{{context.message}}"
        }
      }
    }
  }
}

// Then just use:
const chatHistory = userMessages.map(m => m.context.chat_format);
```

**Why it's wrong:** Schema-specific formatting in application code

### 4. ⚠️ Dashboard Manual JSON Parsing
**Location:** `rcrt-dashboard-v2/frontend/src/components/panels/DetailsPanel.tsx` line 702  
**Issue:**
```javascript
setContext(JSON.stringify(fullBreadcrumb?.context || {}, null, 2));
```

**This is okay for editing**, but display should use transformed context

### 5. ⚠️ Hardcoded Model Dropdown
**Location:** `rcrt-dashboard-v2/frontend/src/hooks/useModelsFromCatalog.ts`  
**Status:** Already fixed to use catalog!  
**Was:** Hardcoded model list  
**Now:** Reads from openrouter.models.catalog.v1 ✅

### 6. ⚠️ Manual Tool Config Loading
**Location:** `rcrt-dashboard-v2/frontend/src/components/panels/DetailsPanel.tsx` lines 956-988  
**Issue:**
```javascript
// Manually searching and filtering breadcrumbs
const configBreadcrumb = breadcrumbs.find(b => 
  b.tags?.includes(`tool:config:${toolName}`)
);
```

**Should be:**
```javascript
// Use RCRT's search with proper parameters
const configs = await searchBreadcrumbs({
  schema_name: 'tool.v1',  // New unified schema
  tag: `tool:${toolName}`
});

// Config is in breadcrumb.context.configuration
const config = configs[0].context.configuration.currentConfig;
```

**Why it's wrong:** Manual filtering instead of using RCRT's search

## Pattern: What Makes a "Bypass"?

### ❌ Bypass
- Manual transformation in application code
- Hardcoded formatting logic
- Ignoring llm_hints
- Schema-specific processing
- Custom adapters/formatters

### ✅ RCRT Way
- Data in breadcrumbs
- Transformations in llm_hints
- RCRT backend applies transforms
- Application uses transformed data
- Generic, reusable

## Severity Assessment

| Issue | Impact | Effort to Fix |
|-------|--------|---------------|
| ToolPromptAdapter | High | ✅ Done |
| Manual context JSON.stringify | Medium | Easy |
| Chat history mapping | Low | Medium |
| Dashboard JSON display | Low | N/A (editing) |
| Tool config search | Low | Easy |

## Recommendations

### High Priority (Do Now)
1. ✅ Fix catalog llm_hints - DONE
2. ✅ Remove ToolPromptAdapter - DONE  
3. ⏳ Test that backend transformation works

### Medium Priority (Next)
4. Add llm_hints to user.message.v1 for chat format
5. Add llm_hints to agent.response.v1 for chat format
6. Remove manual chat history mapping

### Low Priority (Later)
7. Simplify tool config loading in dashboard
8. Add llm_hints to more breadcrumb types

## The Core Principle

**If you're transforming data in application code, you're probably bypassing RCRT.**

The transformation should happen:
1. In the breadcrumb (llm_hints)
2. By the backend (TransformEngine)
3. Before the application sees it

**Data flows one way: Raw → Transform → Application**

Not: Raw → Application → Transform ❌

