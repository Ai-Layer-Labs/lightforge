# RCRT Schedule System

## Overview

The RCRT schedule system enables time-based automation using a pure breadcrumb-driven approach. Schedules are defined as breadcrumbs, and the scheduler tool publishes tick breadcrumbs when schedules fire. Tools subscribe to ticks they care about.

## Architecture

```
┌────────────────────────────────────┐
│  schedule.definition.v1            │
│  (Breadcrumb defining when to run) │
└────────────────────────────────────┘
              ↓
      ┌───────────────┐
      │  Scheduler    │
      │  Tool         │
      │  (Continuous) │
      └───────────────┘
              ↓
┌────────────────────────────────────┐
│  schedule.tick.v1                  │
│  (Published when schedule fires)   │
└────────────────────────────────────┘
              ↓
┌────────────────────────────────────┐
│  Tools with Subscriptions          │
│  (Auto-execute when tick matches)  │
└────────────────────────────────────┘
```

## Schema: schedule.definition.v1

### Structure

```json
{
  "schema_name": "schedule.definition.v1",
  "title": "Daily Models Sync",
  "tags": ["schedule", "workspace:tools"],
  "context": {
    "interval": {
      "type": "daily",
      "time": "09:00",
      "timezone": "UTC"
    },
    "enabled": true,
    "labels": ["interval:daily", "time:09:00"]
  }
}
```

### Fields

#### `context.interval` (required)

Defines when the schedule should fire.

**Type**: `object`

**Properties**:
- `type` (required): Interval type
  - `"minutely"` - Every N minutes
  - `"hourly"` - Every hour at specific minute
  - `"daily"` - Every day at specific time
  - `"weekly"` - Specific days of week at specific time
  - `"monthly"` - Specific day of month or nth weekday

#### `context.enabled` (required)

Whether the schedule is active.

**Type**: `boolean`  
**Default**: `true`

#### `context.labels` (required)

Tags that will be added to tick breadcrumbs for tool subscription matching.

**Type**: `string[]`  
**Example**: `["interval:daily", "time:09:00"]`

### Interval Types

#### Minutely

Run every N minutes.

```json
{
  "type": "minutely",
  "every_n_minutes": 15
}
```

**Fields**:
- `every_n_minutes` (optional): How many minutes between runs (1, 5, 15, 30, 60)
- Default: `1`

**Labels**: `["interval:minutely"]` or `["interval:minutely", "every:15"]`

#### Hourly

Run every hour at a specific minute.

```json
{
  "type": "hourly",
  "minute": 30
}
```

**Fields**:
- `minute` (optional): Minute of the hour (0-59)
- Default: `0`

**Labels**: `["interval:hourly"]` or `["interval:hourly", "minute:30"]`

#### Daily

Run every day at a specific time.

```json
{
  "type": "daily",
  "time": "09:00",
  "timezone": "UTC"
}
```

**Fields**:
- `time` (required): Time in HH:MM format (24-hour)
- `timezone` (optional): Timezone (default: UTC)

**Labels**: `["interval:daily", "time:09:00"]`

#### Weekly

Run on specific days of the week at a specific time.

```json
{
  "type": "weekly",
  "time": "09:00",
  "weekdays": ["mon", "wed", "fri"],
  "timezone": "UTC"
}
```

**Fields**:
- `time` (required): Time in HH:MM format (24-hour)
- `weekdays` (required): Array of weekday codes
  - `"mon"`, `"tue"`, `"wed"`, `"thu"`, `"fri"`, `"sat"`, `"sun"`
- `timezone` (optional): Timezone (default: UTC)

**Labels**: `["interval:weekly", "time:09:00", "weekdays:mon-wed-fri"]`

#### Monthly

Run on a specific day of the month or nth weekday.

**Option 1: Specific day of month**

```json
{
  "type": "monthly",
  "time": "00:00",
  "day_of_month": 1,
  "timezone": "UTC"
}
```

**Fields**:
- `time` (required): Time in HH:MM format (24-hour)
- `day_of_month` (required): Day of month (1-31)
- `timezone` (optional): Timezone (default: UTC)

**Labels**: `["interval:monthly", "time:00:00", "day:1"]`

**Option 2: Nth weekday**

```json
{
  "type": "monthly",
  "time": "14:00",
  "nth_weekday": {
    "nth": 2,
    "weekday": "tue"
  },
  "timezone": "UTC"
}
```

**Fields**:
- `time` (required): Time in HH:MM format (24-hour)
- `nth_weekday` (required): Object with:
  - `nth`: Which occurrence (1-4 or "last")
  - `weekday`: Weekday code
- `timezone` (optional): Timezone (default: UTC)

**Labels**: `["interval:monthly", "time:14:00", "nth:2nd-tue"]`

## Schema: schedule.tick.v1

Published by the scheduler when a schedule fires.

### Structure

```json
{
  "schema_name": "schedule.tick.v1",
  "title": "Schedule Tick: Daily Models Sync",
  "tags": ["schedule:tick", "interval:daily", "time:09:00"],
  "context": {
    "schedule_id": "abc-123-def",
    "schedule_title": "Daily Models Sync",
    "fired_at": "2025-10-30T09:00:00Z",
    "interval_type": "daily",
    "interval_details": {
      "type": "daily",
      "time": "09:00"
    }
  },
  "ttl": "2025-10-30T09:05:00Z"
}
```

### Fields

#### `context.schedule_id`

ID of the schedule definition that fired.

#### `context.fired_at`

ISO timestamp when the tick was published.

#### `context.interval_type`

Type of interval that fired.

#### `context.interval_details`

Complete interval configuration from the schedule definition.

### TTL

Tick breadcrumbs automatically expire after 5 minutes to prevent accumulation.

## Tool Subscriptions

Tools subscribe to schedule ticks using the `subscriptions` field:

```json
{
  "schema_name": "tool.code.v1",
  "context": {
    "name": "my_tool",
    "subscriptions": [
      {
        "schema_name": "schedule.tick.v1",
        "tag": "interval:daily",
        "description": "Run daily"
      }
    ]
  }
}
```

### Subscription Matching

Tools execute when a tick breadcrumb matches ALL of:
1. `schema_name` matches subscription
2. `tag` (if specified) exists in tick tags

### Example Subscriptions

**Run every day:**
```json
{
  "schema_name": "schedule.tick.v1",
  "tag": "interval:daily"
}
```

**Run on weekdays only:**
```json
{
  "schema_name": "schedule.tick.v1",
  "tag": "weekdays:mon-tue-wed-thu-fri"
}
```

**Run at specific time:**
```json
{
  "schema_name": "schedule.tick.v1",
  "tag": "time:09:00"
}
```

**Run every 15 minutes:**
```json
{
  "schema_name": "schedule.tick.v1",
  "tag": "every:15"
}
```

## Creating Schedules

### Via API

```typescript
await client.createBreadcrumb({
  schema_name: 'schedule.definition.v1',
  title: 'Daily Models Sync',
  tags: ['schedule', 'workspace:tools'],
  context: {
    interval: {
      type: 'daily',
      time: '09:00',
      timezone: 'UTC'
    },
    enabled: true,
    labels: ['interval:daily', 'time:09:00']
  }
});
```

### Via Bootstrap (Future)

Bootstrap breadcrumbs can create schedule definitions on first run.

## Scheduler Tool

The scheduler is a self-contained tool that runs continuously.

### How It Works

1. **Loads**: Searches for all `schedule.definition.v1` breadcrumbs
2. **Checks**: Every minute, evaluates which schedules should fire
3. **Publishes**: Creates `schedule.tick.v1` breadcrumbs for firing schedules
4. **Repeats**: Runs continuously until stopped

### Configuration

The scheduler has minimal configuration:

```json
{
  "check_interval_ms": 60000  // How often to check (default: 1 minute)
}
```

### Bootstrap

The scheduler auto-starts with high priority:

```json
"bootstrap": {
  "enabled": true,
  "mode": "continuous",
  "priority": 100
}
```

### Deduplication

The scheduler tracks last fire times to prevent duplicate ticks within the same minute.

## Examples

### Example 1: Daily Data Sync

**Schedule Definition:**
```json
{
  "schema_name": "schedule.definition.v1",
  "title": "Daily Models Sync",
  "tags": ["schedule", "workspace:tools"],
  "context": {
    "interval": {
      "type": "daily",
      "time": "09:00"
    },
    "enabled": true,
    "labels": ["interval:daily", "time:09:00"]
  }
}
```

**Tool Subscription:**
```json
{
  "context": {
    "name": "openrouter_models_sync",
    "subscriptions": [
      {
        "schema_name": "schedule.tick.v1",
        "tag": "interval:daily"
      }
    ]
  }
}
```

**Result**: Models sync runs every day at 9:00 AM UTC.

### Example 2: Weekday Reports

**Schedule Definition:**
```json
{
  "schema_name": "schedule.definition.v1",
  "title": "Weekday Report Generation",
  "tags": ["schedule", "workspace:reports"],
  "context": {
    "interval": {
      "type": "weekly",
      "time": "17:00",
      "weekdays": ["mon", "tue", "wed", "thu", "fri"]
    },
    "enabled": true,
    "labels": ["interval:weekly", "time:17:00", "weekdays:mon-tue-wed-thu-fri"]
  }
}
```

**Tool Subscription:**
```json
{
  "subscriptions": [
    {
      "schema_name": "schedule.tick.v1",
      "tag": "interval:weekly"
    }
  ]
}
```

**Result**: Report tool runs at 5 PM on weekdays.

### Example 3: Monthly Cleanup

**Schedule Definition:**
```json
{
  "schema_name": "schedule.definition.v1",
  "title": "Monthly Cleanup",
  "tags": ["schedule", "workspace:tools"],
  "context": {
    "interval": {
      "type": "monthly",
      "time": "00:00",
      "day_of_month": 1
    },
    "enabled": true,
    "labels": ["interval:monthly", "time:00:00", "day:1"]
  }
}
```

**Result**: Cleanup runs at midnight on the 1st of each month.

## Best Practices

1. **Use descriptive titles**: Schedule titles appear in tick breadcrumbs
2. **Add appropriate labels**: Labels enable precise tool subscription matching
3. **Set realistic intervals**: Don't schedule tasks more frequently than needed
4. **Use UTC by default**: Avoids DST complications
5. **Disable instead of delete**: Set `enabled: false` to temporarily disable
6. **Monitor tick breadcrumbs**: Check if schedules are firing as expected
7. **Keep tools idempotent**: Tools should handle being called multiple times safely

## Troubleshooting

### Schedule not firing

1. Check if scheduler tool is running: Look for continuous execution logs
2. Verify schedule is enabled: `context.enabled` should be `true`
3. Check time/timezone: Ensure time format is correct (HH:MM 24-hour)
4. Verify labels: Labels must match tool subscription tags exactly

### Tool not executing on tick

1. Check tool subscription: `schema_name` must be `schedule.tick.v1`
2. Verify tag matching: Tool's subscription tag must exist in tick tags
3. Check tools-runner logs: Look for subscription matching messages
4. Ensure tool is loaded: Tool must be in `tool.code.v1` format

### Multiple executions

1. Check for duplicate schedules: Search for similar schedule definitions
2. Verify deduplication: Scheduler should prevent duplicate ticks within 1 minute
3. Check tool logic: Ensure tool is idempotent

## See Also

- [tool.code.v1 Schema](./TOOL_CODE_V1_SCHEMA.md) - Bootstrap and subscription configuration
- [Dynamic Configuration](../DYNAMIC_CONFIG_IMPLEMENTATION_SUMMARY.md) - UI configuration for tools

