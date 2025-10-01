# Workflow Tool - Simple Explanation

## How It Works (5-Step Process)

### Step 1: Receive Workflow
```
Agent → workflow tool
Input: { steps: [num1, num2, sum] }
```

### Step 2: Sort by Dependencies
```
num1 (no deps) ─┐
num2 (no deps) ─┼─→ Level 0 (parallel)
                │
sum (needs num1, num2) ─→ Level 1 (waits)
```

### Step 3: Execute Level 0
```
For each step in parallel:
  1. Create tool.request.v1 breadcrumb
     └─ requestId: workflow-num1-123
  
  2. Wait for tool.response.v1
     └─ Searches for tag: request:workflow-num1-123
     
  3. Get result
     └─ { numbers: [87] }
```

### Step 4: Execute Level 1
```
Step: sum
  1. Interpolate variables
     └─ "${num1.numbers[0]} + ${num2.numbers[0]}"
     └─ "87 + 95"
  
  2. Create tool.request.v1 for calculator
     └─ input: { expression: "87 + 95" }
  
  3. Wait for response
  
  4. Get result
     └─ { result: 182 }
```

### Step 5: Return Results
```
Return: {
  results: {
    num1: { numbers: [87] },
    num2: { numbers: [95] },
    sum: { result: 182 }
  },
  executionOrder: ["num1", "num2", "sum"]
}
```

## The Problem: Step 3.2 (Waiting for Response)

### What Should Happen:
```
T=0ms:   Create tool.request.v1
T=50ms:  Tools-runner executes
T=51ms:  Creates tool.response.v1 with tag 'request:workflow-num1-123'
T=200ms: Workflow searches by tag
T=201ms: ✅ Finds it immediately
```

### What Actually Happens:
```
T=0ms:   Create tool.request.v1
T=50ms:  Tools-runner executes
T=51ms:  Creates tool.response.v1 with tag 'request:workflow-num1-123'
T=200ms: Workflow searches by tag
T=201ms: ❌ Returns 0 results! (Tag not indexed yet?)
T=202ms: Falls back to fetching ALL tool.response.v1
T=203ms: Manually checks 50 breadcrumbs
T=250ms: ✅ Finds it by checking request_id field
OR
T=60000ms: ⏰ TIMEOUT! (If context search also fails)
```

## The Core Issue

**Tag-based search doesn't work immediately after breadcrumb creation.**

Possible reasons:
1. Database indexing delay
2. Tag search not implemented correctly
3. SDK client isolation
4. Search cache staleness

## How to Fix

### Immediate Fix: Increase Initial Delay
```javascript
// Instead of 200ms, wait longer
await sleep(1000);
```

### Better Fix: Smarter Search
```javascript
// Try tag search first
// If fails, immediately fall back to context search
// Don't retry tag search (it won't suddenly work)
```

### Best Fix: Event-Based Notification
```javascript
// Tools-runner emits event when response ready
await client.emit('workflow.response.ready', {
  requestId: 'workflow-num1-123',
  responseId: 'abc-xyz'
});

// Workflow subscribes to these events
// No polling needed!
```

## Current Status

With the enhanced logging I just added, when you run the workflow, you'll see:

```
[Workflow] Step num1: Calling random with {}
[Workflow] Attempt 1: Searching for request:workflow-num1-1759208685103
[Workflow] Tag search returned 0 results  ← This tells us if tag search works
[Workflow] Tag search failed, trying context search...
[Workflow] Got 47 total tool responses
[Workflow] Checking 20 recent responses
[Workflow] Checking abc-123: request_id=workflow-num1-1759208685103
[Workflow] ✅ Found by context search on attempt 1
```

This will pinpoint exactly where the delay is!
