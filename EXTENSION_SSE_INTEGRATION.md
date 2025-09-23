# RCRT Extension SSE Integration

## Overview

The Chrome extension has been updated to work with the refactored RCRT agent system that follows the philosophy: "tools are code, agents are context plus data."

## Key Features

### 1. User Message Sending
- Messages are sent as breadcrumbs with the tag `user:message`
- This triggers agents that are listening for user messages
- Each message includes a `conversation_id` for tracking

### 2. Dynamic SSE Filtering
The extension now includes a powerful SSE (Server-Sent Events) filtering system:

- **Filter UI**: Click the funnel icon in the header to show/hide filters
- **Preset Tags**: Quick buttons for common tags:
  - `agent:response` - Agent responses to user messages
  - `tool:response` - Tool execution results
  - `user:message` - User messages in the system
  - `agent:error` - Agent error messages

- **Custom Tags**: Add any custom tag to filter breadcrumbs dynamically
- **Real-time Updates**: Filters are applied immediately to the SSE stream

### 3. SSE Connection Management
```typescript
// Connect to SSE with filters
const cleanup = await rcrtClient.connectToSSE(
  {
    tags: ['agent:response', 'tool:response'],
    custom: (event) => {
      // Custom filtering logic
      return event.type === 'breadcrumb.updated';
    }
  },
  async (event) => {
    // Handle filtered events
  }
);
```

### 4. Agent Response Handling
- The extension listens for `agent:response` tagged breadcrumbs
- Fetches the full breadcrumb context to extract the response text
- Displays responses in the chat UI

## Architecture

### Message Flow
1. User types message in extension
2. Extension creates `user:message` breadcrumb
3. Agent-runner detects the breadcrumb (via SSE)
4. Agent processes it and calls LLM (via tool request)
5. Agent creates `agent:response` breadcrumb
6. Extension receives response via SSE and displays it

### Key Components

#### `rcrt-client.ts`
- `connectToSSE()`: Flexible SSE connection with filtering
- `createChatBreadcrumb()`: Creates user message breadcrumbs
- `getBreadcrumb()`: Fetches full breadcrumb context
- `listenForAgentResponses()`: Convenience method for agent responses

#### `Panel.tsx`
- Filter UI for dynamic tag selection
- Real-time SSE reconnection on filter changes
- Message tracking with breadcrumb IDs

## Usage

1. **Start the extension**:
   - Load the extension in Chrome
   - Click the extension icon and open the side panel

2. **Configure filters**:
   - Click the funnel icon
   - Select tags you want to monitor
   - Add custom tags as needed

3. **Send messages**:
   - Type in the chat input
   - Messages are sent as breadcrumbs
   - Responses appear when agents process them

## Benefits

1. **Observable**: Every interaction creates trackable breadcrumbs
2. **Flexible**: Dynamic filtering allows monitoring any part of the system
3. **Decoupled**: Extension doesn't need to know about agent internals
4. **Real-time**: SSE provides instant updates
5. **Debuggable**: Can see all breadcrumbs flowing through the system

## Example Filter Configurations

### Monitor Everything
```javascript
filters: {} // No filters = see all events
```

### Agent Responses Only
```javascript
filters: {
  tags: ['agent:response']
}
```

### Multiple Event Types
```javascript
filters: {
  tags: ['agent:response', 'tool:response', 'agent:error']
}
```

### Custom Logic
```javascript
filters: {
  custom: (event) => {
    return event.schema_name === 'agent.response.v1' &&
           event.tags?.includes('extension:chat');
  }
}
```

## Next Steps

1. Add breadcrumb history view
2. Implement conversation threading
3. Add support for file uploads
4. Create agent-specific filters
5. Add breadcrumb search functionality
