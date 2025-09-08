/**
 * Agent Executor
 * Manages agent runtime lifecycle and SSE event processing
 */
class SimpleOpenRouterClient {
    apiKey;
    baseUrl = 'https://openrouter.ai/api/v1';
    constructor(apiKey) {
        this.apiKey = apiKey || process.env.OPENROUTER_API_KEY || '';
    }
    async complete(params) {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://rcrt-builder.local',
                'X-Title': 'RCRT Agent Executor',
            },
            body: JSON.stringify({
                model: params.model,
                messages: params.messages,
                temperature: params.temperature || 0.7,
                max_tokens: params.max_tokens || 4096,
                tools: params.tools,
                stream: false,
            }),
        });
        if (!response.ok) {
            throw new Error(`OpenRouter API error: ${response.status}`);
        }
        const data = await response.json();
        return {
            content: data.choices[0].message.content,
            model: data.model,
            usage: data.usage,
            tool_calls: data.choices[0].message.tool_calls,
        };
    }
}
export class AgentExecutor {
    agentDef;
    rcrtClient;
    llmClient;
    workspace;
    sseCleanup;
    state;
    memory = new Map();
    metricsTimer;
    options;
    constructor(options) {
        this.options = options;
        this.agentDef = options.agentDef;
        this.rcrtClient = options.rcrtClient;
        this.workspace = options.workspace;
        this.llmClient = new SimpleOpenRouterClient(options.openRouterApiKey);
        // Initialize state
        this.state = {
            agent_id: this.agentDef.context.agent_id,
            status: 'idle',
            metrics: {
                events_processed: 0,
                errors: 0,
                last_activity: new Date(),
            },
        };
        if (options.autoStart) {
            this.start().catch(error => {
                console.error('Failed to auto-start agent:', error);
            });
        }
    }
    /**
     * Start the agent
     */
    async start() {
        console.log(`🤖 Starting agent: ${this.agentDef.context.agent_id}`);
        // Update state
        this.state.status = 'idle';
        // Load memory if configured
        if (this.agentDef.context.memory?.type === 'breadcrumb') {
            await this.loadMemory();
        }
        // Start SSE subscriptions
        await this.startSubscriptions();
        // Start metrics reporting
        if (this.options.metricsInterval) {
            this.startMetricsReporting();
        }
        console.log(`✅ Agent started: ${this.agentDef.context.agent_id}`);
    }
    /**
     * Stop the agent
     */
    async stop() {
        console.log(`🛑 Stopping agent: ${this.agentDef.context.agent_id}`);
        // Update state
        this.state.status = 'stopped';
        // Stop SSE subscriptions
        if (this.sseCleanup) {
            this.sseCleanup();
            this.sseCleanup = undefined;
        }
        // Stop metrics reporting
        if (this.metricsTimer) {
            clearInterval(this.metricsTimer);
            this.metricsTimer = undefined;
        }
        // Save memory if configured
        if (this.agentDef.context.memory?.type === 'breadcrumb') {
            await this.saveMemory();
        }
        // Report final metrics
        await this.reportMetrics();
        console.log(`✅ Agent stopped: ${this.agentDef.context.agent_id}`);
    }
    /**
     * Process a breadcrumb event
     */
    async processEvent(event) {
        // Skip ping events
        if (event.type === 'ping' || !event.breadcrumb_id) {
            return;
        }
        console.log(`📨 Processing event: ${event.type} for ${event.breadcrumb_id}`);
        // Update state
        this.state.status = 'processing';
        this.state.current_event = event;
        this.state.metrics.last_activity = new Date();
        try {
            // Fetch the triggering breadcrumb
            const breadcrumb = await this.rcrtClient.getBreadcrumb(event.breadcrumb_id);
            // Build context
            const context = await this.buildContext(breadcrumb);
            // Build messages for LLM
            const messages = this.buildMessages(breadcrumb, context);
            // Call LLM for decision
            const decision = await this.makeDecision(messages);
            // Execute decision
            await this.executeDecision(decision);
            // Update metrics
            this.state.metrics.events_processed++;
            console.log(`✅ Processed event: ${event.type}`);
        }
        catch (error) {
            console.error(`❌ Error processing event: ${error}`);
            this.state.metrics.errors++;
            // Log error as breadcrumb
            await this.logError(error, event);
        }
        finally {
            this.state.status = 'idle';
            this.state.current_event = undefined;
        }
    }
    /**
     * Start SSE subscriptions
     */
    async startSubscriptions() {
        const selectors = this.agentDef.context.subscriptions?.selectors || [];
        if (selectors.length === 0) {
            console.warn('No subscriptions configured for agent');
            return;
        }
        // Subscribe to events with auto-reconnect
        for (const selector of selectors) {
            this.sseCleanup = this.rcrtClient.startEventStream((event) => {
                // Process event asynchronously
                this.processEvent(event).catch(error => {
                    console.error('Event processing error:', error);
                });
            }, {
                reconnectDelay: 5000,
                filters: selector,
                agentId: this.agentDef.context.agent_id,
            });
        }
    }
    /**
     * Build context for decision making
     */
    async buildContext(trigger) {
        const context = [];
        // Add trigger
        context.push({
            type: 'trigger',
            data: trigger,
        });
        // Add memory
        if (this.memory.size > 0) {
            context.push({
                type: 'memory',
                data: Array.from(this.memory.entries()),
            });
        }
        // Fetch additional context based on subscriptions
        const selectors = this.agentDef.context.subscriptions?.selectors || [];
        for (const selector of selectors) {
            const breadcrumbs = await this.rcrtClient.searchBreadcrumbs(selector);
            context.push({
                type: 'subscription',
                selector,
                data: breadcrumbs.slice(0, 10), // Limit to recent 10
            });
        }
        return context;
    }
    /**
     * Build messages for LLM
     */
    buildMessages(trigger, context) {
        const messages = [];
        // System prompt
        messages.push({
            role: 'system',
            content: this.agentDef.context.system_prompt,
        });
        // Add context
        if (context.length > 0) {
            messages.push({
                role: 'system',
                content: `Context (${context.length} items):\n${JSON.stringify(context, null, 2)}`,
            });
        }
        // Add trigger as user message
        messages.push({
            role: 'user',
            content: `Process this trigger:\n${JSON.stringify(trigger, null, 2)}`,
        });
        // Add capabilities reminder
        const capabilities = this.agentDef.context.capabilities;
        messages.push({
            role: 'system',
            content: `Your capabilities: ${JSON.stringify(capabilities)}. Return your decision as JSON with an "action" field.`,
        });
        return messages;
    }
    /**
     * Make decision using LLM
     */
    async makeDecision(messages) {
        const response = await this.llmClient.complete({
            model: this.agentDef.context.model,
            messages,
            temperature: this.agentDef.context.temperature || 0.7,
            max_tokens: this.agentDef.context.max_tokens || 4096,
            tools: this.agentDef.context.tools,
        });
        // Parse decision
        try {
            return JSON.parse(response.content);
        }
        catch {
            // Fallback parsing
            const content = response.content.toLowerCase();
            if (content.includes('create')) {
                return { action: 'create', details: response.content };
            }
            else if (content.includes('update')) {
                return { action: 'update', details: response.content };
            }
            else if (content.includes('delete')) {
                return { action: 'delete', details: response.content };
            }
            else {
                return { action: 'none', details: response.content };
            }
        }
    }
    /**
     * Execute decision
     */
    async executeDecision(decision) {
        console.log(`⚡ Executing decision: ${decision.action}`);
        const capabilities = this.agentDef.context.capabilities;
        switch (decision.action) {
            case 'create':
                if (capabilities.can_create_breadcrumbs && decision.breadcrumb) {
                    await this.rcrtClient.createBreadcrumb({
                        ...decision.breadcrumb,
                        tags: [...(decision.breadcrumb.tags || []), this.workspace],
                    });
                }
                break;
            case 'update':
                if (capabilities.can_update_own && decision.id && decision.version) {
                    await this.rcrtClient.updateBreadcrumb(decision.id, decision.version, decision.updates);
                }
                break;
            case 'delete':
                if (capabilities.can_delete_own && decision.id) {
                    await this.rcrtClient.deleteBreadcrumb(decision.id, decision.version);
                }
                break;
            case 'spawn':
                if (capabilities.can_spawn_agents && decision.agent_def) {
                    await this.rcrtClient.createBreadcrumb({
                        ...decision.agent_def,
                        schema_name: 'agent.def.v1',
                        tags: [...(decision.agent_def.tags || []), this.workspace],
                    });
                }
                break;
            case 'none':
                // No action needed
                break;
            default:
                console.warn(`Unknown action: ${decision.action}`);
        }
        // Update memory if needed
        if (decision.remember) {
            this.memory.set(`decision-${Date.now()}`, decision);
        }
    }
    /**
     * Load memory from breadcrumbs
     */
    async loadMemory() {
        const memoryBreadcrumbs = await this.rcrtClient.searchBreadcrumbs({
            schema_name: 'agent.memory.v1',
            any_tags: [`agent:${this.agentDef.context.agent_id}`],
        });
        for (const breadcrumb of memoryBreadcrumbs) {
            this.memory.set(breadcrumb.id, breadcrumb.context.content);
        }
        console.log(`📚 Loaded ${memoryBreadcrumbs.length} memory items`);
    }
    /**
     * Save memory to breadcrumbs
     */
    async saveMemory() {
        for (const [key, value] of this.memory) {
            await this.rcrtClient.createBreadcrumb({
                schema_name: 'agent.memory.v1',
                title: `Memory: ${key}`,
                tags: [`agent:${this.agentDef.context.agent_id}`, 'agent:memory', this.workspace],
                context: {
                    agent_id: this.agentDef.context.agent_id,
                    memory_type: 'working',
                    content: value,
                    created_at: new Date().toISOString(),
                },
            });
        }
        console.log(`💾 Saved ${this.memory.size} memory items`);
    }
    /**
     * Start metrics reporting
     */
    startMetricsReporting() {
        const interval = this.options.metricsInterval || 60000; // Default 1 minute
        this.metricsTimer = setInterval(() => {
            this.reportMetrics().catch(error => {
                console.error('Failed to report metrics:', error);
            });
        }, interval);
    }
    /**
     * Report agent metrics
     */
    async reportMetrics() {
        const metrics = {
            schema_name: 'agent.metrics.v1',
            title: `Metrics: ${this.agentDef.context.agent_id}`,
            tags: [`agent:${this.agentDef.context.agent_id}`, 'agent:metrics', this.workspace],
            context: {
                agent_id: this.agentDef.context.agent_id,
                timestamp: new Date().toISOString(),
                metrics: {
                    total_events_processed: this.state.metrics.events_processed,
                    breadcrumbs_created: 0, // Would need to track this
                    breadcrumbs_updated: 0, // Would need to track this
                    breadcrumbs_deleted: 0, // Would need to track this
                    llm_calls: this.state.metrics.events_processed, // Approximation
                    tool_calls: 0, // Would need to track this
                    avg_processing_time_ms: 0, // Would need to track this
                    error_count: this.state.metrics.errors,
                    success_rate: this.state.metrics.events_processed > 0
                        ? (this.state.metrics.events_processed - this.state.metrics.errors) / this.state.metrics.events_processed
                        : 1,
                },
                period: 'minute',
            },
            id: '',
            version: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        await this.rcrtClient.createBreadcrumb(metrics);
    }
    /**
     * Log error as breadcrumb
     */
    async logError(error, event) {
        await this.rcrtClient.createBreadcrumb({
            schema_name: 'agent.error.v1',
            title: `Error: ${this.agentDef.context.agent_id}`,
            tags: [`agent:${this.agentDef.context.agent_id}`, 'agent:error', this.workspace],
            context: {
                agent_id: this.agentDef.context.agent_id,
                error: String(error),
                stack: error.stack,
                event,
                timestamp: new Date().toISOString(),
            },
        });
    }
    /**
     * Get agent state
     */
    getState() {
        return { ...this.state };
    }
    /**
     * Get agent definition
     */
    getDefinition() {
        return this.agentDef;
    }
}
//# sourceMappingURL=agent-executor.js.map