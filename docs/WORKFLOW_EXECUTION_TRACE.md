# Workflow Tool - Complete Execution Trace

## The Request

Agent sends:
```json
{
  "tool": "workflow",
  "input": {
    "steps": [
      { "id": "num1", "tool": "random", "input": {} },
      { "id": "num2", "tool": "random", "input": {} },
      { 
        "id": "sum", 
        "tool": "calculator", 
        "input": { "expression": "${num1.numbers[0]} + ${num2.numbers[0]}" },
        "dependencies": ["num1", "num2"]
      }
    ]
  },
  "requestId": "workflow-main-123"
}
```

## Execution Flow

### Phase 1: Initialization (Lines 120-144)

```javascript
async execute(input, context) {
  const { steps, returnStep, continueOnError } = input;
  const results = new Map();
  const errors = new Map();
  const executionOrder = [];
  
  // Validate: Check step IDs are unique
  const stepIds = new Set(steps.map(s => s.id));
  // → {num1, num2, sum}
  
  // Validate: Check dependencies exist
  for (const step of steps) {
    if (step.dependencies) {
      for (const dep of step.dependencies) {
        if (!stepIds.has(dep)) {
          throw new Error(`Unknown dependency: ${dep}`);
        }
      }
    }
  }
  // → sum depends on num1, num2 ✓
  
  // Topological sort
  const levels = this.topologicalSort(steps);
  // → [
  //     [num1, num2],  // Level 0: no dependencies
  //     [sum]          // Level 1: depends on num1, num2
  //   ]
}
```

### Phase 2: Level 0 Execution (Lines 147-236)

**Both num1 and num2 execute in parallel**

#### Step num1:

```javascript
// 1. Check dependencies (none)
// 2. Interpolate variables (none to interpolate)
const interpolatedInput = {};

// 3. Create tool request
const requestId = 'workflow-num1-1759208685103';
await context.rcrtClient.createBreadcrumb({
  schema_name: 'tool.request.v1',
  title: 'Workflow Step: random',
  tags: ['tool:request', 'workflow:step', 'workspace:tools'],
  context: {
    tool: 'random',
    input: {},
    requestId: 'workflow-num1-1759208685103',
    workflowId: 'workflow-main-123',
    stepId: 'num1',
    requestedBy: 'workflow:tools-runner'
  }
});

console.log('[Workflow] Step num1: Calling random with', {});

// 4. Wait for response
const response = await this.waitForToolResponse(
  context.rcrtClient,
  'workflow-num1-1759208685103',
  60000
);
// → This is where it gets stuck!
```

### Phase 3: waitForToolResponse (Lines 252-341)

```javascript
async waitForToolResponse(client, requestId, timeout = 60000) {
  const startTime = Date.now();
  
  // Initial delay for indexing
  await sleep(200);
  
  let attemptCount = 0;
  while (Date.now() - startTime < timeout) {
    attemptCount++;
    
    // PRIMARY SEARCH: By tag
    console.log(`Attempt ${attemptCount}: Searching for request:${requestId}`);
    
    const responsesByTag = await client.searchBreadcrumbs({
      schema_name: 'tool.response.v1',
      tag: 'request:workflow-num1-1759208685103'
    });
    
    console.log(`Tag search returned ${responsesByTag.length} results`);
    
    if (responsesByTag.length > 0) {
      return responsesByTag[0].context;  // SUCCESS!
    }
    
    // SECONDARY SEARCH: Get all recent responses
    console.log('Tag search failed, trying context search...');
    
    const allResponses = await client.searchBreadcrumbs({
      schema_name: 'tool.response.v1'
    });
    
    console.log(`Got ${allResponses.length} total tool responses`);
    
    // Sort by timestamp
    const recent = allResponses
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
      .slice(0, 20);
    
    console.log(`Checking ${recent.length} recent responses`);
    
    // Manually check each one
    for (const resp of recent) {
      const full = await client.getBreadcrumb(resp.id);
      console.log(`Checking ${resp.id}: request_id=${full.context?.request_id}`);
      
      if (full.context?.request_id === 'workflow-num1-1759208685103') {
        console.log('✅ Found by context search!');
        return full.context;  // SUCCESS!
      }
    }
    
    // Wait and retry
    await sleep(500);
  }
  
  // TIMEOUT!
  throw new Error(`Timeout waiting for ${requestId}`);
}
```

### Phase 4: Meanwhile... Tools-Runner

```javascript
// SSE Dispatcher receives the tool.request.v1 event
async function dispatchEventToTool(eventData, client, workspace) {
  // Extract tool info
  const breadcrumb = await client.getBreadcrumb(eventData.breadcrumb_id);
  const { tool: toolName, input: toolInput } = breadcrumb.context;
  
  console.log(`Loading tool ${toolName} from breadcrumbs...`);
  
  // Load tool
  const loader = new ToolLoader(client, workspace);
  const underlyingTool = await loader.loadToolByName('random');
  // → Returns the builtinTools.random object
  
  console.log(`Executing tool: ${toolName}`);
  
  // Execute
  const result = await underlyingTool.execute({}, context);
  // → { numbers: [87] }
  
  const executionTime = 0; // Very fast!
  
  // Create response
  const responseRequestId = breadcrumb.context.requestId;
  // → 'workflow-num1-1759208685103'
  
  await client.createBreadcrumb({
    schema_name: 'tool.response.v1',
    title: 'Response: random',
    tags: [
      'workspace:tools',
      'tool:response',
      'request:workflow-num1-1759208685103'  // ← THE TAG
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
  
  console.log('✅ Created tool.response.v1 with tags:', [
    'workspace:tools',
    'tool:response',
    'request:workflow-num1-1759208685103'
  ]);
}
```

## The Race Condition Timeline

```
T=0ms    Workflow creates tool.request.v1 for num1
         └─ requestId: workflow-num1-1759208685103

T=50ms   Tools-runner picks up request via SSE
T=51ms   Loads random tool
T=52ms   Executes random tool
         └─ Result: { numbers: [87] }

T=53ms   Creates tool.response.v1
         └─ Tags: ['workspace:tools', 'tool:response', 'request:workflow-num1-1759208685103']
         └─ Context: { request_id: 'workflow-num1-1759208685103', output: {...} }

T=100ms  Workflow starts searching (after 200ms delay)
T=101ms  Search: { schema_name: 'tool.response.v1', tag: 'request:workflow-num1-1759208685103' }
         └─ ❌ Returns 0 results  ← THE PROBLEM!

T=102ms  Fallback: Search all tool.response.v1 breadcrumbs
T=103ms  Gets 50 breadcrumbs
T=104ms  Fetches each one and checks request_id
T=150ms  ✅ Found it in breadcrumb xyz!
         └─ But only after fetching 10+ breadcrumbs manually
```

## Why Tag Search Fails

### Hypothesis 1: Database Indexing Delay
PostgreSQL's GIN index for JSONB might not update instantly:
```sql
-- RCRT backend might do:
SELECT * FROM breadcrumbs 
WHERE tags @> ARRAY['request:workflow-num1-1759208685103']::text[];

-- But the GIN index updates async!
```

### Hypothesis 2: Tag Search Implementation
The `/api/rcrt/breadcrumbs?tag=X` endpoint might not work correctly:
```javascript
// Backend might be doing:
WHERE tags LIKE '%request:workflow%'  // Partial match
// Instead of:
WHERE 'request:workflow-num1-1759208685103' = ANY(tags)  // Exact match
```

### Hypothesis 3: SDK Client Isolation
Different SDK instances might have different view states:
```javascript
// Tools-runner client
const client1 = new RcrtClientEnhanced(...)
client1.createBreadcrumb(...)  // Creates response

// Workflow tool context.rcrtClient
const client2 = new RcrtClientEnhanced(...)
client2.searchBreadcrumbs(...)  // Can't see it yet?
```

## What the Logs Will Show

With enhanced logging, we'll see:

```
[Workflow] Attempt 1: Searching for request:workflow-num1-1759208685103
[Workflow] Tag search returned 0 results  ← If this is 0, tag search is broken
[Workflow] Tag search failed, trying context search...
[Workflow] Got 47 total tool responses
[Workflow] Checking 20 recent responses
[Workflow] Checking abc-123: request_id=workflow-num1-1759208685103
[Workflow] ✅ Found by context search on attempt 1
```

OR:

```
[Workflow] Attempt 1: Searching for request:workflow-num1-1759208685103
[Workflow] Tag search returned 1 results  ← If this works, no race condition
[Workflow] Response breadcrumb found: {...}
[Workflow] ✅ Found by tag on attempt 1
```

## Next Steps

1. **Run with enhanced logging** - See what the searches return
2. **Check RCRT backend** - How does tag search work?
3. **Test tag search directly** - Can we search by tag at all?
4. **Consider alternatives** - Direct ID reference, event notifications, etc.

The diagnostic logs will tell us exactly what's happening!
