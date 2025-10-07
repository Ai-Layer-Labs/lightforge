# Quick Fix for Fresh Deployments

## Issue

Fresh deployments are using OLD agent definition without the new universal executor subscriptions.

## What's Wrong

**Old agent (in ensure-default-agent.js):**
```javascript
subscriptions: {
  selectors: [
    {"schema_name": "user.message.v1"},  // No role!
    {"schema_name": "tool.catalog.v1"},  // No role!
    {"schema_name": "tool.response.v1"}  // No role!
  ]
}
```

**New agent (in bootstrap-breadcrumbs/system/default-chat-agent.json):**
```json
{
  "subscriptions": {
    "selectors": [
      {
        "schema_name": "agent.context.v1",
        "role": "trigger",
        "key": "assembled_context"
      },
      {
        "schema_name": "browser.page.context.v1",
        "role": "context",
        "key": "browser"
      },
      ...
    ]
  }
}
```

## The Fix

After starting the system, manually upload the correct agent definition:

```bash
# Delete old agent
curl -X DELETE http://localhost:8081/breadcrumbs/{old-agent-id}

# Upload new agent
curl -X POST http://localhost:8081/breadcrumbs \
  -H "Content-Type: application/json" \
  --data @bootstrap-breadcrumbs/system/default-chat-agent.json

# Restart agent-runner
docker compose restart agent-runner
```

## The Real Fix

Update `apps/agent-runner/ensure-default-agent-simple.js` to use the new format from `bootstrap-breadcrumbs/system/default-chat-agent.json`.

The hardcoded definition in ensure-default-agent-simple.js is outdated!

## Test After Fix

Check logs for:
```
📡 Subscriptions: 7
  - user.message.v1 (role: trigger, ...)
  - agent.context.v1 (role: trigger, ...)
  - browser.page.context.v1 (role: context, ...)
  ...
```

NOT:
```
📡 Subscriptions: 3
  - user.message.v1 (role: undefined, ...)  ❌
```
