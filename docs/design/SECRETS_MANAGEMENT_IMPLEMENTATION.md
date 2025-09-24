# Comprehensive Secrets Management System

## Overview

I've implemented a complete secrets management system for the RCRT dashboard that provides:

1. **Visual secrets nodes on the canvas**
2. **CRUD operations for secrets management**
3. **Tool configuration with secret mapping**
4. **Visual connections showing secret usage**
5. **Integration with the existing dashboard UI**

## Features Implemented

### 🔐 Backend API Endpoints

**New Routes Added:**
- `POST /api/secrets` - Create new secret
- `PUT /api/secrets/:id` - Update secret value
- `DELETE /api/secrets/:id` - Delete secret
- `POST /api/secrets/:id/decrypt` - Decrypt secret (with audit logging)
- `GET /api/secrets` - List all secrets (enhanced from admin-only)

**Features:**
- Robust error handling with retry logic
- Automatic JWT token management
- Comprehensive input validation
- Audit trail for decrypt operations

### 🎨 Frontend Canvas Visualization

**Secret Nodes:**
- Visual representation of secrets on the canvas
- Draggable and interactive nodes
- Color-coded by scope type (global, workspace, agent)
- Smart icons based on secret names (🔑 for API keys, 🧠 for OpenRouter, etc.)

**Connection Lines:**
- Visual connections from secrets to tools that use them
- Connections from agent-scoped secrets to their respective agents
- Hover tooltips showing relationship details
- Distinct styling for secret connections (red/orange gradient)

### 🛠️ Tool Configuration System

**Tool Selection:**
- Click on any tool node to open configuration panel
- Shows current configuration status
- Lists associated secrets and endpoints

**Configuration Panel:**
- Select API key secret from dropdown
- Set custom endpoints if needed
- Save configuration as structured breadcrumbs
- Test tool functionality

### 📋 Secrets Management UI

**Left Panel Integration:**
- Dedicated secrets section with collapsible interface
- Create new secrets with scope selection
- List all existing secrets
- Quick access to secret operations

**Secret Details Panel:**
- View secret metadata (name, scope, creation date)
- Edit secret values securely
- Decrypt secrets with audit reason
- Delete secrets with confirmation

## Usage Workflow

### 1. Create a Secret (e.g., for OpenRouter)

```javascript
// Via UI: Fill out the form in the left panel
Name: OPENROUTER_API_KEY
Scope: global
Value: sk-or-v1-your-api-key-here

// Via API:
POST /api/secrets
{
  "name": "OPENROUTER_API_KEY",
  "scope_type": "global", 
  "value": "sk-or-v1-your-api-key-here"
}
```

### 2. Configure a Tool

1. Click on the OpenRouter tool node on the canvas
2. Tool details appear in the left panel
3. Click "Configure" button
4. Select "OPENROUTER_API_KEY" from the dropdown
5. Optionally set custom endpoint
6. Click "Save Config"

### 3. Visual Feedback

- Secret node appears on the left side of the canvas
- Connection line draws from secret to OpenRouter tool
- Tool status updates to show it's configured
- Configuration stored as breadcrumb with `tool:config` tag

## Technical Architecture

### State Management
```javascript
dashboardState.secrets = [];           // All secrets
dashboardState.selectedSecret = null;  // Currently selected secret
dashboardState.selectedTool = null;    // Currently selected tool
dashboardState.secretPositions = [];   // Secret node positions
```

### Connection Detection
```javascript
// Finds tool configurations that reference secrets
const toolConfigs = breadcrumbs.filter(b => 
    b.tags?.includes('tool:config') && 
    b.context?.secret_id
);

// Creates visual connections
secret → tool (via configuration)
secret → agent (via scope)
```

### Security Features
- Secrets are encrypted at rest in RCRT
- Decrypt operations require curator role
- All decrypt operations are audited
- Secrets never displayed in plain text in UI
- Password input fields for secret values

## API Examples

### Create OpenRouter Secret
```bash
curl -X POST http://localhost:8082/api/secrets \
  -H "Content-Type: application/json" \
  -d '{
    "name": "OPENROUTER_API_KEY",
    "scope_type": "global",
    "value": "sk-or-v1-your-actual-key"
  }'
```

### Configure Tool to Use Secret
```bash
curl -X POST http://localhost:8082/api/breadcrumbs \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Tool Configuration: openrouter",
    "context": {
      "tool_name": "openrouter",
      "secret_id": "59d75f6b-c276-4ac7-91e3-8ba1981fef6a",
      "secret_name": "OPENROUTER_API_KEY"
    },
    "tags": ["tool:config", "tool:openrouter", "workspace:tools"],
    "schema_name": "tool.config.v1"
  }'
```

### Decrypt Secret (Curator Role Required)
```bash
curl -X POST http://localhost:8082/api/secrets/59d75f6b-c276-4ac7-91e3-8ba1981fef6a/decrypt \
  -H "Content-Type: application/json" \
  -d '{"reason": "Configuring OpenRouter tool"}'
```

## Visual Elements

### Node Types on Canvas
- 📋 **Breadcrumbs**: Blue rectangular nodes (existing)
- 🤖 **Agents**: Orange circular nodes (existing)  
- 🛠️ **Tools**: Green square nodes (existing)
- 🔐 **Secrets**: Red/orange rectangular nodes (NEW)

### Connection Types
- 📡 **Subscriptions**: Blue lines (agent → matching breadcrumbs)
- 🛠️ **Tool Creation**: Green lines (tool → created breadcrumbs)
- 🔐 **Secret Usage**: Red/orange lines (secret → tool/agent) (NEW)

## Benefits

1. **Visual Secret Management**: See all secrets and their relationships at a glance
2. **Tool Configuration**: Easy setup of tools with proper secret management
3. **Security Compliance**: Proper encryption, access control, and audit trails
4. **Integration**: Seamless integration with existing dashboard workflow
5. **Scalability**: Supports multiple tools, agents, and secret scopes

## Next Steps

The system is now ready for you to:

1. **Configure OpenRouter**: 
   - Create an OPENROUTER_API_KEY secret
   - Click on the OpenRouter tool node
   - Map the secret to the tool

2. **Manage Tool Secrets**:
   - View all secrets on the canvas
   - See which tools are configured
   - Add/edit/delete secrets as needed

3. **Monitor Connections**:
   - Visual feedback shows secret → tool relationships
   - Connection lines indicate active configurations
   - Hover tooltips provide relationship details

The dashboard now provides a complete visual interface for managing secrets and configuring tools, solving the original issue where there was no way to configure tools or manage their API keys.
