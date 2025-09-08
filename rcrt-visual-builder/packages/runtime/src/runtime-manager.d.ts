/**
 * Runtime Manager
 * Orchestrates flows and agents
 */
import { BreadcrumbEvent } from '@rcrt-builder/core';
import { FlowExecutor } from './executor/flow-executor';
import { AgentExecutor } from './agent/agent-executor';
export interface RuntimeManagerOptions {
    rcrtUrl: string;
    workspace: string;
    authMode?: 'disabled' | 'jwt' | 'key';
    authToken?: string;
    openRouterApiKey?: string;
    autoStart?: boolean;
}
export declare class RuntimeManager {
    private rcrtClient;
    private workspace;
    private options;
    private flows;
    private agents;
    private sseClient?;
    private isRunning;
    constructor(options: RuntimeManagerOptions);
    /**
     * Start the runtime manager
     */
    start(): Promise<void>;
    /**
     * Stop the runtime manager
     */
    stop(): Promise<void>;
    /**
     * Load flow definitions
     */
    private loadFlows;
    /**
     * Load agent definitions
     */
    private loadAgents;
    /**
     * Start SSE monitoring
     */
    private startSSEMonitoring;
    /**
     * Handle SSE events
     */
    private handleSSEEvent;
    /**
     * Create flow executor
     */
    private createFlowExecutor;
    /**
     * Create agent executor
     */
    private createAgentExecutor;
    /**
     * Trigger a flow
     */
    private triggerFlow;
    /**
     * Execute a flow manually
     */
    executeFlow(flowId: string, trigger?: BreadcrumbEvent): Promise<void>;
    /**
     * Get runtime stats
     */
    getStats(): {
        running: boolean;
        flows: number;
        agents: number;
        workspace: string;
    };
    /**
     * Get flow executor
     */
    getFlow(flowId: string): FlowExecutor | undefined;
    /**
     * Get agent executor
     */
    getAgent(agentId: string): AgentExecutor | undefined;
}
//# sourceMappingURL=runtime-manager.d.ts.map