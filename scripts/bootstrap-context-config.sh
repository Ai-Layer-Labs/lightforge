#!/bin/bash
# Create context.config.v1 for default-chat-assistant

echo "🔧 Creating context.config.v1 for default-chat-assistant..."

curl -X POST http://localhost:8081/breadcrumbs \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: ctx-cfg-default-chat-v1' \
  -d '{
    "schema_name": "context.config.v1",
    "title": "Context Config for default-chat-assistant",
    "tags": ["context:config", "consumer:default-chat-assistant", "workspace:tools"],
    "context": {
      "consumer_id": "default-chat-assistant",
      "consumer_type": "agent",
      "sources": [
        {
          "schema_name": "user.message.v1",
          "method": "vector",
          "nn": 5,
          "filters": {"tag": "extension:chat"}
        },
        {
          "schema_name": "tool.response.v1",
          "method": "recent",
          "limit": 3,
          "filters": {
            "context_match": [{
              "path": "$.requestedBy",
              "op": "eq",
              "value": "default-chat-assistant"
            }]
          }
        },
        {
          "schema_name": "tool.catalog.v1",
          "method": "latest",
          "filters": {"tag": "workspace:tools"}
        }
      ],
      "update_triggers": [
        {
          "schema_name": "user.message.v1",
          "any_tags": ["user:message", "extension:chat"]
        },
        {
          "schema_name": "tool.response.v1",
          "context_match": [{
            "path": "$.requestedBy",
            "op": "eq",
            "value": "default-chat-assistant"
          }]
        }
      ],
      "output": {
        "schema_name": "agent.context.v1",
        "tags": ["agent:context", "consumer:default-chat-assistant"],
        "ttl_seconds": 3600
      },
      "formatting": {
        "max_tokens": 4000,
        "deduplication_threshold": 0.95
      }
    }
  }'

echo ""
echo "✅ context.config.v1 created!"
echo "📡 tools-runner will detect it via SSE and start maintaining agent.context.v1"

