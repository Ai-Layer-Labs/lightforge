# RCRT Browser Extension v2 - Testing Guide

## Test Scenarios

### Test 1: Save Page & Agent Processing

**Goal:** Verify note saving and parallel agent processing

**Steps:**
1. Navigate to any article (e.g., Wikipedia page)
2. Click RCRT extension icon
3. Go to "Save" tab
4. Click "Save Page to RCRT"
5. Observe processing indicators

**Expected:**
- ✅ "Creating breadcrumb" shows checkmark immediately
- ✅ All 4 agents (tags, summary, insights, ELI5) show spinning loader
- ✅ All complete within 3-5 seconds
- ✅ "All processing complete!" message appears
- ✅ "View in Notes" button works

**Verify in RCRT:**
```bash
# Check note created
curl http://localhost:8081/breadcrumbs?schema_name=note.v1

# Check agent outputs
curl "http://localhost:8081/breadcrumbs?any_tags=note:NOTE_ID_HERE"
# Should return 4 breadcrumbs: tags, summary, insights, eli5
```

---

### Test 2: Semantic Search

**Goal:** Verify vector search works (not just keyword matching)

**Steps:**
1. Save 3-4 pages about different topics
2. Go to "Notes" tab
3. Search: "articles about databases"

**Expected:**
- ✅ Returns notes about databases/SQL/PostgreSQL
- ✅ Does NOT require exact keyword "database" in title
- ✅ Results ranked by relevance
- ✅ Search completes in < 500ms

**Verify:**
- Search for "machine learning" finds ML articles
- Search for "tutorials" finds instructional content
- Search by meaning, not exact text

---

### Test 3: Multi-Tab Context

**Goal:** Verify all tabs tracked, only active tagged

**Steps:**
1. Open 3-4 tabs with different content
2. Navigate between tabs
3. Click extension → Chat → "All Tabs" button

**Expected:**
- ✅ Shows all open tabs in dropdown
- ✅ Each tab shows title and domain
- ✅ Switching tabs updates active context

**Verify in RCRT:**
```bash
# Check all tab contexts
curl "http://localhost:8081/breadcrumbs?schema_name=browser.tab.context.v1"
# Should return one breadcrumb per open tab

# Check active tab
curl "http://localhost:8081/breadcrumbs?schema_name=browser.tab.context.v1&any_tags=browser:active-tab"
# Should return exactly 1 breadcrumb
```

**Test Tab Switching:**
1. Switch to different tab
2. Wait 1 second
3. Re-run query above
4. Active tag should have moved to new tab

---

### Test 4: Chat with Agents

**Goal:** Verify chat creates breadcrumbs and receives responses

**Steps:**
1. Go to "Chat" tab
2. Type: "What notes do I have about databases?"
3. Click Send

**Expected:**
- ✅ Message appears in chat immediately
- ✅ Spinner shows while agent processes
- ✅ Agent response appears within 2-3 seconds
- ✅ Response is relevant to saved notes

**Verify in RCRT:**
```bash
# Check user message
curl "http://localhost:8081/breadcrumbs?schema_name=user.message.v1"

# Check agent response
curl "http://localhost:8081/breadcrumbs?schema_name=agent.response.v1"

# Check conversation link
curl "http://localhost:8081/breadcrumbs?any_tags=conversation:CONVERSATION_ID"
```

---

### Test 5: Dashboard Integration

**Goal:** Verify notes open in 3D dashboard

**Steps:**
1. Go to "Notes" tab
2. Click any note
3. Click "Dashboard" button

**Expected:**
- ✅ Opens http://localhost:8082?selected=NOTE_ID&focus=true
- ✅ Dashboard highlights the note in 3D view
- ✅ Can navigate back to extension

---

### Test 6: Settings as Breadcrumbs

**Goal:** Verify settings are stored as breadcrumbs (collaborative!)

**Steps:**
1. Go to "Settings" tab
2. Change workspace to "workspace:testing"
3. Click "Save Settings"
4. Reload extension

**Expected:**
- ✅ Settings persist after reload
- ✅ Settings stored as breadcrumb, not Chrome storage

**Verify in RCRT:**
```bash
# Check settings breadcrumb
curl "http://localhost:8081/breadcrumbs?schema_name=extension.settings.v1"

# Should return breadcrumb with your settings
```

**Test Collaboration:**
1. Open extension in two browser windows
2. Change setting in window 1
3. Window 2 should update automatically (SSE)

---

### Test 7: Find Similar Notes

**Goal:** Verify semantic similarity search

**Steps:**
1. Save several notes on related topics
2. Open any note
3. Click "Find Similar" (future feature)

**Expected:**
- ✅ Returns semantically related notes
- ✅ Notes ranked by similarity
- ✅ Excludes the current note

---

### Test 8: Real-Time Collaboration

**Goal:** Verify multi-user workspace

**Steps:**
1. Open extension in two browsers (or use two computers)
2. Both connected to same RCRT server and workspace
3. Save a note in browser 1

**Expected:**
- ✅ Note appears in browser 2's Notes list immediately
- ✅ No refresh needed (SSE updates)
- ✅ Both users see same processing status

---

### Test 9: Export/Import

**Goal:** Verify data portability

**Steps:**
1. Save several notes
2. Go to Settings → Export
3. Download JSON
4. Delete some notes
5. Go to Settings → Import
6. Upload JSON

**Expected:**
- ✅ JSON export contains all notes
- ✅ Import recreates notes
- ✅ Agents reprocess imported notes

---

### Test 10: Error Handling

**Goal:** Verify graceful error recovery

**Test 10.1: Server Offline**
1. Stop RCRT server
2. Try to save a page

**Expected:**
- ✅ Clear error message: "Cannot connect to RCRT server"
- ✅ Option to retry
- ✅ Extension doesn't crash

**Test 10.2: Token Expiration**
1. Wait 1 hour (token expires)
2. Try to save a page

**Expected:**
- ✅ Automatically refreshes token
- ✅ Save succeeds
- ✅ No user intervention needed

**Test 10.3: Version Conflict**
1. Modify same note from two places
2. Both update simultaneously

**Expected:**
- ✅ Automatic conflict resolution
- ✅ No data loss
- ✅ Correct version wins

---

## Performance Tests

### P1: Large Note List

**Goal:** Verify performance with many notes

**Steps:**
1. Save 100+ notes
2. Go to Notes tab
3. Scroll through list

**Expected:**
- ✅ Smooth scrolling (60fps)
- ✅ Virtual scrolling (only render visible notes)
- ✅ No lag or jank

### P2: Search Performance

**Goal:** Verify search is fast

**Steps:**
1. With 100+ notes
2. Type search query

**Expected:**
- ✅ Results appear within 500ms
- ✅ Debounced (doesn't search on every keystroke)
- ✅ Results ranked by relevance

### P3: SSE Reconnection

**Goal:** Verify SSE reconnects after disconnect

**Steps:**
1. Connect to RCRT
2. Restart RCRT server (simulates disconnect)
3. Wait for reconnection

**Expected:**
- ✅ Auto-reconnects within 5 seconds
- ✅ Exponential backoff (1s, 2s, 4s, 8s...)
- ✅ Max 10 attempts before giving up
- ✅ User sees reconnection status

---

## Agent Tests

### A1: Tagging Agent

**Verify:**
- Generates exactly 7 tags
- Tags are lowercase with hyphens
- Reuses existing tags when relevant
- Varies granularity (broad → specific)

### A2: Summary Agent

**Verify:**
- Creates 2-3 sentence summary
- Captures main topic
- Highlights key points
- Readable and concise

### A3: Insights Agent

**Verify:**
- Extracts 3-5 insights
- Focus on actionable points
- Specific and concrete
- Not vague or generic

### A4: ELI5 Agent

**Verify:**
- Simple language
- Short sentences
- Concrete examples
- Friendly and engaging

---

## Integration Tests

### I1: Full Workflow

1. Save page → note.v1 created
2. Agents process → 4 breadcrumbs created
3. View in Notes → displays with tags/summary
4. Semantic search → finds note by meaning
5. Click note → shows all tabs (content, summary, insights, ELI5)
6. Send to chat → adds to conversation context
7. Chat responds → uses note content
8. View in dashboard → opens 3D view

**All steps should work end-to-end without errors.**

---

## Regression Tests

After each update, verify:
- [ ] Can save pages
- [ ] Agents process correctly
- [ ] Search works
- [ ] Chat works
- [ ] Settings persist
- [ ] Multi-tab tracking works
- [ ] SSE reconnects after server restart

---

## Automated Testing (Future)

Create test suite:
```bash
npm run test:e2e
```

Should test:
- RCRT client API calls
- Breadcrumb creation
- SSE event handling
- Agent subscriptions
- Search functionality
- Error handling
- Token refresh

---

## Performance Benchmarks

**Target Metrics:**
- Note save: < 100ms (breadcrumb creation)
- Agent processing: 3-5s total (parallel)
- Search: < 500ms (100-1000 notes)
- UI render: 60fps
- SSE latency: < 50ms
- Memory usage: < 100MB

**Monitor:**
```javascript
// In Chrome DevTools → Performance
// Record while using extension
// Check for:
// - Long tasks (> 50ms)
// - Memory leaks
// - SSE message handling time
```

