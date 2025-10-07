# Build Fix - Import Extensions

## 🔧 Issue

TypeScript build failing with module resolution error:
```
error TS2792: Cannot find module '@rcrt-builder/sdk'
```

## ✅ Fix

Removed `.js` extensions from internal imports:

```typescript
// Before:
import { UniversalExecutor } from '../executor/universal-executor.js';
import { extractAndParseJSON } from '../utils/json-repair.js';

// After:
import { UniversalExecutor } from '../executor/universal-executor';
import { extractAndParseJSON } from '../utils/json-repair';
```

**Reason:** TypeScript in build mode doesn't need/want explicit .js extensions for internal imports in a monorepo with workspace dependencies.

## Files Fixed

- ✅ `packages/runtime/src/agent/agent-executor.ts`
- ✅ `packages/runtime/src/tool/tool-executor.ts`
- ✅ `packages/runtime/src/executor/index.ts`

## Rebuild

```bash
docker compose build
```

Should now compile successfully!
