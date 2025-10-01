# Workflow Tool - Detailed Execution Flow

## Overview
The workflow tool orchestrates multi-step operations by managing dependencies, creating tool requests, and waiting for responses.

## Step-by-Step Execution

### 1. Input Received
```javascript
{
  "tool": "workflow",
  "input": {
    "steps": [
      { "id": "num1", "tool": "random", "input": {}, "dependencies": [] },
      { "id": "num2", "tool": "random", "input": {}, "dependencies": [] },
      { 
        "id": "sum", 
        "tool": "calculator", 
        "input": { "expression": "${num1.numbers[0]} + ${num2.numbers[0]}" },
        "dependencies": ["num1", "num2"]
      }
    ]
  },
  "requestId": "workflow-123"
}
```

### 2. Validation
```javascript
// Check all steps have valid structure
for (const step of steps) {
  if (!step.id || !step.tool || !step.input) {
    throw new Error('Invalid step structure');
  }
}

// Validate dependencies exist
for (const step of steps) {
  if (step.dependencies) {
    for (const dep of step.dependencies) {
      if (!stepIds.has(dep)) {
        throw new Error(`Unknown dependency: ${dep}`);
      }
    }
  }
}
```

### 3. Topological Sort
```javascript
// Groups steps by dependency level
// Level 0: No dependencies (can run in parallel)
// Level 1: Depends on Level 0
// Level 2: Depends on Level 1, etc.

const levels = topologicalSort(steps);
// Result: [
//   [num1, num2],  // Level 0 - parallel
//   [sum]          // Level 1 - waits for num1 & num2
// ]
```

### 4. Execute Each Level

#### Level 0: `num1` and `num2` (Parallel)

**Step A: Create Tool Request for `num1`**
```javascript
const requestId = `workflow-num1-${Date.now()}`;  // e.g., workflow-num1-1759208685103

await context.rcrtClient.createBreadcrumb({
  schema_name: 'tool.request.v1',
  title: 'Workflow Step: random',
  tags: ['tool:request', 'workflow:step', 'workspace:tools'],
  context: {
    tool: 'random',
    input: {},  // No interpolation needed (no dependencies)
    requestId: 'workflow-num1-1759208685103',
    workflowId: 'workflow-123',
    stepId: 'num1',
    requestedBy: 'workflow:tools-runner'
  }
});
```

**Step B: Tools Runner Picks It Up**
```javascript
// tools-runner/src/index.ts - SSE Dispatcher receives event
{
  type: 'breadcrumb.updated',
  schema_name: 'tool.request.v1',
  breadcrumb_id: 'abc-123',
  context: {
    tool: 'random',
    requestId: 'workflow-num1-1759208685103'
  }
}

// Dispatcher calls: dispatchEventToTool()
```

**Step C: Tool Loader Loads Tool**
```javascript
const loader = new ToolLoader(client, workspace);
const underlyingTool = await loader.loadToolByName('random');
// Finds tool.v1 breadcrumb
// Loads implementation from builtinTools.random
// Returns the tool object
```

**Step D: Tool Executes**
```javascript
const result = await underlyingTool.execute({}, context);
// Result: { numbers: [87] }
```

**Step E: Tools Runner Creates Response**
```javascript
await client.createBreadcrumb({
  schema_name: 'tool.response.v1',
  title: 'Response: random',
  tags: [
    'workspace:tools', 
    'tool:response', 
    'request:workflow-num1-1759208685103'  // ← KEY TAG
  ],
  context: {
    request_id: 'workflow-num1-1759208685103',
    tool: 'random',
    status: 'success',
    output: { numbers: [87] },
    execution_time_ms: 0,
    timestamp: '2025-09-30T05:05:45.394Z'
  }
});
```

**Step F: Workflow Tool Searches for Response**
```javascript
// In waitForToolResponse()
while (Date.now() - startTime < 60000) {
  // Primary search: by tag
  const responsesByTag = await client.searchBreadcrumbs({
    schema_name: 'tool.response.v1',
    tag: 'request:workflow-num1-1759208685103'
  });
  
  if (responsesByTag.length > 0) {
    // Found it!
    return response.context;
  }
  
  // Secondary search: check all recent responses
  const allResponses = await client.searchBreadcrumbs({
    schema_name: 'tool.response.v1'
  });
  
  for (const resp of allResponses) {
    const full = await client.getBreadcrumb(resp.id);
    if (full.context.request_id === 'workflow-num1-1759208685103') {
      // Found it!
      return full.context;
    }
  }
  
  // Wait and retry
  await sleep(500);
}

// TIMEOUT! ← This is where it's failing
```

### 5. The Race Condition Problem

**Timeline:**
```
T=0ms:   Workflow creates tool.request.v1
T=50ms:  Tools-runner picks up request
T=51ms:  Tool executes (very fast for random)
T=52ms:  tool.response.v1 created with tag 'request:workflow-num1-...'
T=100ms: Workflow starts searching
T=101ms: Search by tag returns 0 results ← PROBLEM!
T=102ms: Search all responses, manually check request_id
T=103ms: Found it! ← But this is slow
```

**The Issue:** Tag-based search has indexing delay

## Possible Causes

### Cause 1: PostgreSQL Full-Text Search Indexing
The RCRT backend might use Postgres full-text search for tags, which has a slight delay.

### Cause 2: Different Database Connections
The tools-runner and workflow tool might use different SDK clients pointing to different connection pools.

### Cause 3: Tag Search Not Implemented
The `/api/rcrt/breadcrumbs` endpoint might not actually support tag filtering correctly.

### Cause 4: Workspace Isolation
The search might be filtered by workspace, but tags don't match workspace exactly.

## Current Workaround

The workflow tool has a fallback:
1. Try tag search
2. If that fails, get ALL tool.response.v1 breadcrumbs
3. Fetch each one individually
4. Check request_id in context

**This works but is slow!**

## Diagnostic Questions

1. **Does tag search work at all?**
   - Can we search `request:workflow-num1-123` and find it?
   - Or does it always return 0?

2. **Is it a timing issue?**
   - If we wait 1 second before searching, does it work?
   - Or is it never indexed by tag?

3. **Are the tags actually on the breadcrumb?**
   - Does `tool.response.v1` have the `request:xyz` tag?
   - Can we verify in the database?

## Solution Options

### Option A: Fix Tag Search (Ideal)
Make tag search work reliably and immediately.

### Option B: Use Direct ID Reference
Instead of searching, return breadcrumb ID immediately:
```javascript
// Tools-runner creates response
const responseId = await createResponse(...);

// Immediately notify workflow
await createBreadcrumb({
  schema_name: 'workflow.step.complete.v1',
  context: {
    requestId: 'workflow-num1-123',
    responseId: responseId
  }
});

// Workflow subscribes to workflow.step.complete.v1
```

### Option C: In-Memory Correlation
Tools-runner maintains a Map of requestId → responseId:
```javascript
const responseMap = new Map();

// On tool execution
responseMap.set(requestId, responseId);

// Workflow can query the map
const responseId = responseMap.get(requestId);
```

### Option D: Polling with getBreadcrumb
If we know the approximate ID, poll directly instead of searching.

## What I Need to Know

**Can you check the logs and tell me:**

1. Does the tag search (`request:workflow-num1-...`) ever return results?
2. How long does it take for the context search to find it?
3. Are there any errors in the search itself?

With the enhanced logging I just added, the workflow will print:
- `Tag search returned X results`
- `Got Y total tool responses`
- `Checking breadcrumb ID: request_id=...`

This will tell us exactly where the bottleneck is!

**Should I look at the RCRT backend search implementation to see if tag search is working correctly?**
