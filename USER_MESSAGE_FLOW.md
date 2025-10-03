# How User Messages Reach the Agent

## 🎯 **The Question: "What about user messages?"**

**Answer:** Agent doesn't subscribe to user.message.v1 - **context-builder does!**

## 🔄 **The Complete Flow**

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User sends: "What was that API key?"                     │
│    Browser extension creates user.message.v1 breadcrumb     │
└────────────────────┬────────────────────────────────────────┘
                     │ NATS publishes: bc.*.updated
        ┌────────────┼────────────┬──────────────┐
        ↓            ↓            ↓              ↓
   ┌─────────┐  ┌──────────┐  ┌────────┐  ┌─────────┐
   │context- │  │tools-    │  │agent-  │  │Others   │
   │builder  │  │runner    │  │runner  │  │(ignore) │
   │         │  │(ignores) │  │(does   │  └─────────┘
   │         │  └──────────┘  │NOT     │
   │         │                │receive │
   │         │                │this!)  │
   └────┬────┘                └────────┘
        │ Subscribed via update_triggers
        ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. context-builder-runner processes event                   │
│    "Event matches trigger for default-chat-assistant"       │
│                                                              │
│    Checks context.config.v1.update_triggers:                │
│    [                                                         │
│      {                                                       │
│        schema_name: "user.message.v1",                      │
│        any_tags: ["workspace:agents"]                       │
│      }                                                       │
│    ]                                                         │
│                                                              │
│    ✅ MATCH! Invoke context-builder tool                    │
└────────────────────┬────────────────────────────────────────┘
                     │ Tool execution
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. context-builder tool assembles context                   │
│    • vectorSearch(q="What was that API key?", nn=5)         │
│    • Gets 5 semantically relevant messages                  │
│    • Gets tool catalog, recent tool results                 │
│    • Generates llm_hints template                           │
│    • Updates agent.context.v1 breadcrumb                    │
└────────────────────┬────────────────────────────────────────┘
                     │ NATS publishes: bc.<context-id>.updated
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Agent receives agent.context.v1 update                   │
│    "Received pre-built context from context-builder"        │
│                                                              │
│    Subscribed via selector:                                 │
│    {                                                         │
│      schema_name: "agent.context.v1",                       │
│      all_tags: ["consumer:default-chat-assistant"]          │
│    }                                                         │
│                                                              │
│    Context contains:                                         │
│    • trigger_event_id: "user-message-id" ← Reference!       │
│    • chat_history: [...]                                    │
│    • tool_catalog: "..."                                    │
│    • formatted_context: "# Tools\n..."                      │
└────────────────────┬────────────────────────────────────────┘
                     │ Agent processes
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Agent fetches trigger event                              │
│    const trigger = await getBreadcrumb(trigger_event_id)    │
│    const userMessage = trigger.context.message              │
│    // "What was that API key?"                              │
│                                                              │
│    Now agent has:                                            │
│    • User message (from trigger)                            │
│    • Pre-built context (from agent.context.v1)              │
│    • Everything needed to respond!                          │
└─────────────────────────────────────────────────────────────┘
```

## 📊 **Subscription Comparison**

### **WHO Subscribes to user.message.v1?**

| Service | Subscribes? | Why? |
|---------|-------------|------|
| **context-builder-runner** | ✅ YES | To detect when context needs updating |
| **agent-runner** | ❌ NO | Gets pre-built context instead |
| **tools-runner** | ❌ NO | Only cares about tool.request.v1 |
| **dashboard** | ❌ NO | Polls API directly |

### **WHO Subscribes to agent.context.v1?**

| Service | Subscribes? | Why? |
|---------|-------------|------|
| **agent-runner** | ✅ YES | Receives pre-built context |
| **context-builder-runner** | ❌ NO | Creates it, doesn't need it |
| **analytics** | ✅ Maybe | For monitoring context quality |

## 💡 **Key Insight: Indirect Subscription**

```
Agent doesn't subscribe to user.message.v1 DIRECTLY
But receives it INDIRECTLY via agent.context.v1!

Direct subscription:
  user.message.v1 → Agent (raw message, no context)
  
Indirect subscription:
  user.message.v1 → context-builder → agent.context.v1 → Agent
                    (processes)       (rich context!)
```

## 🎯 **The Proxy Pattern**

Think of context-builder as a **smart proxy**:

```
Without proxy (OLD):
  User → user.message.v1 → Agent
         (raw event)
         
With proxy (NEW):
  User → user.message.v1 → context-builder → agent.context.v1 → Agent
         (trigger)         (enrich)           (enriched event)
```

## 📋 **Agent Definition (Final)**

```json
{
  "subscriptions": {
    "selectors": [
      {
        "comment": "Agent subscribes to PRE-BUILT context only",
        "schema_name": "agent.context.v1",
        "all_tags": ["consumer:default-chat-assistant"]
      },
      {
        "comment": "Tool responses for follow-up",
        "schema_name": "tool.response.v1",
        "context_match": [{
          "path": "$.requestedBy",
          "op": "eq",
          "value": "default-chat-assistant"
        }]
      }
    ]
  }
}
```

**Note:** NO user.message.v1 subscription!

## 📋 **Context Config (Shows the Bridge)**

```json
{
  "schema_name": "context.config.v1",
  "context": {
    "consumer_id": "default-chat-assistant",
    
    "update_triggers": [
      {
        "schema_name": "user.message.v1",  ← context-builder subscribes!
        "any_tags": ["workspace:agents"]
      }
    ],
    
    "output": {
      "schema_name": "agent.context.v1",  ← Agent subscribes to this!
      "tags": ["agent:context", "consumer:default-chat-assistant"]
    }
  }
}
```

**The bridge:**
- context-builder subscribes to `user.message.v1` (via update_triggers)
- context-builder updates `agent.context.v1` (output)
- Agent subscribes to `agent.context.v1`

## 🎨 **Visual Analogy**

Think of it like email filters:

```
Gmail (context-builder):
  Rule: "When email arrives from user@example.com"
        "Create summary and forward to agent@work.com"
  
Agent (agent-runner):
  Inbox: Only receives summaries (not raw emails)
```

**Agent never sees raw user.message.v1 events!**  
**Agent only sees processed agent.context.v1 events!**

## ✨ **Benefits of Indirect Subscription**

### **1. Separation of Concerns**
```
context-builder: Handles ALL user messages for ALL agents
Agent: Handles ONLY its own processed context
```

### **2. Event Reduction**
```
100 users send messages:
  
Direct subscription:
  Agent receives: 100 events (one per user message)
  
Indirect subscription:
  context-builder receives: 100 events
  Agent receives: 1 event (agent.context.v1 gets updated once with all 100 summarized)
```

### **3. Flexibility**
```
Want to change how user messages are processed?
  → Update context-builder (one place)
  → All agents benefit
  
vs.
  → Update every agent (N places)
  → Inconsistent behavior
```

## 🎓 **Summary**

**Your Question:** "What about user messages?"

**Answer:**
- ✅ User messages are STILL received
- ✅ By **context-builder**, not **agent**
- ✅ context-builder transforms them into **agent.context.v1**
- ✅ Agent subscribes to **agent.context.v1** (not user.message.v1)
- ✅ Agent gets user message **inside** agent.context.v1.trigger_event_id

**Analogy:**
- context-builder = Email filter/preprocessor
- agent.context.v1 = Processed email with summary
- Agent = Person who reads summaries, not raw emails

**This is the RCRT way: Smart indirection via breadcrumbs!** 🎯

