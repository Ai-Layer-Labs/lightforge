# Bootstrap Consolidation Plan

## Problem Statement

The RCRT system has scattered bootstrap logic with:
- ❌ Multiple agent definition files (4+ versions)
- ❌ Hardcoded fallbacks in multiple scripts
- ❌ Tools bootstrapped from code instead of data
- ❌ Duplicate loader scripts
- ❌ No clear single source of truth

## Solution: Single Source of Truth

### Principle
**`bootstrap-breadcrumbs/` is the ONLY source for bootstrap data. No fallbacks, no hardcoding, no duplicates.**

## New Directory Structure

```
bootstrap-breadcrumbs/
├── system/                      # Core system breadcrumbs
│   ├── bootstrap-marker.json    # Marks system as bootstrapped
│   └── default-chat-agent.json  # THE ONLY agent definition
├── tools/                       # Tool definitions (NEW!)
│   ├── openrouter.json
│   ├── random.json
│   ├── context-builder.json
│   └── ... (one file per tool)
├── templates/                   # Templates for users
│   ├── agent-definition-template.json
│   └── tool-definition-template.json
├── bootstrap.js                 # THE ONLY bootstrap script
├── package.json
└── README.md
```

## Files to Delete

### Duplicate Agent Definitions
- [x] `scripts/default-chat-agent.json`
- [x] `scripts/default-chat-agent-v2.json`
- [x] `bootstrap-breadcrumbs/system/default-chat-agent-v3.json`
- [x] Keep ONLY: `bootstrap-breadcrumbs/system/default-chat-agent.json`

### Duplicate Loader Scripts
- [x] `ensure-default-agent.js` (root)
- [x] `rcrt-visual-builder/apps/agent-runner/ensure-default-agent.js`
- [x] `rcrt-visual-builder/apps/agent-runner/ensure-default-agent-simple.js`
- [x] `scripts/load-default-agent.js`
- [x] Keep ONLY: `bootstrap-breadcrumbs/bootstrap.js`

### Duplicate Templates
- [x] `template-breadcrumbs/agent-definition-template.json`
- [x] Keep ONLY: `bootstrap-breadcrumbs/templates/agent-definition-template.json`

## Files to Modify

### 1. bootstrap-breadcrumbs/bootstrap.js
**Current**: Loads from system/ and templates/
**Change**: Also load from tools/

```javascript
// Add tools loading
const toolsDir = path.join(__dirname, 'tools');
const toolFiles = fs.readdirSync(toolsDir).filter(f => f.endsWith('.json'));

for (const file of toolFiles) {
  const data = JSON.parse(fs.readFileSync(path.join(toolsDir, file), 'utf-8'));
  
  // Ensure it's tool.v1 schema
  if (data.schema_name !== 'tool.v1') {
    console.warn(`Skipping ${file} - not a tool.v1 breadcrumb`);
    continue;
  }
  
  // Create tool breadcrumb
  await api('POST', '/breadcrumbs', data);
}
```

### 2. setup.sh
**Current**: Calls `ensure-default-agent.js`
**Change**: Call `bootstrap-breadcrumbs/bootstrap.js`

```bash
# Replace this:
node ensure-default-agent.js

# With this:
cd bootstrap-breadcrumbs && npm install && node bootstrap.js
```

### 3. rcrt-visual-builder/packages/tools/src/bootstrap-tools.ts
**Current**: Bootstraps from hardcoded builtinTools object
**Change**: Load from breadcrumbs OR keep for backward compatibility but prefer breadcrumbs

```typescript
// Check if tool.v1 breadcrumb already exists
const existing = await client.searchBreadcrumbs({
  schema_name: 'tool.v1',
  tag: `tool:${name}`
});

if (existing.length > 0) {
  console.log(`✅ Tool ${name} already exists in breadcrumbs - skipping code bootstrap`);
  continue;
}

// Only create from code if doesn't exist in breadcrumbs
```

### 4. Remove hardcoded fallbacks
**File**: `rcrt-visual-builder/apps/agent-runner/ensure-default-agent.js`
**Lines 44-105**: Hardcoded agent definition
**Change**: Remove fallback, fail fast if file not found

```typescript
// REMOVE hardcoded fallback (lines 44-105)
// If file not found, throw error - force use of bootstrap-breadcrumbs/
throw new Error('Agent definition not found. Run bootstrap-breadcrumbs/bootstrap.js first');
```

## Implementation Order

1. ✅ Create `bootstrap-breadcrumbs/tools/` directory
2. ✅ Convert all builtinTools to JSON files in tools/
3. ✅ Update `bootstrap-breadcrumbs/bootstrap.js` to load tools
4. ✅ Remove hardcoded fallbacks from all loader scripts
5. ✅ Delete duplicate agent definition files
6. ✅ Delete duplicate loader scripts
7. ✅ Update `setup.sh` to use consolidated bootstrap
8. ✅ Update `tools-runner` to check breadcrumbs before code
9. ✅ Document the new pattern

## Testing Plan

1. Clean database: `docker compose down -v`
2. Run: `./setup.sh`
3. Verify:
   - Only ONE agent definition loaded
   - All tools loaded from JSON files
   - No fallbacks triggered
   - All scripts reference bootstrap-breadcrumbs/

## Benefits

✅ **Single source of truth** - All bootstrap data in one place
✅ **No hardcoding** - Everything is data-driven
✅ **Easy updates** - Edit JSON files, not code
✅ **Version control** - See exact agent definitions in git
✅ **Portable** - Fork repo and customize JSON files
✅ **Testable** - Clear bootstrap process
✅ **Transparent** - Users see exactly what's bootstrapped

## Migration for Existing Deployments

```bash
# 1. Backup current database
docker exec db pg_dump -U postgres rcrt > backup.sql

# 2. Pull latest code
git pull

# 3. Clean and restart
docker compose down -v
rm .env docker-compose.override.yml
./setup.sh

# 4. Restore data if needed
docker exec -i db psql -U postgres rcrt < backup.sql
```

