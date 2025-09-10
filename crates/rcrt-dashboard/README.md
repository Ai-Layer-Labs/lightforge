# RCRT Dashboard

A visual dashboard for viewing RCRT breadcrumbs as interactive node cards on a canvas.

## Features

### 🎨 **Interactive Canvas**
- **Smart Canvas**: Dynamically sizes based on breadcrumb positions with buffer zones
- **Unlimited Panning**: Navigate freely in all directions around content
- **Smooth Zoom**: Mouse wheel zoom with cursor-focused scaling
- **Auto-centering**: Automatically centers view on breadcrumb content

### 🎛️ **Left Control Panel**
- **Real-time Search**: Filter breadcrumbs by title as you type
- **Tag Filtering**: Find breadcrumbs by specific tags
- **Breadcrumb List**: Scrollable list with click-to-select and double-click-to-edit
- **Panel Toggle**: Collapsible panel to maximize canvas space

### ✏️ **Full CRUD Operations**
- **Create**: Add new breadcrumbs with title, JSON context, and tags
- **Read**: View full breadcrumb details with formatted JSON
- **Update**: Edit existing breadcrumbs with version control
- **Delete**: Remove breadcrumbs with confirmation dialogs

### 🎯 **Advanced Features**
- **Visual Selection**: Click breadcrumbs in list to highlight on canvas
- **Smart Tag Input**: Add tags with Enter/comma, remove with backspace/click
- **Real-time Sync**: All changes instantly reflected in canvas and list
- **Modern UI**: Glass-morphism design with smooth animations

### 📡 **NATS JetStream Integration**
- **Real-time Events**: Live event stream from NATS JetStream
- **Event Monitoring**: See breadcrumb creation, updates, and system events
- **Stream Controls**: Pause/resume, clear log, auto-scroll toggle
- **Color-coded Events**: Green for create, blue for update, gray for heartbeat
- **Connection Status**: Visual indicator shows stream health

## API Endpoints

### Dashboard Interface
- `GET /` - Main dashboard web interface with left panel and canvas

### Breadcrumb Management  
- `GET /api/breadcrumbs` - List all breadcrumbs
- `POST /api/breadcrumbs` - Create new breadcrumb
- `GET /api/breadcrumbs/:id` - Get breadcrumb context details
- `PATCH /api/breadcrumbs/:id` - Update existing breadcrumb
- `DELETE /api/breadcrumbs/:id` - Delete breadcrumb

### Real-time Events
- `GET /api/events/stream` - Server-Sent Events stream (proxied from RCRT)

### System
- `GET /health` - Health check endpoint

## Environment Variables

- `RCRT_URL` - Base URL of RCRT API server (default: `http://localhost:8080`)
- `OWNER_ID` - Owner UUID for RCRT API access
- `AGENT_ID` - Agent UUID for RCRT API access  
- `RUST_LOG` - Logging level (default: `info`)

## Running Locally

```bash
# Set environment variables
export RCRT_URL=http://localhost:8080
export OWNER_ID=00000000-0000-0000-0000-000000000001
export AGENT_ID=00000000-0000-0000-0000-0000000000cc

# Run the dashboard
cargo run -p rcrt-dashboard
```

The dashboard will be available at `http://localhost:8082`

## Docker Deployment

The dashboard is included in the main docker-compose.yml:

```bash
docker-compose up dashboard
```

This will start the dashboard on port 8082, connecting to the RCRT API service.

## Authentication

The dashboard supports both JWT authentication and disabled auth modes:

- **JWT Mode**: Automatically requests a token from RCRT API on startup
- **Disabled Mode**: Uses direct API access when RCRT is in `AUTH_MODE=disabled`

The dashboard will gracefully handle authentication failures and continue operating in read-only mode.

## Usage Guide

### 🔍 **Filtering & Search**
1. **Title Search**: Type in the "Search Title" field to filter breadcrumbs in real-time
2. **Tag Filter**: Enter a tag name to show only breadcrumbs with that tag
3. **Clear Filters**: Use "Clear Filters" button to reset and show all breadcrumbs

### ➕ **Creating Breadcrumbs**
1. Fill out the "Create New" form in the left panel:
   - **Title**: Required breadcrumb title
   - **Context**: JSON object (e.g., `{"category": "example", "priority": "high"}`)
   - **Tags**: Add tags by typing and pressing Enter or comma
2. Click "Create" to add the breadcrumb
3. New breadcrumb will appear on the canvas and in the list

### ✏️ **Editing Breadcrumbs**  
1. **Double-click** any breadcrumb in the left panel list, OR
2. **Single-click** to select, then click the "Edit" button
3. Modify title, context JSON, or tags in the edit form
4. Click "Update" to save changes
5. Use "Cancel" to abandon changes

### 🗑️ **Deleting Breadcrumbs**

**Single Delete:**
1. Click any breadcrumb to view details in left panel
2. Click the "Delete" button (red button)  
3. Confirm deletion in the popup dialog

**Bulk Delete (Delete All Filtered):**
1. Apply any filters (search, tags, dates) to show specific breadcrumbs
2. Click the red "🗑️ Delete All Filtered (X)" button that appears
3. Confirm bulk deletion - this will delete ALL currently visible breadcrumbs
4. ⚠️ **Warning**: This cannot be undone! Use carefully with filters.

### 🎛️ **Canvas Controls**
- **Pan**: Click and drag anywhere on the canvas to move around
- **Zoom**: Use mouse wheel to zoom in/out (zooms toward cursor)
- **Reset View**: Click "Reset View" to center and reset zoom
- **Panel Toggle**: Click "◀" button to collapse/expand the left panel

### 📡 **NATS JetStream Monitor**
- **Right Panel**: Real-time event stream from NATS JetStream
- **Event Types**: See breadcrumb.created, breadcrumb.updated, and ping events
- **Stream Controls**:
  - **Pause/Resume**: Toggle event processing
  - **Clear Log**: Remove all events from display
  - **Auto-scroll**: Automatically scroll to newest events
- **Visual Status**: Connection indicator shows stream health
- **Event Details**: Each event shows timestamp, type, and breadcrumb ID
- **Panel Toggle**: Click "▶" button to collapse/expand the right panel
