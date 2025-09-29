# Workflow Orchestrator Tool Examples

The workflow orchestrator tool enables complex multi-step operations with dependencies.

## Example 1: Generate two random numbers and add them

```json
{
  "tool": "workflow",
  "input": {
    "steps": [
      {
        "id": "num1",
        "tool": "random_number",
        "input": {
          "min": 1,
          "max": 100
        }
      },
      {
        "id": "num2",
        "tool": "random_number",
        "input": {
          "min": 1,
          "max": 100
        }
      },
      {
        "id": "sum",
        "tool": "calculator",
        "input": {
          "expression": "${num1} + ${num2}"
        },
        "dependencies": ["num1", "num2"]
      }
    ],
    "returnStep": "sum"
  }
}
```

## Example 2: Generate number, calculate square root, set timer

```json
{
  "tool": "workflow",
  "input": {
    "steps": [
      {
        "id": "number",
        "tool": "random_number",
        "input": {
          "min": 10,
          "max": 50
        }
      },
      {
        "id": "sqrt",
        "tool": "calculator",
        "input": {
          "expression": "Math.sqrt(${number})"
        },
        "dependencies": ["number"]
      },
      {
        "id": "timer",
        "tool": "timer",
        "input": {
          "seconds": "${sqrt}"
        },
        "dependencies": ["sqrt"]
      }
    ]
  }
}
```

## Example 3: Using OpenRouter to analyze results

```json
{
  "tool": "workflow",
  "input": {
    "steps": [
      {
        "id": "nums",
        "tool": "random_number",
        "input": {
          "min": 1,
          "max": 100,
          "count": 5
        }
      },
      {
        "id": "analysis",
        "tool": "openrouter",
        "input": {
          "messages": [
            {
              "role": "user",
              "content": "Here are 5 random numbers: ${nums}. What's interesting about them?"
            }
          ],
          "model": "google/gemini-2.5-flash",
          "temperature": 0.7
        },
        "dependencies": ["nums"]
      }
    ],
    "returnStep": "analysis"
  }
}
```

## Features

1. **Variable Interpolation**: Use `${stepId}` or `${stepId.field}` to reference outputs
2. **Dependencies**: Steps wait for their dependencies to complete
3. **Parallel Execution**: Steps without dependencies run in parallel
4. **Error Handling**: Set `continueOnError: true` to continue after failures
5. **Selective Returns**: Use `returnStep` to return only specific step output
6. **Progress Updates**: Workflow emits progress breadcrumbs for monitoring

## How it works

1. Agent sends a single `tool.request.v1` for the workflow
2. Workflow orchestrator creates internal `tool.request.v1` for each step
3. Steps execute respecting dependencies
4. Results are interpolated into dependent steps
5. Final result returned via `tool.response.v1`

All steps are visible as breadcrumbs for full observability!

