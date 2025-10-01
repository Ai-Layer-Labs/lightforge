# Workflow Troubleshooting Guide

## Common Issues and Solutions

### 1. Variable Interpolation Errors

**Problem**: Calculator receives literal variable syntax like `{{step1}} + {{step2}}`

**Solution**: Use `${}` syntax, not `{{}}`
- ✅ Correct: `${step1}` or `${step1.field}`
- ❌ Wrong: `{{step1}}` or `{{step1.field}}`

**Note**: The workflow tool now automatically converts `{{}}` to `${}` syntax for compatibility. You'll see log messages like:
```
[Workflow] Auto-converted variable syntax: "{{random1}} + {{random2}}" → "${random1} + ${random2}"
```

### 2. Timeout Waiting for Tool Response

**Problem**: Workflow times out even though tool responses exist

**Possible Causes**:
- Response tagging mismatch
- Indexing delay in breadcrumb search
- Request ID format issues

**Solutions**:
1. Ensure tools-runner adds `request:${requestId}` tag to responses
2. Add initial delay for indexing (implemented in workflow tool)
3. Check that requestId format matches between request and response

### 3. Agent Not Seeing Workflow Progress

**Problem**: Agent only sees final error, not intermediate steps

**Solution**: Update agent subscriptions to include:
```json
{
  "schema_name": "agent.response.v1",
  "all_tags": ["workflow:progress"]
},
{
  "schema_name": "tool.response.v1",
  "all_tags": ["workspace:tools", "tool:response"]
}
```

### 4. Tools Not Found in Workflow

**Problem**: Workflow can't find tools by name

**Solution**: Ensure exact tool names from catalog are used:
- Check tool catalog for exact names
- Tool names are case-sensitive
- Use discovery pattern in test scripts

## Debugging Workflow Issues

### 1. Enable Verbose Logging
Check console logs for:
- `[Workflow] Starting workflow with N steps`
- `[Workflow] Step X: Calling tool with input`
- `[Workflow] Found response for requestId by tag/context`

### 2. Check Breadcrumb Trail
Look for these breadcrumbs in order:
1. `tool.request.v1` for workflow
2. `agent.response.v1` with `workflow:progress` tag
3. `tool.request.v1` for each step
4. `tool.response.v1` for each step
5. Final `tool.response.v1` for workflow

### 3. Verify Response Tags
Each tool response should have:
- `workspace:tools` tag
- `tool:response` tag
- `request:${requestId}` tag

### 4. Test Variable Interpolation
Create a simple test workflow:
```json
{
  "tool": "echo",
  "input": {
    "message": "Test: ${previousStep}"
  }
}
```

## RCRT-Native Solutions

### 1. Use Breadcrumb Context
Instead of external state, use breadcrumb context:
- Store workflow state in breadcrumbs
- Use `workflow:progress` events for updates
- Link steps via requestId relationships

### 2. Event-Driven Architecture
- Tools emit breadcrumbs immediately
- Workflow subscribes to responses
- Agent subscribes to progress

### 3. Transparent Debugging
All workflow operations create breadcrumbs:
- Every step request/response
- Progress updates
- Error details with context

### 4. Dynamic Tool Discovery
- Always fetch tool catalog first
- Use descriptions to find tools
- Never hardcode tool names

## Testing Workflow Issues

Use the test script with verbose output:
```bash
node test-workflow-tool.js
```

Check for:
1. Tool catalog loaded successfully
2. Correct tool names discovered
3. Request IDs match between request/response
4. Variable interpolation working

## Best Practices

1. **Always use `${}` syntax** for variables
2. **Subscribe agents to workflow events** for visibility
3. **Add descriptive step IDs** for debugging
4. **Use `returnStep`** to control output
5. **Enable `continueOnError`** for resilient workflows
6. **Check tool catalog** before creating workflows
7. **Use unique requestIds** for each workflow
