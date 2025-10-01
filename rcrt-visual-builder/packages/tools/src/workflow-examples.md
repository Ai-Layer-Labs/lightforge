# Workflow Orchestrator Tool Examples

The workflow orchestrator tool enables complex multi-step operations with dependencies.

**Important**: Tool names in these examples are illustrative. Always check your tool catalog breadcrumb for actual available tools and their exact names.

## Key Concepts

### Variable Interpolation
Use `${stepId}` to reference the output from a previous step:
- `${step1}` - References the entire output of step1
- `${step1.field}` - References a specific field from step1's output
- `${step1.array[0]}` - References array elements

### Dependencies
Steps with dependencies wait for those steps to complete before executing.

### Parallel Execution
Steps without dependencies or with the same dependencies run in parallel.

## Example Patterns

### Pattern 1: Sequential Processing
```json
{
  "tool": "workflow",
  "input": {
    "steps": [
      {
        "id": "step1",
        "tool": "[tool from catalog]",
        "input": { "param": "value" }
      },
      {
        "id": "step2",
        "tool": "[another tool]",
        "input": { "data": "${step1}" },
        "dependencies": ["step1"]
      },
      {
        "id": "step3",
        "tool": "[third tool]",
        "input": { "data": "${step2}" },
        "dependencies": ["step2"]
      }
    ]
  }
}
```

### Pattern 2: Parallel Processing with Aggregation
```json
{
  "tool": "workflow",
  "input": {
    "steps": [
      {
        "id": "parallel1",
        "tool": "[tool A]",
        "input": { "param": "value1" }
      },
      {
        "id": "parallel2",
        "tool": "[tool B]",
        "input": { "param": "value2" }
      },
      {
        "id": "aggregate",
        "tool": "[aggregation tool]",
        "input": {
          "data1": "${parallel1}",
          "data2": "${parallel2}"
        },
        "dependencies": ["parallel1", "parallel2"]
      }
    ],
    "returnStep": "aggregate"
  }
}
```

### Pattern 3: Error Handling
```json
{
  "tool": "workflow",
  "input": {
    "steps": [
      {
        "id": "risky_operation",
        "tool": "[tool that might fail]",
        "input": { "param": "value" }
      },
      {
        "id": "fallback",
        "tool": "[fallback tool]",
        "input": { "default": "safe_value" }
      }
    ],
    "continueOnError": true
  }
}
```

### Pattern 4: Complex Data Flow
```json
{
  "tool": "workflow",
  "input": {
    "steps": [
      {
        "id": "data_source",
        "tool": "[data generation tool]",
        "input": { "count": 5 }
      },
      {
        "id": "transform",
        "tool": "[transformation tool]",
        "input": { 
          "data": "${data_source}",
          "operation": "normalize"
        },
        "dependencies": ["data_source"]
      },
      {
        "id": "analyze",
        "tool": "[analysis tool]",
        "input": { 
          "original": "${data_source}",
          "transformed": "${transform}"
        },
        "dependencies": ["data_source", "transform"]
      }
    ],
    "returnStep": "analyze"
  }
}
```

## Output Mapping

Use `outputMapping` for advanced field mapping:

```json
{
  "id": "step2",
  "tool": "[some tool]",
  "input": {
    "preset_field": "value"
  },
  "dependencies": ["step1"],
  "outputMapping": {
    "step1.result": "dynamic_field",
    "step1.metadata.timestamp": "when"
  }
}
```

## Tips for Usage

1. **Check the Tool Catalog**: Always verify available tools and their schemas
2. **Plan Dependencies**: Map out which steps depend on others
3. **Use returnStep**: Specify which step's output you want as the final result
4. **Handle Errors**: Use `continueOnError` for workflows that should complete even if some steps fail
5. **Debug with Breadcrumbs**: All workflow steps create breadcrumbs for full observability

## Common Use Cases

- **Data Pipeline**: Generate → Transform → Analyze → Report
- **Multi-Source Aggregation**: Fetch from multiple sources → Combine → Process
- **Conditional Processing**: Check condition → Branch to appropriate tool
- **Batch Operations**: Process multiple items with the same workflow

Remember: The workflow tool is a meta-tool that orchestrates other tools. Its power comes from combining simple tools into complex operations!