# Extension Build Fixed

## The Error
```
ReferenceError: conversationId is not defined
```

## The Fix
Changed from `conversationId` to `contextId`:

```typescript
// BEFORE
ID: {conversationId.slice(-8)}

// AFTER  
{contextId ? `Context: ${contextId.slice(0, 8)}...` : 'New conversation'}
```

## Rebuild

```powershell
cd extension
npm run build

# Load in Chrome
# Should work now!
```

---

**Status**: ✅ FIXED  
**Ready**: Rebuild extension
