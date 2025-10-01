# RCRT Tool System Flow

## Current (Wrong) Flow
```
Code Registration → Memory Registry → Catalog Breadcrumb → Agents
      ↓                    ↓                   ↓              ↓
[Static Tools]    [In-Memory Map]    [Generated from Memory] [Read Catalog]
```

## Proper RCRT Flow
```
Tool Breadcrumb → Catalog Aggregator → Dynamic Catalog → Agents
       ↓                  ↓                   ↓             ↓
  [tool.v1]      [Searches for tools]   [Aggregated]   [Discover]
```

## Tool Lifecycle

### 1. Tool Creation
```json
// Create tool.v1 breadcrumb
{
  "schema_name": "tool.v1",
  "tags": ["tool", "tool:my-tool"],
  "context": {
    "name": "my-tool",
    "definition": { /* schemas & examples */ },
    "configuration": { /* optional config */ }
  }
}
```

### 2. Tool Discovery
```javascript
// Catalog aggregator finds tools
const tools = await client.searchBreadcrumbs({
  schema_name: 'tool.v1',
  tag: 'workspace:tools'
});
```

### 3. Catalog Update
```javascript
// Build catalog from tool breadcrumbs
const catalog = {
  schema_name: 'tool.catalog.v1',
  context: {
    tools: tools.map(t => t.context),
    totalTools: tools.length
  }
};
```

### 4. Agent Usage
```javascript
// Agent discovers through catalog
const catalog = await findCatalog();
const randomTool = catalog.tools.find(t => t.name === 'random');

// Or direct tool search
const tools = await searchTools({ name: 'random' });
```

## Key Differences

### Old Way (Current)
- Tools defined in TypeScript files
- Registry holds tools in memory
- Catalog generated from memory state
- Restart required for new tools
- Configuration separate from definition

### New Way (RCRT-Native)
- Tools defined as breadcrumbs
- No in-memory registry needed
- Catalog aggregates breadcrumbs
- Tools added/removed dynamically
- Definition + config in one breadcrumb

## Implementation Steps

1. **Update Tool Creation**
   - Tools create `tool.v1` breadcrumbs on startup
   - Include examples in breadcrumb

2. **Update Catalog Builder**
   - Search for tool.v1 breadcrumbs
   - Aggregate into catalog
   - Watch for changes

3. **Update Tool Runner**
   - Map tool names to implementations
   - Read config from tool breadcrumbs
   - No memory registry needed

4. **Update Agents**
   - Read examples from tool definitions
   - Use correct field access patterns
   - No hardcoded tool knowledge

## Benefits

1. **True Decentralization** - Tools can come from anywhere
2. **Dynamic System** - Add tools without restart
3. **Self-Documenting** - Tools explain themselves
4. **Version History** - Breadcrumb versions track changes
5. **Observable** - All changes create events
