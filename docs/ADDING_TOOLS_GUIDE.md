# How to Add Tools to RCRT

## The Simple Process (3 Steps)

### Step 1: Add Tool Definition
**File:** `rcrt-visual-builder/packages/tools/src/index.ts`

```javascript
export const builtinTools = {
  // ... existing tools ...
  
  'your-tool-name': createTool(
    'your-tool-name',                    // Tool name
    'What your tool does',               // Description
    { /* inputSchema */ },               // What it accepts
    { /* outputSchema */ },              // What it returns
    async (input, context) => {          // Implementation
      // Your code here
      return { result: 'value' };
    },
    {
      category: 'general',               // Category
      examples: [                        // EXAMPLES (critical!)
        {
          title: 'Example usage',
          input: { /* sample input */ },
          output: { /* sample output */ },
          explanation: 'How to access result.field'
        }
      ]
    }
  )
};
```

### Step 2: Build
```bash
pnpm --filter "@rcrt-builder/tools" build
```

### Step 3: Deploy
```bash
docker compose build tools-runner --no-cache
docker compose up -d tools-runner
```

## That's It!

The system automatically:
- ✅ Creates tool.v1 breadcrumb
- ✅ Includes your examples
- ✅ Updates catalog
- ✅ Makes it discoverable
- ✅ Agent can use it immediately!

## Example: Breadcrumb CRUD Tool (Just Added!)

```javascript
'breadcrumb-crud': createTool(
  'breadcrumb-crud',
  'Query, create, update, and delete breadcrumbs',
  {
    type: 'object',
    properties: {
      action: { 
        type: 'string', 
        enum: ['query', 'create', 'get', 'update', 'delete'] 
      },
      // Query params
      schema_name: { type: 'string' },
      tag: { type: 'string' },
      limit: { type: 'number', default: 10 },
      // CRUD params
      id: { type: 'string' },
      title: { type: 'string' },
      context: { type: 'object' },
      new_tags: { type: 'array', items: { type: 'string' } }
    },
    required: ['action']
  },
  { /* output schema */ },
  async (input, context) => {
    switch (input.action) {
      case 'query':
        return await context.rcrtClient.searchBreadcrumbs({...});
      case 'create':
        return await context.rcrtClient.createBreadcrumb({...});
      // ... etc
    }
  },
  {
    category: 'system',
    examples: [
      {
        title: 'Query breadcrumbs',
        input: { action: 'query', schema_name: 'user.message.v1' },
        output: { breadcrumbs: [...], count: 5 },
        explanation: 'Results in breadcrumbs array'
      },
      // ... 4 more examples
    ]
  }
)
```

## What Gets Created Automatically

When tools-runner starts, `bootstrap-tools.ts` creates:

```json
{
  "schema_name": "tool.v1",
  "tags": ["tool", "tool:breadcrumb-crud", "category:system"],
  "context": {
    "name": "breadcrumb-crud",
    "description": "Query, create, update, and delete breadcrumbs",
    "category": "system",
    "implementation": {
      "type": "builtin",
      "module": "@rcrt-builder/tools",
      "export": "builtinTools.breadcrumb-crud"
    },
    "definition": {
      "inputSchema": {...},
      "outputSchema": {...},
      "examples": [
        {
          "title": "Query breadcrumbs by schema",
          "input": {...},
          "output": {...},
          "explanation": "Results in breadcrumbs array"
        }
        // All 5 examples included!
      ]
    }
  }
}
```

Then catalog aggregates it and llm_hints transforms it:

```
• breadcrumb-crud (system): Query, create, update, and delete breadcrumbs
  Output: action, success, breadcrumb, breadcrumbs, count, error
  Example: Results in breadcrumbs array
```

## Agent Can Now Use It!

```javascript
// Agent can query breadcrumbs
{
  "tool": "breadcrumb-crud",
  "input": {
    "action": "query",
    "tag": "user:message",
    "limit": 10
  }
}

// Agent can create breadcrumbs
{
  "tool": "breadcrumb-crud",
  "input": {
    "action": "create",
    "title": "My Note",
    "context": { note: "Remember this!" },
    "new_tags": ["note", "memory"]
  }
}
```

## Why This Is Easy

**RCRT's Simple Primitives:**
1. Add tool code → One object in builtinTools
2. Bootstrap creates breadcrumb → Automatic
3. Catalog includes it → Automatic
4. Examples transform → Automatic via llm_hints
5. Agent discovers it → Automatic

**No configuration, no registration, no manual breadcrumb creation!**

**Just add code + examples, and the RCRT system does the rest!** 🎯

