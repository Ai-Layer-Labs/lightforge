# Workflow Tool Intelligence Analysis

## Current Execution Trace

### What the Agent Sent
```json
{
  "steps": [
    { "id": "random_number_1", "tool": "random", "input": {} },
    { "id": "random_number_2", "tool": "random", "input": {} },
    { 
      "id": "add_numbers", 
      "tool": "calculator",
      "input": {
        "expression": "{{random_number_1.output.value}} + {{random_number_2.output.value}}"
      }
    }
  ]
}
```

### What Actually Happened
```
Step 1: random_number_1 executes
  → Output: { numbers: [42] }  ← NOT .output.value!

Step 2: random_number_2 executes  
  → Output: { numbers: [87] }  ← NOT .output.value!

Step 3: Calculator tries to interpolate
  → "${random_number_1.output.value} + ..." 
  → random_number_1.output is undefined!
  → Error: random_number_1 is not defined
```

## The Mismatch

**Agent expected:**
```javascript
random_number_1.output.value  // ❌ Doesn't exist
```

**Actual structure:**
```javascript
random_number_1.numbers[0]  // ✅ Correct
```

## Why This Happened

The agent didn't study the tool examples! The catalog includes:

```json
{
  "name": "random",
  "examples": [
    {
      "title": "Single random number",
      "input": { "min": 1, "max": 10 },
      "output": { "numbers": [7] },
      "explanation": "Access with result.numbers[0]"
    }
  ]
}
```

But the agent used `.output.value` instead.

## The Big Question

**Should the workflow tool be SMART enough to handle this automatically?**

### Option 1: Keep Workflow Tool Simple (Current)
```
Agent → Must learn correct field access from examples
Workflow → Does exactly what agent says
Result → Fails if agent gets it wrong
```

**Pros:**
- Simple, predictable
- Fast execution
- Clear errors

**Cons:**
- Agent must be perfect
- No flexibility
- Brittle

### Option 2: Add LLM Intelligence to Workflow Tool
```
Agent → Sends approximate structure
Workflow → Detects mismatch
        → Calls LLM to map fields
        → Fixes automatically
Result → Works even if agent is approximate
```

**Pros:**
- Flexible
- Self-correcting
- Handles complexity

**Cons:**
- Slower (LLM calls)
- More expensive
- Complex logic
- Harder to debug

### Option 3: Schema-Aware Auto-Mapping
```
Agent → Sends workflow
Workflow → Checks actual output schemas
        → Auto-maps fields based on types
        → If ambiguous, asks LLM
Result → Smart but deterministic when possible
```

**Pros:**
- Fast for simple cases
- Smart for complex cases
- Best of both worlds

**Cons:**
- More complex implementation

## Complexity Patterns Analysis

### Pattern 1: Simple Chain
```
Tool A → Tool B → Tool C
```
**Current:** ✅ Works if agent uses correct fields  
**With LLM:** ✅ Works even with wrong fields

### Pattern 2: Parallel + Aggregate
```
Tool A ┐
Tool B ├→ Tool D (aggregates)
Tool C ┘
```
**Current:** ✅ Works if agent uses correct fields  
**With LLM:** ✅ Auto-maps disparate outputs

### Pattern 3: Conditional Logic
```
Tool A → If result > 50 → Tool B
         Else → Tool C
```
**Current:** ❌ Can't handle (no conditional logic)  
**With LLM:** ✅ LLM interprets conditions

### Pattern 4: Dynamic Tool Selection
```
Tool A → Based on output type → Choose Tool B or C
```
**Current:** ❌ Can't handle  
**With LLM:** ✅ LLM chooses appropriate tool

### Pattern 5: Error Recovery
```
Tool A → Fails → LLM suggests alternative approach
```
**Current:** ❌ Just fails  
**With LLM:** ✅ Self-healing

## The RCRT-Native Answer

**Make the workflow tool EXTENSIBLE via tools!**

Instead of embedding LLM logic IN the workflow tool:

```javascript
export const intelligentWorkflowTool = createTool({
  name: 'intelligent-workflow',
  description: 'Workflow with LLM-assisted field mapping',
  
  async execute(input, context) {
    // Run normal workflow
    const basicWorkflow = await context.callTool('workflow', input);
    
    // If it fails, ask LLM to fix field mapping
    if (basicWorkflow.errors) {
      const llmFix = await context.callTool('openrouter', {
        messages: [{
          role: 'user',
          content: `Workflow failed. Map these outputs to calculator input:
            Available: ${JSON.stringify(results)}
            Needed: expression field for calculator
            Fix the field access paths.`
        }]
      });
      
      // Retry with fixed mapping
      const fixedWorkflow = await context.callTool('workflow', fixedInput);
      return fixedWorkflow;
    }
    
    return basicWorkflow;
  }
});
```

**This is the RCRT way!**
- ✅ Workflow tool stays simple
- ✅ Intelligence is a separate tool
- ✅ Composable (mix and match)
- ✅ Agents choose which to use

## My Recommendation

**Keep workflow tool simple for now, but add intelligence LATER as a separate tool**

### Phase 1 (Now): Fix the Agent
The agent should learn from examples:
```javascript
// Agent reads random tool example:
{
  "output": { "numbers": [7] },
  "explanation": "Access with result.numbers[0]"
}

// Agent uses correct syntax:
"${random_number_1.numbers[0]} + ${random_number_2.numbers[0]}"
```

### Phase 2 (Later): Intelligent Wrapper Tool
Create `intelligent-workflow` that:
- Calls basic workflow
- If fails, uses LLM to fix
- Learns from failures
- Self-correcting

### Phase 3 (Future): Schema-Aware Workflow
Auto-map based on JSON Schema types:
- number → number (auto-map)
- string → string (auto-map)
- array → needs index (infer or ask)

## The Answer

**NO, we don't need to add LLM to the workflow tool itself.**

Instead:
1. Fix agent to read examples correctly ← Immediate
2. Create intelligent-workflow as separate tool ← Later
3. Keep tools composable ← RCRT way

**Thoughts?**

