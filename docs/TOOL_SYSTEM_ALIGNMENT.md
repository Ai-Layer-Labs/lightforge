# RCRT Tool System Alignment

## What We Fixed

### 1. Merged Definition + Configuration
Instead of separate breadcrumbs:
- ❌ `tool.definition.v1` + `tool.config.v1`
- ✅ Single `tool.v1` breadcrumb with both

### 2. Added Examples to Tools
Tools now include examples showing:
- Input/output pairs
- How to access output fields
- Workflow variable syntax
- Common usage patterns

### 3. Created Bootstrap Infrastructure
Added to `bootstrap-breadcrumbs/system/`:
- `tool-definition-template.json` - Template for creating tools
- `tool-creation-guide.json` - Guide explaining RCRT tool creation
- `random-tool-definition.json` - Example simple tool
- `openrouter-tool-definition.json` - Example configurable tool

### 4. Removed Hardcoded Knowledge
Agent prompts now:
- Don't mention specific tool names
- Tell agents to look at examples
- Emphasize learning from tool definitions

## The RCRT Tool Flow

```
1. Tool Creation
   └─> Create tool.v1 breadcrumb with examples

2. Tool Discovery  
   └─> Catalog aggregates from tool breadcrumbs
   
3. Agent Usage
   └─> Read catalog → Find tool → Study examples → Use correctly
   
4. Dynamic Updates
   └─> Add/remove tools without restart
```

## Key Principles

1. **Tools are breadcrumbs** - Not code registrations
2. **Self-documenting** - Examples show usage
3. **Dynamic discovery** - No hardcoded lists
4. **Single source** - Definition + config together
5. **Agent learning** - From examples, not instructions

## Implementation Checklist

- [x] Create unified tool.v1 schema
- [x] Add tool creation guide
- [x] Create example tool definitions
- [x] Update agent prompts
- [x] Document the flow
- [ ] Update tool registry to create breadcrumbs
- [ ] Update catalog to aggregate from breadcrumbs
- [ ] Update tool runner to read from breadcrumbs

## Benefits

1. **True RCRT** - Everything is a breadcrumb
2. **Dynamic** - Tools can come and go
3. **Self-teaching** - Agents learn from examples
4. **Versioned** - Tool changes tracked
5. **Distributed** - Tools from any source

## Next Steps

1. Modify `RCRTToolWrapper` to create tool.v1 breadcrumbs
2. Update catalog builder to search for tools
3. Test with example tools
4. Migrate existing tools

This alignment makes the tool system truly RCRT-native!
