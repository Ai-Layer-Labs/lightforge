/**
 * Agent Executor
 * Manages agent runtime lifecycle and SSE event processing
 */
import { AgentDefinitionV1, BreadcrumbEvent, AgentState } from '@rcrt-builder/core';
import { RcrtClientEnhanced } from '@rcrt-builder/sdk';
export interface AgentExecutorOptions {
    agentDef: AgentDefinitionV1;
    rcrtClient: RcrtClientEnhanced;
    workspace: string;
    openRouterApiKey?: string;
    autoStart?: boolean;
    metricsInterval?: number;
}
export declare class AgentExecutor {
    private agentDef;
    private rcrtClient;
    private llmClient;
    private workspace;
    private sseCleanup?;
    private state;
    private memory;
    private metricsTimer?;
    private options;
    constructor(options: AgentExecutorOptions);
    /**
     * Start the agent
     */
    start(): Promise<void>;
    /**
     * Stop the agent
     */
    stop(): Promise<void>;
    /**
     * Process a breadcrumb event
     */
    processEvent(event: BreadcrumbEvent): Promise<void>;
    /**
     * Start SSE subscriptions
     */
    private startSubscriptions;
    /**
     * Build context for decision making
     */
    private buildContext;
    /**
     * Build messages for LLM
     */
    private buildMessages;
    /**
     * Make decision using LLM
     */
    private makeDecision;
    /**
     * Execute decision
     */
    private executeDecision;
    /**
     * Load memory from breadcrumbs
     */
    private loadMemory;
    /**
     * Save memory to breadcrumbs
     */
    private saveMemory;
    /**
     * Start metrics reporting
     */
    private startMetricsReporting;
    /**
     * Report agent metrics
     */
    private reportMetrics;
    /**
     * Log error as breadcrumb
     */
    private logError;
    /**
     * Get agent state
     */
    getState(): AgentState;
    /**
     * Get agent definition
     */
    getDefinition(): AgentDefinitionV1;
}
//# sourceMappingURL=agent-executor.d.ts.map