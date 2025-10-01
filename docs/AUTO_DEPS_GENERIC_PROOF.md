# Auto-Dependency Detection - Completely Generic

## How It Actually Works

The algorithm is **100% generic** - it just scans for `${anything}` patterns:

```javascript
function extractDependencies(input, allStepIds) {
  const json = JSON.stringify(input);  // Convert entire input to string
  
  // Match ANY ${variable} or {{variable}} pattern
  const varPattern = /[\$\{]{2}([^}]+)[\}]{2}/g;
  const matches = json.matchAll(varPattern);
  
  for (const match of matches) {
    const path = match[1];  // e.g., "stepX.field.nested[0]"
    const stepId = path.split('.')[0];  // Extract just "stepX"
    
    // Check if "stepX" is a valid step in THIS workflow
    if (allStepIds.includes(stepId)) {
      deps.add(stepId);  // Found a dependency!
    }
  }
  
  return Array.from(deps);
}
```

**It doesn't care about:**
- ❌ Tool names
- ❌ Field names
- ❌ Data types
- ❌ Number of steps

**It only cares about:**
- ✅ Is there a `${something}` reference?
- ✅ Is that "something" a step ID in this workflow?

## Generic Examples

### Example 1: Weather → Translation
```json
{
  "steps": [
    { 
      "id": "fetch_weather", 
      "tool": "weather_api",
      "input": { "city": "Paris" }
    },
    {
      "id": "translate_to_spanish",
      "tool": "translator",
      "input": { 
        "text": "${fetch_weather.description}",
        "target_lang": "es"
      }
    }
  ]
}
```
**Auto-detected:** `translate_to_spanish` depends on `fetch_weather`  
**Why:** Found `${fetch_weather}` in input

### Example 2: Database → Processing → Storage
```json
{
  "steps": [
    { "id": "query_db", "tool": "sql_query", "input": {...} },
    { 
      "id": "process_results", 
      "tool": "data_transformer",
      "input": { "data": "${query_db.rows}" }
    },
    {
      "id": "save_to_file",
      "tool": "file_storage",
      "input": { 
        "filename": "results.json",
        "content": "${process_results.transformed}"
      }
    }
  ]
}
```
**Auto-detected:**
- `process_results` depends on `query_db`
- `save_to_file` depends on `process_results`

### Example 3: Multiple Dependencies
```json
{
  "steps": [
    { "id": "get_price", "tool": "price_api" },
    { "id": "get_inventory", "tool": "inventory_api" },
    { "id": "get_shipping", "tool": "shipping_api" },
    {
      "id": "calculate_total",
      "tool": "calculator",
      "input": {
        "expression": "${get_price.amount} + ${get_shipping.cost}"
      }
    },
    {
      "id": "check_availability",
      "tool": "checker",
      "input": {
        "price": "${calculate_total.result}",
        "inventory": "${get_inventory.count}"
      }
    }
  ]
}
```
**Auto-detected:**
- `calculate_total` depends on `[get_price, get_shipping]`
- `check_availability` depends on `[calculate_total, get_inventory]`

### Example 4: Complex Nesting
```json
{
  "steps": [
    { "id": "api_call", "tool": "http_get" },
    {
      "id": "process",
      "tool": "data_processor",
      "input": {
        "nested": {
          "deep": {
            "values": [
              "${api_call.data[0].field}",
              "${api_call.data[1].field}"
            ]
          }
        }
      }
    }
  ]
}
```
**Auto-detected:** `process` depends on `api_call`  
**Why:** Found `${api_call}` in nested structure

### Example 5: No Dependencies
```json
{
  "steps": [
    { "id": "task1", "tool": "independent_task", "input": { "value": 42 } },
    { "id": "task2", "tool": "another_task", "input": { "data": "literal" } },
    { "id": "task3", "tool": "third_task", "input": {} }
  ]
}
```
**Auto-detected:** No dependencies for any step  
**Result:** All execute in parallel! ✅

### Example 6: String Templates
```json
{
  "steps": [
    { "id": "get_name", "tool": "user_api" },
    { "id": "get_age", "tool": "profile_api" },
    {
      "id": "generate_bio",
      "tool": "llm",
      "input": {
        "prompt": "Write a bio for ${get_name.fullName} who is ${get_age.years} years old"
      }
    }
  ]
}
```
**Auto-detected:** `generate_bio` depends on `[get_name, get_age]`

### Example 7: Array Operations
```json
{
  "steps": [
    { "id": "list_items", "tool": "list_api" },
    {
      "id": "process_first",
      "tool": "processor",
      "input": { "item": "${list_items.items[0]}" }
    },
    {
      "id": "process_second",
      "tool": "processor",
      "input": { "item": "${list_items.items[1]}" }
    },
    {
      "id": "combine",
      "tool": "combiner",
      "input": {
        "results": ["${process_first}", "${process_second}"]
      }
    }
  ]
}
```
**Auto-detected:**
- `process_first` depends on `list_items`
- `process_second` depends on `list_items`
- `combine` depends on `[process_first, process_second]`

## The Algorithm Is Tool-Agnostic

```javascript
// It scans for this pattern:
${STEP_ID}
${STEP_ID.anything.here}
${STEP_ID[0]}
{{STEP_ID}}  // Also handles old syntax

// Where STEP_ID matches one of the step IDs in the workflow

// It doesn't look at:
- Tool names
- Field names
- Data structures
- Number of steps
- Tool categories
- Input/output schemas
```

## Works for Any Scenario

✅ **Random numbers** → Calculator  
✅ **API calls** → Data processing  
✅ **Database queries** → Transformations  
✅ **File operations** → Analysis  
✅ **LLM calls** → Chained reasoning  
✅ **HTTP requests** → Response parsing  
✅ **Image generation** → Image processing  
✅ **Any tool** → **Any other tool**

## The Beauty

It's **pattern-based, not domain-specific**:
- Looks for `${stepId}` anywhere in JSON
- Matches against actual step IDs in workflow
- Completely generic
- Works for ANY tools, ANY data, ANY complexity

**Your workflow could have 100 steps across 50 different tools and it would still work!**

The `num1` was just a variable name - could be `fetch_weather`, `query_database`, `api_response`, or anything!

