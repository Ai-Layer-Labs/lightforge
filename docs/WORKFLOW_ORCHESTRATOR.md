# Workflow Orchestrator Tool

The Workflow Orchestrator is a powerful meta-tool that enables complex multi-step operations with dependencies in the RCRT system.

## Overview

The workflow tool was designed collaboratively with the RCRT agent to address the need for chaining multiple tool operations together with proper dependency management and variable interpolation.

## Key Features

1. **Dependency Management** - Steps can declare dependencies on other steps
2. **Variable Interpolation** - Use `${stepId}` or `${stepId.field}` syntax to reference outputs
3. **Syntax Auto-Correction** - Automatically converts `{{variable}}` to `${variable}` for compatibility
4. **Parallel Execution** - Steps without dependencies run in parallel
5. **Error Handling** - Option to continue on errors or fail fast
6. **Progress Tracking** - Emits progress breadcrumbs for each step
7. **Full Observability** - All operations flow through breadcrumbs

## Usage

**Important**: Always check your tool catalog breadcrumb for available tools. Tool names in examples are illustrative.

### Basic Example: Combining Multiple Operations

```json
{
  "tool": "workflow",
  "input": {
    "steps": [
      {
        "id": "input1",
        "tool": "[tool from catalog that generates data]",
        "input": {"param": "value"}
      },
      {
        "id": "input2",
        "tool": "[another data generation tool]",
        "input": {"param": "value"}
      },
      {
        "id": "process",
        "tool": "[processing tool from catalog]",
        "input": {"data1": "${input1}", "data2": "${input2}"},
        "dependencies": ["input1", "input2"]
      }
    ],
    "returnStep": "process"
  }
}
```

### Advanced Example: Analysis Pipeline

```json
{
  "tool": "workflow",
  "input": {
    "steps": [
      {
        "id": "data",
        "tool": "[data generation tool from catalog]",
        "input": {"parameters": "as per tool schema"}
      },
      {
        "id": "process",
        "tool": "[processing/calculation tool]",
        "input": {"data": "${data}", "operation": "aggregate"},
        "dependencies": ["data"]
      },
      {
        "id": "analysis",
        "tool": "[LLM or analysis tool from catalog]",
        "input": {
          "prompt": "Analyze the data: ${data} with result: ${process}",
          "additional_params": "as per tool schema"
        },
        "dependencies": ["data", "process"]
      }
    ],
    "returnStep": "analysis"
  }
}
```

## How It Works

1. **Request Processing**
   - Agent sends a single `tool.request.v1` for the workflow
   - Workflow tool validates dependencies and creates execution plan

2. **Step Execution**
   - Creates internal `tool.request.v1` breadcrumbs for each step
   - Executes steps in dependency order (parallel when possible)
   - Waits for `tool.response.v1` breadcrumbs from each tool

3. **Variable Interpolation**
   - Replaces `${stepId}` with the output from that step
   - Supports nested field access: `${stepId.field.subfield}`
   - Works in strings, objects, and arrays

4. **Result Aggregation**
   - Collects all step results
   - Returns specific step result if `returnStep` is specified
   - Otherwise returns full execution summary

## Error Handling

- By default, workflow fails on first error
- Set `continueOnError: true` to continue after failures
- Failed steps are recorded in the `errors` field
- Dependent steps of failed steps will also fail

## Testing

Use the provided test script:

```bash
node test-workflow-tool.js
```

## Implementation Details

- Located in: `rcrt-visual-builder/packages/tools/src/workflow-orchestrator.ts`
- Integrated with builtin tools registry
- Uses topological sort for dependency resolution
- 60-second timeout per tool execution
- Full breadcrumb trail for debugging

## Agent Integration

The default chat agent has been updated to understand and use the workflow tool:

- Updated system prompt with workflow examples
- Agent can suggest workflow usage for multi-step tasks
- Full support for complex orchestration patterns

## Future Enhancements

Potential improvements identified during design:

1. **Conditional Steps** - Execute steps based on conditions
2. **Loop Support** - Iterate over arrays or repeat steps
3. **Retry Logic** - Automatic retry for failed steps
4. **Step Templates** - Reusable workflow patterns
5. **Visualization** - Workflow execution diagrams

## Credits

This tool was designed through a collaborative discussion between the human operator and the RCRT agent, demonstrating the system's ability to participate in its own evolution!
