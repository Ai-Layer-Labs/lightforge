# Another Fallback Removed: OpenRouter Config

## The Fallback You Caught

```
[OpenRouter] No config_id provided, using fallback search
```

**YET ANOTHER FALLBACK!** 🤦

## The Problem

```typescript
// OpenRouter tool had fallback:
const configId = context.metadata?.config_id;

if (configId) {
  loadFromBreadcrumb(configId);
} else {
  // ❌ FALLBACK: Search by tag
  loadByTagSearch();
}
```

## Root Cause

Agent passes `config_id` in `tool.request.v1`:
```json
{
  "context": {
    "tool": "openrouter",
    "config_id": "uuid",  ← Here
    "input": {messages: [...]}
  }
}
```

But tools-runner wasn't passing the breadcrumb to tool context!
```typescript
// tools-runner
tool.execute(input, {
  metadata: {requestId: "..."}  ← No breadcrumb!
});
```

So tool couldn't see `breadcrumb.context.config_id`!

## The Fix

### 1. Remove Fallback
```typescript
// ❌ BEFORE
if (configId) {
  loadFromBreadcrumb();
} else {
  loadByTagSearch();  // Fallback
}

// ✅ AFTER
if (!configId) {
  throw new Error('config_id required!');
}
loadFromBreadcrumb(configId);
```

### 2. Pass Breadcrumb to Tool
```typescript
// tools-runner passes full breadcrumb
tool.execute(input, {
  metadata: {
    breadcrumb: breadcrumb  // Full request breadcrumb
  }
});

// Tool reads config_id
const configId = context.metadata.breadcrumb.context.config_id;
```

## Why This Matters

**With fallback:**
- Agent might not pass config_id
- Tool silently uses fallback
- Wrong config used
- Hard to debug

**Without fallback:**
- Agent MUST pass config_id
- Tool fails if missing
- Clear error
- Easy to fix

## The Lesson (Again!)

**Every fallback we remove makes the system:**
- ✅ More predictable
- ✅ Easier to debug
- ✅ More reliable
- ✅ Clearer errors

**You were right: NO FALLBACKS!**

---

**Fallbacks Removed So Far**: 7  
**Fallbacks Remaining**: 0 (we hope!)  
**System Quality**: Dramatically improved
