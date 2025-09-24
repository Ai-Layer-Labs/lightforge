# RCRT Deployment Checklist

## ✅ **Complete Deployment Steps**

### 1. **Start Services**
```bash
docker-compose up -d
```

### 2. **Ensure Agent Registration** (CRITICAL)
```bash
# Run the agent registration script
./scripts/ensure-agents.sh

# Or manually register if needed:
curl -X POST http://localhost:8081/agents/00000000-0000-0000-0000-0000000000aa \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(curl -s http://localhost:8082/api/auth/token | grep -o '"token":"[^"]*"' | cut -d'"' -f4)" \
  -d '{"roles": ["curator", "emitter", "subscriber"]}'
```

### 3. **Verify System Health**
```bash
# Check all services are running
docker-compose ps

# Test endpoints
curl http://localhost:8082/health           # Dashboard health
curl http://localhost:8081/health           # RCRT health
curl http://localhost:8082/api/agents       # Agents list
curl http://localhost:8082/api/breadcrumbs  # Breadcrumbs list
curl http://localhost:8082/api/secrets      # Secrets list
```

### 4. **Access Dashboard**
- Open: `http://localhost:8082`
- Should see canvas with nodes (breadcrumbs, agents, tools, secrets)
- Left panel should have all management sections
- No "Loading breadcrumbs..." stuck state

## 🚨 **Common Issues & Solutions**

### Issue: "Loading breadcrumbs..." stuck
**Cause**: Missing agent registration (FK constraint violation)
**Solution**: Run `./scripts/ensure-agents.sh`

### Issue: JWT token errors
**Cause**: Service startup order
**Solution**: System has automatic retry logic, wait 2-3 minutes

### Issue: Secrets not visible
**Cause**: No secrets created yet
**Solution**: Use left panel "🔐 Secrets" section to create secrets

### Issue: No connection lines
**Cause**: No tool configurations exist
**Solution**: Click tool node → Configure → Map secret → Save

## 🎯 **Expected System State After Deployment**

- **Agents**: 3 registered (RCRT, Dashboard, Tools Runner)
- **Breadcrumbs**: Variable (depends on activity)
- **Secrets**: 0+ (create as needed)
- **Tool Configs**: 0+ (create by configuring tools)

## 🔧 **Post-Deployment Setup**

### Configure OpenRouter Tool
1. Create secret: `OPENROUTER_API_KEY` with your actual API key
2. Click OpenRouter tool node (🧠) on canvas
3. Click "Configure" in left panel
4. Select the API key secret
5. Save configuration
6. See connection line appear

### Create Additional Secrets
- Use "🔐 Secrets" section in left panel
- Support global, workspace, and agent scopes
- Encrypted storage with audit trails

## 🚀 **Production Readiness**

The system is now production-ready with:
- ✅ Resilient startup (services can start in any order)
- ✅ Automatic JWT renewal (no token expiration issues)
- ✅ Complete secrets management (visual + API)
- ✅ Tool configuration interface
- ✅ Visual relationship mapping
- ✅ 3D visualization support
- ✅ Comprehensive error handling

**Total Implementation**: Resilient startup + Complete secrets management system
