# Single Tool Catalog Implementation

## Problem Solved

Previously, the tool system had a design flaw where:
- ❌ Multiple `tool.catalog.v1` breadcrumbs were created (one per publishCatalog call)  
- ❌ Individual `tool.definition.v1` breadcrumbs were created for each tool
- ❌ No single source of truth for tool discovery
- ❌ Inefficient for agents to query multiple breadcrumbs

## Solution Implemented

### ✅ Single Catalog Breadcrumb Approach

**Key Changes:**

1. **Catalog Persistence**: Added `catalogBreadcrumbId` tracking to maintain a single catalog breadcrumb per workspace

2. **Initialization Logic**: `initializeCatalog()` method that:
   - Searches for existing catalog breadcrumb on startup
   - Loads existing tools from catalog if found
   - Creates new catalog only if none exists

3. **Update Instead of Create**: `updateCatalog()` method that:
   - Updates the existing catalog breadcrumb via PATCH
   - Uses optimistic concurrency control (If-Match header)
   - Recreates catalog if original was deleted externally

4. **Removed Individual Definitions**: Eliminated `tool.definition.v1` breadcrumbs in favor of centralized catalog

## Result

### Before:
```bash
# Multiple breadcrumbs to query
GET /breadcrumbs?schema_name=tool.catalog.v1     # Returns: [catalog1, catalog2, catalog3, ...]
GET /breadcrumbs?schema_name=tool.definition.v1  # Returns: [tool1, tool2, tool3, ...]
```

### After:
```bash
# Single catalog breadcrumb per workspace  
GET /breadcrumbs?tag=workspace:tools&schema_name=tool.catalog.v1  # Returns: [single_catalog]

# Catalog structure:
{
  "id": "catalog-uuid",
  "schema_name": "tool.catalog.v1", 
  "title": "workspace:tools Tool Catalog",
  "version": 5,  // Increments with each update
  "context": {
    "workspace": "workspace:tools",
    "tools": [
      {
        "name": "serpapi",
        "description": "Search the web using Google", 
        "status": "active",
        "category": "search",
        "inputSchema": { /* schema */ },
        "outputSchema": { /* schema */ },
        "lastSeen": "2025-01-10T..."
      },
      // ... all other tools
    ],
    "totalTools": 5,
    "activeTools": 4, 
    "lastUpdated": "2025-01-10T..."
  }
}
```

## Benefits

✅ **Efficient Discovery**: Agents query one breadcrumb instead of many  
✅ **Real-time Updates**: Catalog updates when tools are added/removed  
✅ **Version History**: See how tool availability changed over time via breadcrumb versions  
✅ **Clean Data**: No duplicate or stale tool definitions  
✅ **Event-Driven**: Catalog changes trigger SSE events for real-time UI updates  

## Agent Integration

Agents can now efficiently discover tools:

```typescript
// Simple, efficient tool discovery
const [catalog] = await client.searchBreadcrumbs({
  tag: 'workspace:tools',
  schema_name: 'tool.catalog.v1'
});

const availableTools = catalog.context.tools.filter(t => t.status === 'active');

// Use a tool
await client.createBreadcrumb({
  schema_name: 'tool.request.v1',
  context: { 
    tool: availableTools[0].name,
    input: { /* tool input */ }
  }
});
```

This implementation provides a much cleaner, more efficient, and more maintainable approach to tool catalog management in the RCRT ecosystem.
