# Tool Development - Decision Guide

## What We're Trying to Solve

**Problem:** Make it easy for anyone (developers, agents, non-coders) to create RCRT tools.

**Constraint:** Must stay RCRT-native (breadcrumbs, not just code).

## The Options

### Option 1: SDK Only
```typescript
// Developer installs package
import { defineRCRTTool } from '@rcrt-builder/tool-sdk';

export const myTool = defineRCRTTool({...});
await publishTool(myTool);
```

**Best for:** TypeScript developers  
**Timeline:** 3-4 days  
**RCRT-Native:** ⭐⭐⭐

### Option 2: Tool Creator Tool Only
```javascript
// Anyone uses via chat/API
{
  "tool": "tool-creator",
  "input": {
    "name": "my-tool",
    "code": "return { result: input.x * 2 };"
  }
}
```

**Best for:** Non-developers, agents, quick prototypes  
**Timeline:** 2-3 days  
**RCRT-Native:** ⭐⭐⭐⭐⭐

### Option 3: Both (Recommended)
SDK → TypeScript developers  
Tool Creator → Everyone else + agents

**Timeline:** 5-7 days  
**RCRT-Native:** ⭐⭐⭐⭐⭐

## Real-World Scenarios

### Scenario 1: Non-Developer Creates Tool
**User:** "I need a tool that converts markdown to HTML"

**With Tool Creator:**
```
User → Chat Agent → tool-creator tool → Tool breadcrumb created
Time: 2 minutes
```

**With SDK:**
```
User → Learn TypeScript → Install SDK → Write code → Publish
Time: 2 hours (if new to TS)
```

**Winner:** Tool Creator ✅

### Scenario 2: Developer Creates Complex Tool
**Need:** Multi-step data processing with error handling, retries, caching

**With Tool Creator:**
- Limited to simple code snippets
- Hard to test locally
- No type safety

**With SDK:**
- Full TypeScript support
- Local testing
- IDE autocomplete
- Proper error handling

**Winner:** SDK ✅

### Scenario 3: Agent Creates Tool
**Agent:** Needs a tool that doesn't exist yet

**With Tool Creator:**
- Agent calls tool-creator
- Tool ready immediately
- Agent can use it right away

**With SDK:**
- Agent would need to write files
- Requires build step
- Not practical

**Winner:** Tool Creator ✅

## Usage Patterns

### Pattern 1: Prototyping
1. Create with tool-creator (fast)
2. Test and iterate
3. If complex, migrate to SDK for production

### Pattern 2: Production Tools
1. Start with SDK (type safety)
2. Test locally
3. Publish to RCRT

### Pattern 3: Agent-Generated Tools
1. Agent uses tool-creator
2. Creates tool on demand
3. Uses immediately

## Architecture Decision

### If We Build SDK Only
```
Developer → SDK → Code → Breadcrumb → Tool
```
- Great for developers
- Not agent-friendly
- Requires installation

### If We Build Tool Creator Only
```
Anyone → tool-creator → Breadcrumb → Tool
```
- Agent-friendly
- RCRT-native
- Limited for complex tools

### If We Build Both
```
Developer → SDK → Breadcrumb → Tool
Non-Dev → tool-creator → Breadcrumb → Tool
Agent → tool-creator → Breadcrumb → Tool
```
- Best of both worlds
- More work upfront

## My Strong Recommendation

**Build Tool Creator Tool First, SDK Second**

### Why This Order?

1. **Tool Creator is RCRT-native**
   - Pure breadcrumb approach
   - Works immediately in the system
   - Agents can use it

2. **Unlocks Agent Capabilities**
   - Agents can create their own tools
   - Self-improving system
   - Very powerful

3. **Works for 80% of Use Cases**
   - Simple tools are most common
   - Complex tools can wait

4. **SDK Can Use Tool Creator**
   - SDK's `publishTool()` can call tool-creator
   - Reuse logic
   - Best of both worlds

5. **Faster Time to Value**
   - 2-3 days vs 3-4 days
   - Immediate benefits
   - Can add SDK later

## Implementation Approach

### Phase 1: Tool Creator Tool (Week 1)
```
Days 1-2: Core logic (validation, code exec, breadcrumb creation)
Day 3: Templates (HTTP API, data transform, etc.)
Day 4: Testing & examples
```

### Phase 2: SDK (Week 2)
```
Days 1-2: Core helpers (defineRCRTTool, schemas)
Day 3: publishTool (can use tool-creator internally!)
Day 4: CLI tool, documentation
```

### Phase 3: Integration (Week 3)
```
- Agent can create tools via tool-creator
- Developers use SDK
- Web UI calls tool-creator
- All approaches work together
```

## Decision Matrix

| Requirement | Tool Creator | SDK | Both |
|------------|--------------|-----|------|
| Agent-friendly | ✅ | ❌ | ✅ |
| Type safety | ❌ | ✅ | ✅ |
| Quick prototyping | ✅ | ⚠️ | ✅ |
| Complex tools | ⚠️ | ✅ | ✅ |
| RCRT-native | ✅✅ | ⚠️ | ✅✅ |
| No installation | ✅ | ❌ | ✅ |
| Learning curve | Low | Med | Low-Med |
| Timeline | 2-3d | 3-4d | 5-7d |

## My Vote

🎯 **Start with Tool Creator Tool**

Then add SDK for developers who need more control.

This gives us:
- Immediate agent capabilities
- Pure RCRT approach
- Fast iteration
- SDK can come later and use same foundation

**What do you think?**
