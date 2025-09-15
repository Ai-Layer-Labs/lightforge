# Adding New Connection Types - Practical Guide

## 🎯 **How the System Works (No Hardcoding)**

The connection system is **completely data-driven**. Here's how it discovers connections:

### **Current Dynamic Patterns**

1. **📡 Agent Subscriptions**: 
   ```javascript
   // Completely dynamic - matches ANY breadcrumb that fits the selector
   const matchingBreadcrumbs = this.findMatchingBreadcrumbs(subscription.selector);
   ```

2. **🛠️ Tool Creation**: 
   ```javascript
   // Dynamic - finds breadcrumbs by tag patterns
   const toolBreadcrumbs = this.findToolCreatedBreadcrumbs(tool.name);
   ```

3. **🔐 Secret Usage**: 
   ```javascript
   // Dynamic - analyzes configuration breadcrumbs
   const toolConfigs = breadcrumbs.filter(b => 
       b.tags?.includes('tool:config') && b.context?.secret_id
   );
   ```

## 🚀 **Adding New Connection Types**

### **Example 1: Workflow Step Connections**

**Step 1**: Create breadcrumbs with the right structure
```javascript
// Workflow definition
{
  title: "Data Processing Workflow",
  tags: ["workflow:definition", "data:processing"],
  schema_name: "workflow.v1",
  context: { workflow_id: "workflow-123", steps: ["step1", "step2", "step3"] }
}

// Workflow steps
{
  title: "Extract Data",
  tags: ["workflow:step", "data:extract"],
  schema_name: "workflow.step.v1", 
  context: { workflow_id: "workflow-123", step_number: 1, next_step: "step2" }
}
```

**Step 2**: Add connection logic (just add this method)
```javascript
renderWorkflowConnections() {
    // Find all workflow steps
    const workflowSteps = dashboardState.breadcrumbs.filter(b => 
        b.tags?.includes('workflow:step') && 
        b.context?.workflow_id
    );
    
    // Group by workflow
    const workflows = {};
    workflowSteps.forEach(step => {
        const workflowId = step.context.workflow_id;
        if (!workflows[workflowId]) workflows[workflowId] = [];
        workflows[workflowId].push(step);
    });
    
    // Connect steps in sequence
    Object.values(workflows).forEach(steps => {
        steps.sort((a, b) => a.context.step_number - b.context.step_number);
        
        for (let i = 1; i < steps.length; i++) {
            const prevStep = steps[i-1];
            const currentStep = steps[i];
            
            const prevPos = dashboardState.nodePositions.find(p => p.id === prevStep.id);
            const currentPos = dashboardState.nodePositions.find(p => p.id === currentStep.id);
            
            if (prevPos && currentPos) {
                const line = this.canvasEngine.createConnectionLine(
                    prevPos, currentPos, 'workflow'
                );
                this.canvas.appendChild(line);
                
                dashboardState.connections.push({
                    from: prevStep.id,
                    to: currentStep.id,
                    line: line,
                    type: 'workflow-step'
                });
            }
        }
    });
}
```

**Step 3**: Add to render pipeline
```javascript
async renderConnections() {
    // ... existing connections ...
    this.renderWorkflowConnections();  // ← Just add this line
}
```

**Step 4**: Add CSS styling
```css
.connection-line.workflow {
    background: linear-gradient(90deg, rgba(138, 43, 226, 0.3), rgba(75, 0, 130, 0.3));
    height: 1px;
    z-index: 5;
    opacity: 0.7;
}
```

### **Example 2: Template Instance Connections**

**Data Structure**:
```javascript
// Template
{
  title: "User Profile Template",
  tags: ["template:definition", "user:profile"],
  schema_name: "template.v1"
}

// Instance
{
  title: "John's Profile", 
  tags: ["template:instance", "user:profile"],
  schema_name: "user.profile.v1",
  context: { template_id: "template-uuid", instance_of: "User Profile Template" }
}
```

**Connection Logic** (just add this method):
```javascript
renderTemplateConnections() {
    const templateInstances = dashboardState.breadcrumbs.filter(b => 
        b.tags?.includes('template:instance') && 
        b.context?.template_id
    );
    
    templateInstances.forEach(instance => {
        const template = dashboardState.breadcrumbs.find(t => 
            t.id === instance.context.template_id
        );
        
        if (template) {
            const templatePos = dashboardState.nodePositions.find(p => p.id === template.id);
            const instancePos = dashboardState.nodePositions.find(p => p.id === instance.id);
            
            if (templatePos && instancePos) {
                const line = this.canvasEngine.createConnectionLine(
                    templatePos, instancePos, 'template'
                );
                this.canvas.appendChild(line);
                
                dashboardState.connections.push({
                    template: template.id,
                    instance: instance.id,
                    line: line,
                    type: 'template-instance'
                });
            }
        }
    });
}
```

## 🎯 **Key Principles for Scalability**

### 1. **Use Data Patterns, Not Hardcoded Rules**
```javascript
// ✅ GOOD: Pattern-based
const configs = breadcrumbs.filter(b => 
    b.tags?.includes('config') && b.context?.target_id
);

// ❌ BAD: Hardcoded
if (breadcrumb.id === 'specific-id') { /* hardcoded logic */ }
```

### 2. **Leverage Tags and Schema**
```javascript
// ✅ GOOD: Tag-based discovery
const apiKeys = breadcrumbs.filter(b => 
    b.tags?.includes('secret:api-key')
);

// ❌ BAD: Name-based hardcoding
if (breadcrumb.title.includes('API Key')) { /* fragile */ }
```

### 3. **Use Context for Complex Relationships**
```javascript
// ✅ GOOD: Context-based relationships
const dependencies = breadcrumbs.filter(b => 
    b.context?.depends_on && b.context?.dependency_type
);

// ❌ BAD: Positional assumptions
const nearby = findNearbyNodes(position); // fragile
```

## 🔗 **Connection Discovery Engine**

The system already has a powerful discovery engine:

```javascript
// Finds connections based on multiple criteria
function discoverConnections(entities, rules) {
    return entities.flatMap(entity => 
        rules.flatMap(rule => 
            findRelatedEntities(entity, rule)
        )
    );
}

// Example rules (can be data-driven)
const connectionRules = [
    { pattern: 'subscription', match: 'selector' },
    { pattern: 'creation', match: 'creator' },
    { pattern: 'reference', match: 'id' },
    { pattern: 'scope', match: 'scope_id' }
];
```

## 🎉 **The Bottom Line**

**You DON'T need to hardcode anything!** 

The system is designed to:
- ✅ **Discover relationships** from your data structure
- ✅ **Adapt to new schemas** automatically
- ✅ **Scale with new entity types** without code changes
- ✅ **Update in real-time** as data changes

Just follow the **data patterns** (tags, schema, context) and the connections will emerge automatically from your data structure! 🚀
