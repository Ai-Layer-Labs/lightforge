# Extension Chat with RCRT Agents

## 🎯 **Overview**

This implements a proper RCRT-based chat system for the browser extension using the corrected agent architecture:

- **Tools = Code** ✅ (OpenRouter LLM tool, file-storage, etc.)
- **Agents = Context + Data** ✅ (Chat agent definition as breadcrumb)
- **Simple Flow** ✅ (Extension → Breadcrumb → Agent → LLM → Response)

## 🏗️ **Architecture**

### **The Complete Flow:**
```
1. User types message in extension
2. Extension creates user.message.v1 breadcrumb with tags [extension:chat, user:message]
3. Agent-runner detects breadcrumb (matches chat agent triggers)
4. Agent-runner gets breadcrumb context via GET /breadcrumbs/{id}
5. Agent-runner creates tool.request.v1 breadcrumb for 'openrouter' tool
6. Tools-runner executes openrouter tool → calls LLM API
7. Tools-runner creates tool.response.v1 breadcrumb with LLM result
8. Agent-runner processes LLM response → creates agent.response.v1 breadcrumb
9. Extension receives SSE event → displays response to user
```

### **Components:**
- **Chat Agent Definition** (`chat-agent-definition.json`) - Pure data/context
- **Extension Chat UI** (`SimpleBreadcrumbChat.tsx`) - Creates breadcrumbs, listens for responses
- **Agent Runner** - Processes agent definitions and coordinates LLM calls
- **Tools Runner** - Executes OpenRouter and other tools

## 🚀 **Setup Instructions**

### **1. Start RCRT Services**
```bash
# Start RCRT server
cd crates/rcrt-server
cargo run

# In another terminal, start tools-runner
cd rcrt-visual-builder/apps/tools-runner
npm run dev

# In another terminal, start agent-runner  
cd rcrt-visual-builder/apps/agent-runner
npm run dev
```

### **2. Load Chat Agent Definition**
```bash
# Load the chat agent (creates breadcrumb with agent definition)
./load-chat-agent.js
```

This creates a breadcrumb like:
```json
{
  "schema_name": "agent.definition.v1",
  "title": "Extension Chat Agent",
  "tags": ["agent:definition", "workspace:agents", "extension:chat"],
  "context": {
    "agent_name": "extension-chat",
    "triggers": [{
      "selector": {
        "all_tags": ["extension:chat", "user:message"]
      }
    }],
    "llm_config": {
      "model": "google/gemini-2.5-flash",
      "system_prompt": "You are a helpful AI assistant...",
      "response_schema": {...}
    }
  }
}
```

### **3. Configure OpenRouter API Key**
The chat agent uses the existing OpenRouter tool, so you need the API key configured:

```bash
# Via RCRT secrets (recommended)
# Go to dashboard and add secret: OPENROUTER_API_KEY

# Or set environment variable for tools-runner
export OPENROUTER_API_KEY="your-key-here"
```

### **4. Build and Load Extension**
```bash
cd extension
npm install
npm run build

# Load dist/ folder as unpacked extension in Chrome
```

### **5. Test the Chat**
1. Click extension icon
2. Select "RCRT Chat" tab  
3. Type a message like "Hello! Can you help me list my files?"
4. Watch the magic happen! 🎉

## 🧪 **Testing**

### **Manual Test via Script**
```bash
# Test the complete flow without the extension
./test-chat-flow.js
```

This simulates the extension creating a chat message breadcrumb and checks for agent responses.

### **Debug the Flow**
1. **Check Agent Runner Logs** - Should show agent processing
2. **Check Tools Runner Logs** - Should show OpenRouter tool execution  
3. **Search Breadcrumbs** - Look for `agent:response` tags
4. **Extension Console** - Check for SSE events and errors

### **Expected Breadcrumbs Created:**
1. `user.message.v1` - User's chat message (extension)
2. `tool.request.v1` - LLM request (agent-runner)  
3. `tool.response.v1` - LLM response (tools-runner)
4. `agent.response.v1` - Final response (agent-runner)

## 🎯 **Key Features**

### **Extension UI:**
- ✅ Real-time connection status
- ✅ SSE event stream for responses
- ✅ Conversation threading via conversation_id
- ✅ Breadcrumb ID tracking for debugging
- ✅ Auto-scroll and typing indicators

### **Agent Capabilities:**
- ✅ Responds to any chat message
- ✅ Can invoke tools (file-storage, agent-loader, etc.)
- ✅ Maintains conversation context
- ✅ Structured JSON responses
- ✅ Error handling and fallbacks

### **RCRT Integration:**
- ✅ Uses existing OpenRouter LLM tool
- ✅ Uses existing breadcrumb context API
- ✅ Uses existing SSE event system
- ✅ Uses existing subscription/selector system
- ✅ Fully observable via breadcrumbs

## 🔧 **Customization**

### **Modify Agent Behavior**
Edit `chat-agent-definition.json` and reload:
```bash
./load-chat-agent.js
```

### **Add More Tools**
The agent can invoke any tool available in the tools-runner:
```json
{
  "tools_to_invoke": [
    {
      "tool": "file-storage", 
      "input": {"action": "list"},
      "reason": "User wants to see their files"
    }
  ]
}
```

### **Change LLM Model**
Update the agent definition:
```json
{
  "llm_config": {
    "model": "anthropic/claude-3-haiku",
    "system_prompt": "..."
  }
}
```

## 🎉 **Success Indicators**

When working correctly, you should see:

1. **Extension connects** (green dot in header)
2. **User messages create breadcrumbs** (check agent-runner logs)
3. **Agent processes messages** (agent-runner logs show "Agent extension-chat triggered")  
4. **LLM tool executes** (tools-runner logs show "openrouter" execution)
5. **Responses appear in chat** (extension receives SSE events)

## 🐛 **Troubleshooting**

### **No Agent Response:**
- Check agent-runner is running and connected to RCRT
- Check tools-runner is running and has OpenRouter API key
- Check chat agent definition was loaded successfully
- Check breadcrumbs are being created with correct tags

### **Extension Not Connecting:**
- Check RCRT server is running on localhost:8081
- Check extension has correct RCRT_BASE_URL
- Check browser console for CORS or network errors

### **LLM Errors:**
- Check OpenRouter API key is valid and configured
- Check tools-runner logs for API errors
- Try a different model in agent definition

This system demonstrates the power of the corrected RCRT architecture - simple, observable, and leveraging existing infrastructure! 🚀
