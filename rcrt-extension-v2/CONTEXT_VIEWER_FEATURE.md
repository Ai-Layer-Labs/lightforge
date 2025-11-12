# Context Viewer Feature

**Added**: November 12, 2025  
**Purpose**: See exactly what context the LLM receives for debugging and transparency

---

## What It Does

The **Context Viewer** provides a beautiful, readable view of the `formatted_context` that gets sent to the LLM in `agent.context.v1` breadcrumbs.

Instead of seeing a giant JSON blob like this:
```json
{
  "formatted_context": "{\"activeTools\":17,\"lastUpdated\":\"2025-11-12T07:41:42.522Z\",\"tools\":[...]}"
}
```

You now see a **formatted, collapsible, copyable** view with sections like:
- **Available Tools** (17 tools with descriptions)
- **Conversation History** (previous messages)
- **Relevant Knowledge** (semantically matched guides)
- **Browser Context** (current page)

---

## How to Use

### In Chat (ChatPanel)

1. **Send a message** to the assistant
2. **Wait for response** (appears in chat)
3. **Click "Context" button** on any assistant message
4. **Modal opens** showing the full LLM context

**Features**:
- 🔍 Collapsible sections (click to expand/collapse)
- 📋 Copy individual sections or entire context
- 📊 Metadata: Consumer, token count, breadcrumb count, assembled time
- 🎨 Syntax highlighting for JSON content
- 📝 Smart formatting for lists and text

### In Breadcrumb Viewer (Left Panel)

When viewing breadcrumbs in the left panel:

1. **Click on an `agent.context.v1` breadcrumb**
2. **"LLM Context" tab appears** (with brain icon 🧠)
3. **Click the tab** to see formatted context
4. Same features as chat modal view

---

## Example: What You'll See

### Metadata Header
```
Consumer: default-chat-assistant
Tokens: 11,581
Breadcrumbs: 20
Assembled: 8:43:44 PM
```

### Collapsible Sections
```
▼ Available Tools (17 items)
  • counter (general): Simple tool that counts from 1 to 10
    Output: numbers, count, start, end
    Example: Counts from 1 to 10 by default
  
  • openrouter (general): LLM API via OpenRouter
    Output: content, model, usage
    Example: Access the response with result.content
  
  [... 15 more tools]

▼ Conversation History (8 lines)
  [2025-11-12 08:30] User: Create a counter tool
  [2025-11-12 08:31] Assistant: I'll create that for you...
  [2025-11-12 08:42] User: test it
  
▶ Relevant Knowledge (collapsed)

▼ Current Page (5 lines)
  Title: OpenRouter Dashboard
  URL: https://openrouter.ai/
  Content: [...]
```

---

## Files Added/Modified

### New Files (1)

**`rcrt-extension-v2/src/sidepanel/ContextViewer.tsx`**
- Smart parser for `formatted_context` (handles JSON, markdown sections, plain text)
- Collapsible sections with expand/collapse
- Copy buttons (whole context or individual sections)
- Metadata display (consumer, tokens, breadcrumb count, timestamp)
- Type detection (JSON, list, text) with appropriate rendering
- ~200 lines

### Modified Files (2)

**`rcrt-extension-v2/src/sidepanel/ChatPanel.tsx`**
- Added "Context" button to assistant message bubbles
- Added `handleViewContext()` function to find corresponding `agent.context.v1`
- Added modal overlay to display ContextViewer
- State management for selected context breadcrumb

**`rcrt-extension-v2/src/sidepanel/NoteDetail.tsx`**
- Added "LLM Context" tab for `agent.context.v1` breadcrumbs
- Updated TabButton to support optional icon prop
- Conditional tab rendering based on schema type
- Now works as generic breadcrumb viewer (not just notes)

---

## Smart Features

### 1. Intelligent Section Parsing

The viewer automatically detects and parses different formats:

**Markdown sections**:
```
=== AVAILABLE TOOLS ===
{content}

=== CONVERSATION HISTORY ===
{content}
```

**JSON objects**:
```json
{
  "activeTools": 17,
  "tools": [...]
}
```

**Plain text with separators**:
```
Content block 1
---
Content block 2
---
Content block 3
```

### 2. Content Type Detection

- **JSON**: Syntax-highlighted, properly indented
- **Lists**: Rendered as bullet points with proper spacing
- **Text**: Monospaced, preserves formatting

### 3. Smart Titles

Converts camelCase/snake_case keys to readable titles:
- `availableTools` → "Available Tools"
- `conversation_history` → "Conversation History"
- `token_estimate` → "Token Estimate"

### 4. Length Display

Shows content size for each section:
- Small: "45 chars"
- Medium: "23 lines"
- Large: "5.2K chars"

---

## How It Works Technically

### Context Resolution Flow

```
1. User clicks "Context" on assistant message
2. ChatPanel.handleViewContext() called
3. Search for agent.context.v1 with:
   - session:{sessionId} tag
   - consumer_id matching agent
   - created_at <= message.timestamp
4. Get most recent match
5. Fetch full breadcrumb (with /full endpoint)
6. Display in ContextViewer
```

### Parsing Strategy

```typescript
parseFormattedContext(formatted_context):
  1. Try JSON.parse() first
     → If valid JSON: Show as key-value sections
  
  2. Try regex for === SECTIONS ===
     → If matches: Extract titled sections
  
  3. Try split by --- separators
     → If found: Split into sections
  
  4. Fallback: Show as single "Full Context" section
```

### Rendering Logic

```typescript
renderContent(content, type):
  if (type === 'json'):
    → JSON.stringify with indent=2, syntax colors
  
  if (type === 'list'):
    → Split by newlines, render as <ul> with bullets
  
  if (type === 'text'):
    → <pre> with monospace font, preserve formatting
```

---

## Debugging Use Cases

### 1. "Why didn't the agent use this tool?"

**Before**: Guess based on vague logs  
**Now**: Click "Context" → See exact tool list → Verify tool was/wasn't in context

### 2. "Why did the agent hallucinate?"

**Before**: No visibility into what context was provided  
**Now**: Click "Context" → See conversation history → Verify what the LLM actually saw

### 3. "Why is the response slow/expensive?"

**Before**: No idea how many tokens were used  
**Now**: Header shows "Tokens: 11,581" → See if context is too large

### 4. "Did the agent see my browser page?"

**Before**: Assume multi-tab tracking works  
**Now**: Click "Context" → Expand "Current Page" section → Verify page content

### 5. "What knowledge did the context-builder find?"

**Before**: Check logs, run SQL queries  
**Now**: Click "Context" → Expand "Relevant Knowledge" → See exact guides provided

---

## Usage Examples

### View Chat Context

```
1. Chat with assistant: "Create a counter tool"
2. Assistant responds: "I'll create that for you..."
3. Click [Context] button below assistant message
4. Modal opens showing:
   - Tool catalog (17 tools)
   - Conversation history (your request + prior messages)
   - Agent capabilities
   - Session metadata
```

### View Tool Error Context

```
1. Tool fails with error
2. In left panel breadcrumbs, find tool.error.v1
3. Note shows agent.context.v1 for tool-debugger
4. Click on that context breadcrumb
5. Click "LLM Context" tab
6. See:
   - Error details
   - Tool definition
   - Debugging knowledge (via error:{type} pointer!)
   - Similar error patterns
```

### Debug Context-Builder Output

```
1. Send message, wait for response
2. In left panel, filter to agent.context.v1
3. Click on the context breadcrumb
4. See two views:
   - Content tab: Shows raw formatted_context string
   - LLM Context tab: Shows parsed, formatted sections
   - Raw tab: Shows complete JSON structure
```

---

## Performance Notes

- **Lazy loading**: Context only fetched when button clicked
- **Client-side parsing**: No server overhead
- **Copy optimization**: Individual sections can be copied (no need to copy entire 10KB context)
- **Collapsible sections**: Can keep large sections collapsed

---

## Future Enhancements

Potential improvements:

1. **Token highlighting**: Show which parts consume most tokens
2. **Search within context**: Find specific keywords
3. **Diff view**: Compare context between messages
4. **Export context**: Download as markdown/JSON
5. **Context replay**: Re-run agent with same context
6. **Token usage chart**: Visualize distribution across sections

---

## Troubleshooting

### "No context breadcrumb found"

**Cause**: The assistant message doesn't have a corresponding `agent.context.v1`

**Solution**: 
- Check if context-builder is running
- Verify agent.context.v1 breadcrumbs are being created
- Check logs: `docker compose logs context-builder -f`

### Context shows as giant JSON blob

**Cause**: `formatted_context` is stored as JSON string, not parsed

**Solution**:
- The viewer should auto-detect and parse JSON
- If not working, check the parseFormattedContext() function
- Might need to update context-builder formatting

### Sections don't collapse/expand

**Cause**: Click handler not working or CSS issue

**Solution**:
- Check browser console for errors
- Verify lucide-react icons are loaded
- Try rebuilding extension

---

## Technical Details

### Component Architecture

```
ContextViewer (Pure component)
  ├─ Props: breadcrumb (Breadcrumb type)
  ├─ Parsing: parseFormattedContext()
  ├─ Rendering: renderContent()
  ├─ State: expandedSections (Set<string>)
  └─ Output: Formatted, interactive view

ChatPanel Integration
  ├─ State: selectedContextBreadcrumb
  ├─ Handler: handleViewContext()
  ├─ Button: On assistant messages
  └─ Modal: Full-screen overlay

NoteDetail Integration
  ├─ Tab: "LLM Context" (conditional)
  ├─ Condition: schema_name === 'agent.context.v1'
  └─ Inline: No modal, renders in tab panel
```

### Data Flow

```
User clicks "Context" button
  ↓
handleViewContext(messageId)
  ↓
Find message by ID
  ↓
Search breadcrumbs: session:{sessionId} + agent.context.v1
  ↓
Filter by timestamp (≤ message.timestamp)
  ↓
Sort by created_at DESC (most recent first)
  ↓
Get full breadcrumb (/full endpoint)
  ↓
Set selectedContextBreadcrumb
  ↓
ContextViewer renders modal
```

---

## Summary

**This feature provides crucial visibility into the system** by showing:
- ✅ Exact context the LLM receives
- ✅ Token usage per response
- ✅ Which tools/knowledge were included
- ✅ Conversation history provided
- ✅ Browser context visibility

**Perfect for debugging**:
- Why agent made specific decisions
- Why tools weren't used
- Token consumption optimization
- Context-builder output verification
- Semantic search quality checks

**Implemented in**: ~400 lines across 3 files  
**Zero dependencies**: Uses existing lucide-react icons  
**Zero API changes**: Uses existing breadcrumb endpoints  

🎯 **Your system is now transparent and debuggable!** 🎯

