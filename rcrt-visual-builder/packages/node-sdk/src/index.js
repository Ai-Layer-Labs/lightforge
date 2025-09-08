/**
 * Node SDK for RCRT Visual Builder
 * Base classes and interfaces for building nodes
 */
/**
 * Base class for all nodes
 */
export class BaseNode {
    context;
    rcrtClient;
    constructor(context) {
        this.context = context;
        this.rcrtClient = context.rcrtClient;
    }
    /**
     * Initialize node (optional)
     */
    async initialize() {
        // Override in subclasses if needed
    }
    /**
     * Cleanup resources (optional)
     */
    async destroy() {
        // Override in subclasses if needed
    }
    // Helper methods
    /**
     * Get a breadcrumb by ID
     */
    async getBreadcrumb(id) {
        return this.rcrtClient.getBreadcrumb(id);
    }
    /**
     * Create a new breadcrumb
     */
    async createBreadcrumb(data) {
        return this.rcrtClient.createBreadcrumb({
            title: data.title || 'Node Created Breadcrumb',
            context: data.context || {},
            tags: [...(data.tags || []), this.context.workspace],
            schema_name: data.schema_name,
        });
    }
    /**
     * Update an existing breadcrumb
     */
    async updateBreadcrumb(id, version, updates) {
        return this.rcrtClient.updateBreadcrumb(id, version, updates);
    }
    /**
     * Search breadcrumbs in workspace
     */
    async searchWorkspace(params) {
        return this.rcrtClient.searchBreadcrumbs({
            ...params,
            tag: this.context.workspace,
        });
    }
    /**
     * Log execution metadata
     */
    async logExecution(data) {
        await this.createBreadcrumb({
            schema_name: 'node.execution.v1',
            title: `Node Execution: ${this.context.breadcrumb_id}`,
            tags: ['node:execution', `node:${this.getMetadata().type}`],
            context: {
                node_id: this.context.breadcrumb_id,
                node_type: this.getMetadata().type,
                timestamp: new Date().toISOString(),
                ...data,
            },
        });
    }
    /**
     * Handle errors gracefully
     */
    async handleError(error, inputs) {
        await this.createBreadcrumb({
            schema_name: 'node.error.v1',
            title: `Node Error: ${this.context.breadcrumb_id}`,
            tags: ['node:error', `node:${this.getMetadata().type}`],
            context: {
                node_id: this.context.breadcrumb_id,
                node_type: this.getMetadata().type,
                error: error.message || String(error),
                stack: error.stack,
                inputs,
                timestamp: new Date().toISOString(),
            },
        });
        throw error;
    }
}
/**
 * Node Registry for managing node templates
 */
export class NodeRegistry {
    static templates = new Map();
    static instances = new Map();
    /**
     * Register a node class with its template
     */
    static register(NodeClass, template) {
        const className = NodeClass.name;
        this.instances.set(className, NodeClass);
        this.templates.set(className, template);
        // Store template metadata on the class
        NodeClass.__template = template;
    }
    /**
     * Get a node class by name
     */
    static getNodeClass(name) {
        return this.instances.get(name);
    }
    /**
     * Get a node template by name
     */
    static getTemplate(name) {
        return this.templates.get(name);
    }
    /**
     * Get all registered node types
     */
    static getNodeTypes() {
        return Array.from(this.instances.keys());
    }
    /**
     * Create a node instance
     */
    static createNode(type, context) {
        const NodeClass = this.instances.get(type);
        if (!NodeClass) {
            throw new Error(`Unknown node type: ${type}`);
        }
        return new NodeClass(context);
    }
}
/**
 * Decorator for auto-registering nodes
 */
export function RegisterNode(template) {
    return function (target) {
        NodeRegistry.register(target, template);
        return target;
    };
}
/**
 * Helper to create a standardized node response
 */
export function createNodeResponse(outputs, metadata) {
    return {
        outputs,
        metadata: {
            ...metadata,
            timestamp: new Date().toISOString(),
        },
    };
}
/**
 * Helper to validate required inputs
 */
export function validateInputs(inputs, required) {
    for (const key of required) {
        if (!(key in inputs) || inputs[key] === undefined) {
            throw new Error(`Missing required input: ${key}`);
        }
    }
}
/**
 * Helper to validate input types
 */
export function validateInputTypes(inputs, types) {
    for (const [key, expectedType] of Object.entries(types)) {
        if (key in inputs) {
            const actualType = typeof inputs[key];
            if (actualType !== expectedType) {
                throw new Error(`Invalid type for input ${key}: expected ${expectedType}, got ${actualType}`);
            }
        }
    }
}
//# sourceMappingURL=index.js.map