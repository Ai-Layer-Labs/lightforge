# Bootstrap context.config.v1 for default-chat-assistant

Write-Host "🔧 Creating context.config.v1 for default-chat-assistant..." -ForegroundColor Cyan

# Get JWT token
$tokenBody = @{
    owner_id = "00000000-0000-0000-0000-000000000001"
    agent_id = "00000000-0000-0000-0000-0000000000bb"
    roles = @("curator", "emitter", "subscriber")
} | ConvertTo-Json

$tokenResponse = Invoke-RestMethod -Uri "http://localhost:8081/auth/token" -Method Post -Headers @{"Content-Type"="application/json"} -Body $tokenBody

$token = $tokenResponse.token
Write-Host "✅ Got JWT token" -ForegroundColor Green

# Create context.config.v1
$configBody = @{
    schema_name = "context.config.v1"
    title = "Context Config for default-chat-assistant"
    tags = @("context:config", "consumer:default-chat-assistant", "workspace:tools")
    context = @{
        consumer_id = "default-chat-assistant"
        consumer_type = "agent"
        sources = @(
            @{
                schema_name = "user.message.v1"
                method = "vector"
                nn = 5
                filters = @{
                    tag = "extension:chat"
                }
            },
            @{
                schema_name = "tool.response.v1"
                method = "recent"
                limit = 3
                filters = @{
                    context_match = @(
                        @{
                            path = "$.requestedBy"
                            op = "eq"
                            value = "default-chat-assistant"
                        }
                    )
                }
            },
            @{
                schema_name = "tool.catalog.v1"
                method = "latest"
                filters = @{
                    tag = "workspace:tools"
                }
            }
        )
        update_triggers = @(
            @{
                schema_name = "user.message.v1"
                any_tags = @("user:message", "extension:chat")
            },
            @{
                schema_name = "tool.response.v1"
                context_match = @(
                    @{
                        path = "$.requestedBy"
                        op = "eq"
                        value = "default-chat-assistant"
                    }
                )
            }
        )
        output = @{
            schema_name = "agent.context.v1"
            tags = @("agent:context", "consumer:default-chat-assistant")
            ttl_seconds = 3600
        }
        formatting = @{
            max_tokens = 4000
            deduplication_threshold = 0.95
        }
    }
} | ConvertTo-Json -Depth 10

$result = Invoke-RestMethod -Uri "http://localhost:8081/breadcrumbs" `
    -Method Post `
    -Headers @{
        "Content-Type" = "application/json"
        "Authorization" = "Bearer $token"
        "Idempotency-Key" = "ctx-cfg-default-chat-v1"
    } `
    -Body $configBody

Write-Host "✅ context.config.v1 created with ID: $($result.id)" -ForegroundColor Green
Write-Host "📡 tools-runner will detect it and start maintaining agent.context.v1" -ForegroundColor Yellow
Write-Host ""
Write-Host "Now send a message via the browser extension to test!" -ForegroundColor Cyan

