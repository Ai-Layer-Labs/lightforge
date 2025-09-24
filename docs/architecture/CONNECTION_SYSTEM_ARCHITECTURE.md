# Dynamic Connection Line System Architecture

## 🎯 **System Overview: Completely Data-Driven**

The connection line system is built on **dynamic pattern matching**, not hardcoded rules. It analyzes the actual data relationships to determine what should be connected.

## 🔗 **Current Connection Types (All Dynamic)**

### 1. **Agent Subscription Connections** 📡
**How it works**:
```javascript
// Finds agents with subscriptions
dashboardState.subscriptions.forEach(subscription => {
    // Uses selector matching to find related breadcrumbs
    const matchingBreadcrumbs = this.findMatchingBreadcrumbs(subscription.selector);
    // Connects agent to all matching breadcrumbs
});
```

**Dynamic Rules**:
- **Tag Matching**: `any_tags: ["workspace:tools", "urgent"]` → connects to breadcrumbs with either tag
- **Schema Matching**: `schema_name: "user.profile.v1"` → connects to specific schema types
- **Context Matching**: `$.priority == "high"` → connects based on JSON path conditions

**Example**: Agent subscribes to `["tool:response"]` → automatically connects to ALL future tool responses

### 2. **Tool Creation Connections** 🛠️
**How it works**:
```javascript
// Finds breadcrumbs created by each tool
const toolBreadcrumbs = this.findToolCreatedBreadcrumbs(tool.name);
// Connects tool to all breadcrumbs it created
```

**Dynamic Rules**:
- **Tag Pattern**: Looks for `["workspace:tools", "tool:response"]` + tool name
- **Creator Metadata**: Analyzes `created_by` and context fields
- **Naming Patterns**: Matches titles like "Response: openrouter"

**Example**: OpenRouter tool automatically connects to all breadcrumbs it creates (responses, errors, etc.)

### 3. **Secret Usage Connections** 🔐
**How it works**:
```javascript
// Finds tool configurations that reference secrets
const toolConfigs = breadcrumbs.filter(b => 
    b.tags?.includes('tool:config') && 
    b.context?.secret_id
);
// Connects secret to tool based on configuration data
```

**Dynamic Rules**:
- **Configuration Analysis**: Reads tool config breadcrumbs
- **ID References**: Follows `secret_id` → secret relationships
- **Scope Matching**: Agent-scoped secrets connect to their agents

**Example**: Any tool configured with a secret automatically gets connected

## 🚀 **Adding New Connection Types (No Hardcoding Required)**

### Pattern 1: **Tag-Based Connections**
```javascript
// Example: Connect workflows to their steps
const workflowSteps = breadcrumbs.filter(b => 
    b.tags?.includes('workflow:step') && 
    b.context?.workflow_id
);

workflowSteps.forEach(step => {
    const workflow = breadcrumbs.find(w => 
        w.id === step.context.workflow_id
    );
    if (workflow) {
        // Create connection: workflow → step
        createConnectionLine(workflowPos, stepPos, 'workflow');
    }
});
```

### Pattern 2: **Schema-Based Connections**
```javascript
// Example: Connect templates to instances
const templateInstances = breadcrumbs.filter(b => 
    b.schema_name?.endsWith('.instance.v1') &&
    b.context?.template_id
);

templateInstances.forEach(instance => {
    const template = breadcrumbs.find(t => 
        t.id === instance.context.template_id
    );
    if (template) {
        // Create connection: template → instance
        createConnectionLine(templatePos, instancePos, 'template');
    }
});
```

### Pattern 3: **Dependency Connections**
```javascript
// Example: Connect tools that depend on other tools
const toolDependencies = breadcrumbs.filter(b => 
    b.tags?.includes('tool:dependency') &&
    b.context?.depends_on
);

toolDependencies.forEach(dep => {
    const dependentTool = tools.find(t => t.name === dep.context.tool_name);
    const requiredTool = tools.find(t => t.name === dep.context.depends_on);
    if (dependentTool && requiredTool) {
        // Create connection: required → dependent
        createConnectionLine(requiredPos, dependentPos, 'dependency');
    }
});
```

## 🎨 **Connection Rule Engine**

The system follows these extensible patterns:

### 1. **Data Discovery**
```javascript
// Find entities that might be connected
const candidates = breadcrumbs.filter(b => matchesCriteria(b));
```

### 2. **Relationship Analysis**
```javascript
// Analyze relationships between entities
candidates.forEach(candidate => {
    const related = findRelatedEntities(candidate);
    // Create connections based on relationships
});
```

### 3. **Visual Rendering**
```javascript
// Create visual representation
const line = createConnectionLine(fromPos, toPos, connectionType);
canvas.appendChild(line);
```

## 🔧 **Adding New Connection Types**

### Step 1: **Define the Rule**
```javascript
// Add to renderConnections() method
async renderNewConnectionType() {
    const entities = dashboardState.breadcrumbs.filter(b => 
        // Your matching criteria here
        b.tags?.includes('your:tag') &&
        b.context?.your_field
    );
    
    entities.forEach(entity => {
        // Your relationship logic here
        const related = findRelatedEntity(entity);
        if (related) {
            const line = this.canvasEngine.createConnectionLine(
                entityPos, relatedPos, 'your-connection-type'
            );
            this.canvas.appendChild(line);
            
            dashboardState.connections.push({
                from: entity.id,
                to: related.id,
                line: line,
                type: 'your-connection-type'
            });
        }
    });
}
```

### Step 2: **Add to Rendering Pipeline**
```javascript
async renderConnections() {
    // ... existing connections ...
    
    // Add your new connection type
    await this.renderNewConnectionType();
}
```

### Step 3: **Add CSS Styling**
```css
.connection-line.your-connection-type {
    background: linear-gradient(90deg, rgba(R, G, B, 0.3), rgba(R2, G2, B2, 0.3));
    height: 1px;
    z-index: 5;
    opacity: 0.7;
}
```

### Step 4: **Add 3D Support**
```javascript
// Add to render3DConnections()
const yourConnections = this.scene.children.filter(/* your criteria */);
yourConnections.forEach(connection => {
    const line = this.create3DConnectionLine(
        startPos, endPos, 'your-type', connectionData
    );
    this.scene.add(line);
});
```

## 📊 **Current Dynamic Behaviors**

### **Automatic Discovery**
- ✅ **New agents** → automatically get subscription connections
- ✅ **New tools** → automatically connect to breadcrumbs they create
- ✅ **New secrets** → automatically connect when tools are configured
- ✅ **New breadcrumbs** → automatically connect based on tags and content

### **Real-Time Updates**
- ✅ **Tag changes** → connections recalculate
- ✅ **New subscriptions** → new connection lines appear
- ✅ **Tool configurations** → secret connections update
- ✅ **Schema evolution** → connections adapt to new schemas

### **Zero Hardcoding**
- ✅ **No hardcoded IDs** → uses pattern matching
- ✅ **No hardcoded positions** → calculates from node positions
- ✅ **No hardcoded colors** → uses type-based styling
- ✅ **No hardcoded relationships** → discovers from data

## 🎯 **Extension Examples**

### Example 1: **Workflow Connections**
```javascript
// Automatically connect workflow steps
const workflowBreadcrumbs = breadcrumbs.filter(b => 
    b.tags?.includes('workflow:step') && 
    b.context?.step_number
);

// Sort by step number and connect in sequence
workflowBreadcrumbs
    .sort((a, b) => a.context.step_number - b.context.step_number)
    .forEach((step, index) => {
        if (index > 0) {
            const prevStep = workflowBreadcrumbs[index - 1];
            // Connect: previous step → current step
            createWorkflowConnection(prevStep, step);
        }
    });
```

### Example 2: **Dependency Connections**
```javascript
// Automatically connect dependencies
const dependencies = breadcrumbs.filter(b => 
    b.schema_name === 'dependency.v1' &&
    b.context?.depends_on
);

dependencies.forEach(dep => {
    const dependent = findEntityById(dep.context.entity_id);
    const required = findEntityById(dep.context.depends_on);
    // Connect: required → dependent
    createDependencyConnection(required, dependent);
});
```

### Example 3: **Permission Connections**
```javascript
// Automatically connect permissions
const permissions = breadcrumbs.filter(b => 
    b.tags?.includes('acl:grant') &&
    b.context?.resource_id
);

permissions.forEach(perm => {
    const agent = findAgentById(perm.context.agent_id);
    const resource = findResourceById(perm.context.resource_id);
    // Connect: agent → resource (with permission type)
    createPermissionConnection(agent, resource, perm.context.actions);
});
```

## 🔧 **Configuration-Driven Connections**

You can even make connections completely configuration-driven:

```javascript
// Define connection rules in data
const connectionRules = [
    {
        name: 'tool-dependencies',
        source: { tags: ['tool:definition'], context: 'dependencies' },
        target: { type: 'tool', match: 'name' },
        style: { color: 'blue', type: 'dependency' }
    },
    {
        name: 'workflow-steps',
        source: { tags: ['workflow:step'], context: 'workflow_id' },
        target: { tags: ['workflow:definition'], match: 'id' },
        style: { color: 'purple', type: 'workflow' }
    }
];

// Apply rules dynamically
connectionRules.forEach(rule => {
    applyConnectionRule(rule);
});
```

## 🎉 **Why This System Scales**

### **Data-Driven Architecture**
- ✅ Connections based on actual relationships, not hardcoded rules
- ✅ New entity types automatically participate in connection system
- ✅ Rules can be added without modifying existing code

### **Pattern-Based Matching**
- ✅ Tag patterns work for any new tag schema
- ✅ Context analysis works for any JSON structure
- ✅ ID references work for any entity type

### **Extensible Rendering**
- ✅ New connection types just need CSS styling
- ✅ 3D support follows same patterns
- ✅ Visual feedback system works for all types

## 🚀 **Future Possibilities**

With this architecture, you can easily add:
- **🔄 Workflow connections** (step → step)
- **📊 Data flow connections** (input → transformation → output)
- **🔒 Permission connections** (agent → resource)
- **📋 Template connections** (template → instance)
- **⚡ Event connections** (trigger → handler)
- **🌐 Network connections** (service → service)

**The key insight**: The system analyzes your data to discover relationships automatically. As you add new schemas, tags, and patterns, the connections will emerge naturally from the data structure itself.

No hardcoding required! 🎉
