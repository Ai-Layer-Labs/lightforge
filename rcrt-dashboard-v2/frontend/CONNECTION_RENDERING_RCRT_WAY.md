# THE RCRT WAY - Connection Rendering

## 🎯 Clean Architecture

**We nuked all the legacy mess.** This is the new, clean system.

## Four Connection Types (The Only Ones We Render)

### 1. **Creates** (Green, Solid)
- **Direction**: Agent/Tool → Breadcrumb
- **Meaning**: "This agent/tool created this breadcrumb"
- **Detection**: `breadcrumb.created_by === agent.id`
- **Color**: `#00ff88` (Green)
- **Style**: Solid line
- **Weight**: 2

### 2. **Config** (Purple, Dashed)
- **Direction**: Tool → Config Breadcrumb
- **Meaning**: "This tool uses this config"
- **Detection**: Config breadcrumb (`tool.config.v1` or `context.config.v1`) linked to tool
- **Color**: `#9333ea` (Purple)
- **Style**: Dashed line
- **Weight**: 2

### 3. **Subscribed** (Blue, Dotted)
- **Direction**: Breadcrumb → Agent
- **Meaning**: "Agent is subscribed to this type of event"
- **Detection**: Agent's selector matches breadcrumb + `role !== "trigger"`
- **Color**: `#0099ff` (Blue)
- **Style**: Dotted line
- **Weight**: 2

### 4. **Triggered** (Blue, Solid, Animated)
- **Direction**: Breadcrumb → Agent
- **Meaning**: "This event actively triggers the agent"
- **Detection**: Agent's selector matches breadcrumb + `role === "trigger"`
- **Color**: `#0099ff` (Blue)
- **Style**: Solid line
- **Weight**: 3 (thicker than subscribed)
- **Animated**: Yes (particle flows along line)

## File Structure

```
utils/
├── connectionTypes.ts        # Type definitions and styling rules
├── connectionDiscovery.ts    # Clean discovery logic (ONLY 4 types)
└── dataTransforms.ts        # Delegates to connectionDiscovery

components/nodes/
├── Connection2D.tsx         # 2D SVG rendering
└── Connection3D.tsx         # 3D Three.js rendering
```

## Key Principles

1. **Single Source of Truth**: `connectionTypes.ts` defines ALL styles
2. **No Legacy Code**: All old connection types removed
3. **Consistent 2D/3D**: Same logic, different renderers
4. **Self-Documenting**: Connection color/style tells you the relationship

## How to Add a New Connection Type (DON'T!)

Don't. We have exactly 4 types for a reason. If you need to represent a new relationship, it should map to one of these 4 semantic types.

## Visual Legend

```
Agent ──────> Breadcrumb    (Green solid = Creates)
Tool - - - -> Config        (Purple dashed = Config)
Event ····> Agent           (Blue dotted = Subscribed)
Event ══════> Agent         (Blue solid thick = Triggered, animated)
```

## Removed Legacy Code

We deleted these messy connection types:
- ❌ `subscription` (replaced by subscribed/triggered)
- ❌ `emission` (not needed - creates covers it)
- ❌ `tool-execution` (replaced by creates)
- ❌ `agent-thinking` (not a real relationship)
- ❌ Chat flow connections (conversation-based, not RCRT-native)
- ❌ Tool response connections (covered by creates)
- ❌ Agent definition connections (redundant)

## Testing

After deployment:
1. Open dashboard at `http://localhost:8082`
2. Look for the 4 connection types
3. Verify colors match the legend
4. Check that triggered connections animate
5. Ensure dotted/dashed styles are clear

## Rebuild Commands

```bash
# Frontend only
cd rcrt-dashboard-v2/frontend
npm run build

# Full rebuild
docker-compose build frontend
docker-compose up -d frontend
```

