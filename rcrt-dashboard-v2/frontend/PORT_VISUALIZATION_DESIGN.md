# Port Visualization Design - Dashboard v2

## 🎯 Goal

Visualize the I/O port architecture we just designed:
- Input ports (subscriptions) on nodes
- Output ports (what they create) on nodes
- Connections showing data flow
- Role indicators (trigger vs context)

---

## 📐 Port Model for Visualization

### **Every Node Has Ports:**

```typescript
interface NodePorts {
  // Input Ports (Subscriptions)
  inputs: Array<{
    id: string;
    schema_name: string;
    role: 'trigger' | 'context';
    key?: string;
    tags?: string[];
    side: 'top' | 'left';  // Visual placement
    color: string;
  }>;
  
  // Output Ports (What it creates)
  outputs: Array<{
    id: string;
    schema_name: string;
    tags?: string[];
    side: 'bottom' | 'right';  // Visual placement
    color: string;
  }>;
}
```

---

## 🎨 Visual Design

### **Node with Ports (2D):**

```
┌─────────────────────────────────────┐
│  🔵 user.message.v1 (trigger)       │  ← Input port
│  🔵 browser.page.context.v1         │  ← Input port (context)
├─────────────────────────────────────┤
│                                     │
│      Default Chat Assistant         │  ← Node
│         (Agent)                     │
│                                     │
├─────────────────────────────────────┤
│  🔴 agent.response.v1               │  ← Output port
│  🔴 tool.request.v1                 │  ← Output port
└─────────────────────────────────────┘
```

### **Connections:**

```
browser.page.context.v1 breadcrumb
          ↓ (dashed line - context subscription)
[browser port] on Agent
          ↓ (solid line - data flow)
Agent executes with context
          ↓
[output port] on Agent
          ↓ (solid line - creates)
agent.response.v1 breadcrumb
```

---

## 🔧 Implementation Plan

### **Step 1: Add Port Data to Types**

**File:** `src/types/rcrt.ts`

```typescript
export interface NodePort {
  id: string;
  type: 'input' | 'output';
  schema_name: string;
  role?: 'trigger' | 'context';
  key?: string;
  tags?: string[];
  position: 'top' | 'bottom' | 'left' | 'right';
  color: string;
}

export interface RenderNode {
  // ... existing fields
  
  // NEW: Port information
  ports?: {
    inputs: NodePort[];
    outputs: NodePort[];
  };
}

export interface RenderConnection {
  // ... existing fields
  
  // NEW: Port-specific connections
  fromPort?: string;  // Port ID
  toPort?: string;    // Port ID
}
```

---

### **Step 2: Extract Ports from Breadcrumbs**

**File:** `src/utils/portExtractor.ts` (NEW)

```typescript
export function extractPorts(node: RenderNode): { inputs: NodePort[], outputs: NodePort[] } {
  const inputs: NodePort[] = [];
  const outputs: NodePort[] = [];
  
  // Extract from agent definitions
  if (node.type === 'agent-definition' && node.data.schema_name === 'agent.def.v1') {
    const context = (node.data as Breadcrumb).context;
    
    // Input ports from subscriptions
    const subscriptions = context.subscriptions?.selectors || [];
    subscriptions.forEach((sub: any, index: number) => {
      inputs.push({
        id: `input-${index}`,
        type: 'input',
        schema_name: sub.schema_name,
        role: sub.role || inferRole(sub.schema_name),
        key: sub.key || sub.schema_name,
        tags: sub.any_tags || sub.all_tags,
        position: sub.role === 'trigger' ? 'top' : 'left',
        color: sub.role === 'trigger' ? '#ff6b6b' : '#4ECDC4'
      });
    });
    
    // Output ports from capabilities
    outputs.push({
      id: 'output-0',
      type: 'output',
      schema_name: 'agent.response.v1',
      position: 'bottom',
      color: '#FFD93D'
    });
    
    if (context.capabilities?.can_spawn_agents) {
      outputs.push({
        id: 'output-1',
        type: 'output',
        schema_name: 'agent.def.v1',
        position: 'right',
        color: '#95E1D3'
      });
    }
  }
  
  // Extract from tool definitions
  if (node.type === 'tool' && node.data.schema_name === 'tool.v1') {
    const context = (node.data as Breadcrumb).context;
    
    // Input: tool.request.v1 (always)
    inputs.push({
      id: 'input-0',
      type: 'input',
      schema_name: 'tool.request.v1',
      role: 'trigger',
      position: 'top',
      color: '#ff6b6b'
    });
    
    // Additional subscriptions (for auto-trigger)
    const subscriptions = context.subscriptions?.selectors || [];
    subscriptions.forEach((sub: any, index: number) => {
      inputs.push({
        id: `input-${index + 1}`,
        type: 'input',
        schema_name: sub.schema_name,
        role: sub.role || 'trigger',
        position: 'left',
        color: '#4ECDC4'
      });
    });
    
    // Output: tool.response.v1 (always)
    outputs.push({
      id: 'output-0',
      type: 'output',
      schema_name: 'tool.response.v1',
      position: 'bottom',
      color: '#FFD93D'
    });
  }
  
  return { inputs, outputs };
}

function inferRole(schema: string): 'trigger' | 'context' {
  const triggers = ['user.message.v1', 'agent.context.v1', 'tool.request.v1'];
  return triggers.includes(schema) ? 'trigger' : 'context';
}
```

---

### **Step 3: Render Ports on Nodes**

**File:** `src/components/nodes/NodePorts.tsx` (NEW)

```typescript
interface NodePortsProps {
  node: RenderNode;
  view: '2d' | '3d';
}

export function NodePorts({ node, view }: NodePortsProps) {
  const ports = extractPorts(node);
  
  if (!ports.inputs.length && !ports.outputs.length) return null;
  
  return (
    <div className="node-ports">
      {/* Input Ports */}
      <div className="input-ports">
        {ports.inputs.map(port => (
          <div
            key={port.id}
            className={`port input-port ${port.role}`}
            style={{
              backgroundColor: port.color,
              borderRadius: port.role === 'trigger' ? '50%' : '4px'
            }}
            title={`${port.schema_name} (${port.role})`}
          >
            {port.role === 'trigger' ? '▶' : '◀'}
          </div>
        ))}
      </div>
      
      {/* Output Ports */}
      <div className="output-ports">
        {ports.outputs.map(port => (
          <div
            key={port.id}
            className="port output-port"
            style={{ backgroundColor: port.color }}
            title={port.schema_name}
          >
            ▼
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

### **Step 4: Port-Based Connections**

**File:** `src/utils/portConnections.ts` (NEW)

```typescript
export function discoverPortConnections(nodes: RenderNode[]): RenderConnection[] {
  const connections: RenderConnection[] = [];
  
  // For each node with input ports
  for (const toNode of nodes) {
    if (!toNode.ports?.inputs) continue;
    
    for (const inputPort of toNode.ports.inputs) {
      // Find nodes that produce this schema
      const fromNodes = nodes.filter(n => 
        n.ports?.outputs.some(p => p.schema_name === inputPort.schema_name)
      );
      
      for (const fromNode of fromNodes) {
        const outputPort = fromNode.ports?.outputs.find(p => 
          p.schema_name === inputPort.schema_name
        );
        
        if (outputPort) {
          connections.push({
            id: `port-${fromNode.id}-${toNode.id}-${inputPort.id}`,
            type: inputPort.role === 'trigger' ? 'subscription' : 'emission',
            fromNodeId: fromNode.id,
            toNodeId: toNode.id,
            fromPort: outputPort.id,
            toPort: inputPort.id,
            metadata: {
              label: inputPort.schema_name,
              color: inputPort.color,
              style: inputPort.role === 'trigger' ? 'solid' : 'dashed',
              weight: inputPort.role === 'trigger' ? 3 : 1.5,
              animated: inputPort.role === 'trigger'
            },
            state: {
              visible: true,
              highlighted: false
            }
          });
        }
      }
    }
  }
  
  return connections;
}
```

---

## 🎨 Visual Indicators

### **Port Colors:**

```typescript
const PORT_COLORS = {
  // Input Ports
  trigger_input: '#ff6b6b',     // Red - triggers processing
  context_input: '#4ECDC4',     // Teal - context data
  
  // Output Ports
  response: '#FFD93D',          // Yellow - responses
  emit: '#95E1D3',              // Green - emitted events
  
  // Connection Types
  trigger_connection: '#ff6b6b',     // Solid red
  context_connection: '#4ECDC4',     // Dashed teal
  data_flow: '#A0D8F1'               // Light blue
};
```

### **Port Shapes:**

```
Trigger Input:  ● (circle - active)
Context Input:  ◀ (arrow - passive)
Output:         ▼ (arrow down)
```

---

## 📊 Example Visualizations

### **Agent Node with Ports:**

```
          ● agent.context.v1 (trigger - red)
          ◀ browser.page.context.v1 (context - teal)
          ◀ tool.catalog.v1 (context - teal)
┌─────────────────────────────────────────┐
│                                         │
│      Default Chat Assistant             │
│             🤖                          │
│                                         │
└─────────────────────────────────────────┘
          ▼ agent.response.v1 (yellow)
          ▼ tool.request.v1 (yellow)
```

### **Tool Node with Ports:**

```
          ● tool.request.v1 (trigger - red)
          ◀ browser.page.context.v1 (context - teal)
┌─────────────────────────────────────────┐
│                                         │
│          OpenRouter Tool                │
│             🛠️                          │
│                                         │
└─────────────────────────────────────────┘
          ▼ tool.response.v1 (yellow)
```

### **Data Flow Connections:**

```
[browser.page.context.v1 breadcrumb]
        │
        │ (dashed teal - context subscription)
        ↓
    ◀ [browser port] on Agent
        │
        │ (inside node - assembly)
        ↓
    ▼ [response port] on Agent
        │
        │ (solid yellow - creates)
        ↓
[agent.response.v1 breadcrumb]
```

---

## 🔄 Implementation Tasks

### **Phase 1: Add Port Data**

1. ✅ Update RenderNode type with ports
2. ✅ Create portExtractor utility
3. ✅ Extract ports during node conversion

### **Phase 2: Render Ports**

1. ✅ Create NodePorts component
2. ✅ Add to Node2D component
3. ✅ Add to Node3D component (as floating labels)

### **Phase 3: Port-Based Connections**

1. ✅ Create portConnections utility
2. ✅ Generate connections from ports
3. ✅ Render with role-based styling

### **Phase 4: Interaction**

1. ✅ Hover port → highlight connections
2. ✅ Click port → show details
3. ✅ Drag from port → create connection

---

## 🎯 Expected Result

**Dashboard will show:**

✅ **Agent nodes** with subscription ports (trigger vs context)  
✅ **Tool nodes** with request/response ports  
✅ **Breadcrumb nodes** as data sources  
✅ **Connections** showing data flow (trigger → fetch → execute)  
✅ **Visual distinction** between trigger and context subscriptions  
✅ **Real-time updates** as subscriptions change  

**The architecture becomes VISIBLE!**

---

Want me to implement this port visualization system for the Dashboard?
