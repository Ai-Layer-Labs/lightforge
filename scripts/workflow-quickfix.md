# Workflow Tool Quick Fix

## The Issue
The agent is using the wrong field names when accessing tool outputs in workflows.

## Random Tool Output Schema
```json
{
  "numbers": [42, 73, ...]  // Array of random numbers
}
```

## Correct Usage in Workflow
```json
{
  "tool": "workflow",
  "input": {
    "steps": [
      {
        "id": "num1",
        "tool": "random",
        "input": {"min": 1, "max": 100}
      },
      {
        "id": "num2", 
        "tool": "random",
        "input": {"min": 1, "max": 100}
      },
      {
        "id": "sum",
        "tool": "calculator",
        "input": {
          "expression": "${num1.numbers[0]} + ${num2.numbers[0]}"
        },
        "dependencies": ["num1", "num2"]
      }
    ]
  }
}
```

## What the Agent is Doing Wrong
- Using: `${random_number_1.value}`
- Should use: `${random_number_1.numbers[0]}`

## Auto-Correction
The workflow tool now automatically converts `{{}}` to `${}` syntax, but it can't fix incorrect field access.

## Agent Education Needed
The agent needs to:
1. Check tool output schemas in the catalog
2. Use the correct field names based on actual tool outputs
3. For random tool: access the first number with `.numbers[0]`
