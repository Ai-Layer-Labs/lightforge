# JQ Transform and Hygiene Fix

## Issues Fixed

### 1. JQ Transform Not Implemented
**Problem**: Breadcrumbs were being created with `llm_hints` using JQ transforms, but RCRT server doesn't support JQ yet.

**Solution**: Changed all JQ transforms to use `template` type instead:
- Updated `rcrt-visual-builder/packages/tools/src/registry.ts` - tool catalog breadcrumb
- Updated `template-breadcrumbs/llm-hints-guide.json` - example documentation
- Updated `bootstrap-breadcrumbs/templates/llm-hints-guide.json` - bootstrap template

**Example Change**:
```javascript
// Before (not supported):
categories: {
  type: 'jq',
  query: '.tools | map(.category) | unique'
}

// After (supported):
categories: {
  type: 'template',
  template: '{{#each context.tools}}{{#unless @first}}, {{/unless}}{{this.category}}{{/each}}'
}
```

### 2. Hygiene Foreign Key Violation
**Problem**: Hygiene process was trying to create monitoring breadcrumbs with a non-existent agent ID.

**Solution**: 
1. Updated hygiene stats emission to use proper default UUIDs instead of nil
2. Added agent existence check before creating breadcrumbs
3. Created SQL script to ensure system agents exist
4. Updated setup script to create system agents on initialization

**Files Changed**:
- `crates/rcrt-server/src/hygiene.rs` - Use default UUIDs and check agent existence
- `scripts/ensure-system-agent.sql` - SQL to create system agents
- `scripts/ensure-system-agents.sh` - Script to run the SQL
- `setup.sh` - Run agent creation during setup

## Next Steps

1. Rebuild the tools package:
   ```bash
   cd rcrt-visual-builder
   pnpm --filter '@rcrt-builder/tools' run build
   ```

2. Rebuild the Rust server:
   ```bash
   cargo build -p rcrt-server
   ```

3. Set the AGENT_ID environment variable:
   ```bash
   export AGENT_ID=00000000-0000-0000-0000-0000000000aa
   ```

The system will now:
- Use supported transform types only (template, extract, literal)
- Ensure system agents exist before creating breadcrumbs
- Avoid foreign key violations in hygiene stats
