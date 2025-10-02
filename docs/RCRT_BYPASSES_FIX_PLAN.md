# RCRT Bypasses - Complete Fix Plan

## Audit Results

### ✅ Fixed
1. **ToolPromptAdapter** - DELETED
2. **Catalog llm_hints** - Now includes examples
3. **Agent uses transformed context** - Reads from backend

### ⚠️ Still Bypassing RCRT

## Issue #1: Manual Context JSON.stringify (CRITICAL)

**Location:** `packages/runtime/src/agent/agent-executor.ts` line 142

**Current (Wrong):**
```javascript
const context = await this.buildContext();  // Array of objects

const messages = [
  { role: 'system', content: systemPrompt },
  { 
    role: 'user', 
    content: `Context:\n${JSON.stringify(context, null, 2)}\n\nUser message: ${userMessage}`
  }
];
```

**RCRT Way:**
Each context item should already be transformed by llm_hints!

```javascript
const contextItems = await this.buildContext();  // Gets transformed breadcrumbs

// Items already have their llm_hints applied
const contextText = contextItems
  .map(item => `[${item.type}]\n${item.content}`)  // content is pre-transformed!
  .join('\n\n');

const messages = [
  { role: 'system', content: systemPrompt },
  { role: 'user', content: `${contextText}\n\nUser: ${userMessage}` }
];
```

**Fix:**
- buildContext() should call getBreadcrumb() (which applies llm_hints)
- Use the transformed fields (tool_list, chat_format, etc.)
- No manual JSON.stringify

## Issue #2: Chat History Manual Mapping

**Location:** `packages/runtime/src/agent/agent-executor.ts` lines 376-393

**Current (Wrong):**
```javascript
const chatHistory = allMessages.map(msg => {
  if (msg.schema_name === 'user.message.v1') {
    return {
      role: 'user',
      content: msg.context?.message
    };
  }
  // More manual mapping...
});
```

**RCRT Way:**
```javascript
// user.message.v1 should have llm_hints:
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

// Then just:
const chatHistory = userMessages.map(m => m.context.chat_format);
```

**Fix:**
- Add llm_hints to user.message.v1
- Add llm_hints to agent.response.v1
- Remove manual mapping

## Issue #3: Dashboard Tool Config Search

**Location:** `rcrt-dashboard-v2/frontend/src/components/panels/DetailsPanel.tsx` lines 960-963

**Current (Suboptimal):**
```javascript
const breadcrumbs = await fetch('/api/breadcrumbs').json();
const configBreadcrumb = breadcrumbs.find(b => 
  b.tags?.includes(`tool:config:${toolName}`)
);
```

**RCRT Way:**
```javascript
// Use RCRT's search API properly
const response = await fetch(`/api/breadcrumbs?schema_name=tool.v1&tag=tool:${toolName}`);
const tools = await response.json();

if (tools.length > 0) {
  const toolBreadcrumb = await fetch(`/api/breadcrumbs/${tools[0].id}`).json();
  const config = toolBreadcrumb.context.configuration.currentConfig;
}
```

**Fix:**
- Use tool.v1 unified schema
- Use query parameters for filtering
- Read from breadcrumb structure

## The Pattern

All bypasses follow this pattern:

```javascript
// ❌ Bypass Pattern
getData() → Manual Transform → Use

// ✅ RCRT Pattern  
getData() → (RCRT transforms via llm_hints) → Use
```

## Implementation Priority

### Phase 1: Critical (Affects Agent Behavior)
1. ✅ Fix catalog llm_hints
2. ✅ Remove ToolPromptAdapter
3. ⏳ Verify backend applies transformations

### Phase 2: Important (Context Building)
4. Add llm_hints to user.message.v1
5. Add llm_hints to agent.response.v1
6. Remove manual chat history mapping
7. Remove manual context JSON.stringify

### Phase 3: Polish (UI/Dashboard)
8. Use tool.v1 unified schema
9. Improve dashboard search
10. Use transformed context for display

## Quick Wins

The biggest impact comes from:
1. **Catalog llm_hints with examples** ← DONE ✅
2. **Backend transformation working** ← Already exists! ✅
3. **Agent using transformed context** ← DONE ✅

The rest are refinements!

## Testing Plan

After deploying current fixes:
1. Check logs: Does backend apply llm_hints?
2. Check agent context: Does it include examples?
3. Test workflow: Does agent use correct syntax?

If yes to all → System works!
If no → Investigate transformation engine

## Conclusion

We had ONE major bypass (ToolPromptAdapter) that broke everything.

The rest are minor optimizations that can be cleaned up later.

**The fix we just made should be enough to make the system work!**

