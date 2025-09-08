/**
 * Flow Executor
 * Executes flow definitions by running nodes in topological order
 */
import { FlowDefinitionV1, FlowExecutionStateV1, BreadcrumbEvent } from '@rcrt-builder/core';
import { RcrtClientEnhanced } from '@rcrt-builder/sdk';
export interface FlowExecutorOptions {
    rcrtClient: RcrtClientEnhanced;
    workspace: string;
    maxParallelNodes?: number;
    timeout?: number;
}
export declare class FlowExecutor {
    private flow;
    private rcrtClient;
    private workspace;
    private nodeInstances;
    private nodeOutputs;
    private executionState?;
    private options;
    constructor(flow: FlowDefinitionV1, options: FlowExecutorOptions);
    /**
     * Initialize the flow executor
     */
    initialize(): Promise<void>;
    /**
     * Execute the flow with a trigger event
     */
    execute(trigger?: BreadcrumbEvent): Promise<FlowExecutionStateV1>;
    /**
     * Execute nodes in parallel where possible
     */
    executeParallel(trigger?: BreadcrumbEvent): Promise<FlowExecutionStateV1>;
    /**
     * Stop the flow execution
     */
    stop(): Promise<void>;
    /**
     * Create a node instance
     */
    private createNodeInstance;
    /**
     * Execute a single node
     */
    private executeNode;
    /**
     * Gather inputs for a node
     */
    private gatherNodeInputs;
    /**
     * Build execution graph
     */
    private buildExecutionGraph;
    /**
     * Create execution state breadcrumb
     */
    private createExecutionState;
    /**
     * Update execution state
     */
    private updateExecutionState;
    /**
     * Update node state
     */
    private updateNodeState;
}
//# sourceMappingURL=flow-executor.d.ts.map