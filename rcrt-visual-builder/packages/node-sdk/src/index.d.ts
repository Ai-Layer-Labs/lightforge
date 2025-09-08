/**
 * Node SDK for RCRT Visual Builder
 * Base classes and interfaces for building nodes
 */
import { RcrtClientEnhanced } from '@rcrt-builder/sdk';
import { NodePort, NodeExecutionResult, NodeContext, BreadcrumbBase } from '@rcrt-builder/core';
export interface NodeConfig {
    [key: string]: any;
}
export interface NodeMetadata {
    type: string;
    category: string;
    icon: string;
    color?: string;
    description?: string;
    inputs: NodePort[];
    outputs: NodePort[];
    version?: string;
}
export interface NodeTemplate {
    schema_name: string;
    title: string;
    tags: string[];
    context: {
        node_type: string;
        category: string;
        icon: string;
        color: string;
        description?: string;
    };
}
/**
 * Base class for all nodes
 */
export declare abstract class BaseNode {
    protected context: NodeContext;
    protected rcrtClient: RcrtClientEnhanced;
    constructor(context: NodeContext);
    /**
     * Define node metadata
     */
    abstract getMetadata(): NodeMetadata;
    /**
     * Validate configuration
     */
    abstract validateConfig(config: NodeConfig): boolean;
    /**
     * Execute node logic
     */
    abstract execute(inputs: Record<string, any>): Promise<NodeExecutionResult>;
    /**
     * Initialize node (optional)
     */
    initialize(): Promise<void>;
    /**
     * Cleanup resources (optional)
     */
    destroy(): Promise<void>;
    /**
     * Get a breadcrumb by ID
     */
    protected getBreadcrumb(id: string): Promise<import("@rcrt-builder/sdk").Breadcrumb>;
    /**
     * Create a new breadcrumb
     */
    protected createBreadcrumb(data: Partial<BreadcrumbBase>): Promise<{
        id: string;
    }>;
    /**
     * Update an existing breadcrumb
     */
    protected updateBreadcrumb(id: string, version: number, updates: any): Promise<import("@rcrt-builder/sdk").Breadcrumb>;
    /**
     * Search breadcrumbs in workspace
     */
    protected searchWorkspace(params: any): Promise<import("@rcrt-builder/sdk").Breadcrumb[]>;
    /**
     * Log execution metadata
     */
    protected logExecution(data: any): Promise<void>;
    /**
     * Handle errors gracefully
     */
    protected handleError(error: any, inputs?: any): Promise<void>;
}
/**
 * Node Registry for managing node templates
 */
export declare class NodeRegistry {
    private static templates;
    private static instances;
    /**
     * Register a node class with its template
     */
    static register(NodeClass: typeof BaseNode, template: NodeTemplate): void;
    /**
     * Get a node class by name
     */
    static getNodeClass(name: string): typeof BaseNode | undefined;
    /**
     * Get a node template by name
     */
    static getTemplate(name: string): NodeTemplate | undefined;
    /**
     * Get all registered node types
     */
    static getNodeTypes(): string[];
    /**
     * Create a node instance
     */
    static createNode(type: string, context: NodeContext): BaseNode;
}
/**
 * Decorator for auto-registering nodes
 */
export declare function RegisterNode(template: NodeTemplate): (target: any) => any;
/**
 * Helper to create a standardized node response
 */
export declare function createNodeResponse(outputs: Record<string, any>, metadata?: Record<string, any>): NodeExecutionResult;
/**
 * Helper to validate required inputs
 */
export declare function validateInputs(inputs: Record<string, any>, required: string[]): void;
/**
 * Helper to validate input types
 */
export declare function validateInputTypes(inputs: Record<string, any>, types: Record<string, string>): void;
/**
 * Export types from core
 */
export type { NodePort, NodeContext, NodeExecutionResult } from '@rcrt-builder/core';
//# sourceMappingURL=index.d.ts.map