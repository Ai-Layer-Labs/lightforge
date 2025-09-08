/**
 * Langfuse Trace Node
 * Track and monitor LLM interactions with Langfuse
 */

import { BaseNode, RegisterNode, NodeExecutionResult } from '@rcrt-builder/node-sdk';
import { Langfuse } from 'langfuse';

@RegisterNode({
  schema_name: "node.template.v1",
  title: "Langfuse Trace Node",
  tags: ["node:template", "observability", "langfuse"],
  context: {
    node_type: "LangfuseNode",
    category: "observability",
    icon: "📊",
    color: "#8b5cf6",
    description: "Track LLM interactions with Langfuse"
  }
})
export class LangfuseNode extends BaseNode {
  private langfuse: Langfuse | null = null;
  private currentTrace: any = null;
  private currentSpan: any = null;
  
  getMetadata() {
    return {
      type: 'LangfuseNode',
      category: 'observability',
      icon: '📊',
      inputs: [
        { id: 'trace_data', type: 'data', schema: 'trace.data.v1' },
        { id: 'metadata', type: 'data', schema: 'trace.metadata.v1', optional: true },
        { id: 'credentials', type: 'data', schema: 'secrets.credentials.v1', optional: true }
      ],
      outputs: [
        { id: 'trace_id', type: 'data' },
        { id: 'passthrough', type: 'data' },
        { id: 'trace_url', type: 'data' }
      ]
    };
  }
  
  validateConfig(config: any): boolean {
    // Credentials can come from config or input
    return true;
  }
  
  async execute(inputs: Record<string, any>): Promise<NodeExecutionResult> {
    const { trace_data, metadata = {}, credentials } = inputs;
    
    if (!trace_data) {
      return {
        outputs: {
          trace_id: null,
          passthrough: trace_data,
          trace_url: null
        }
      };
    }
    
    try {
      // Initialize Langfuse client
      await this.ensureLangfuseClient(credentials);
      
      if (!this.langfuse) {
        throw new Error('Failed to initialize Langfuse client');
      }
      
      // Determine trace type and create appropriate trace
      const traceType = metadata.type || this.detectTraceType(trace_data);
      let traceId: string;
      let traceUrl: string;
      
      switch (traceType) {
        case 'llm':
          const result = await this.traceLLMInteraction(trace_data, metadata);
          traceId = result.traceId;
          traceUrl = result.traceUrl;
          break;
          
        case 'agent':
          const agentResult = await this.traceAgentExecution(trace_data, metadata);
          traceId = agentResult.traceId;
          traceUrl = agentResult.traceUrl;
          break;
          
        case 'flow':
          const flowResult = await this.traceFlowExecution(trace_data, metadata);
          traceId = flowResult.traceId;
          traceUrl = flowResult.traceUrl;
          break;
          
        default:
          const genericResult = await this.traceGeneric(trace_data, metadata);
          traceId = genericResult.traceId;
          traceUrl = genericResult.traceUrl;
      }
      
      // Store trace reference in RCRT
      await this.createBreadcrumb({
        schema_name: 'trace.reference.v1',
        title: `Trace: ${metadata.name || traceType}`,
        tags: ['trace:langfuse', this.context.workspace],
        context: {
          trace_id: traceId,
          trace_url: traceUrl,
          trace_type: traceType,
          node_id: this.context.breadcrumb_id,
          timestamp: new Date().toISOString()
        }
      });
      
      return {
        outputs: {
          trace_id: traceId,
          passthrough: trace_data,
          trace_url: traceUrl
        }
      };
    } catch (error: any) {
      // Log error
      await this.createBreadcrumb({
        schema_name: 'observability.error.v1',
        title: 'Trace Failed',
        tags: ['observability:error', 'langfuse', this.context.workspace],
        context: {
          error: error.message,
          node_id: this.context.breadcrumb_id,
          timestamp: new Date().toISOString()
        }
      });
      
      return {
        outputs: {
          trace_id: null,
          passthrough: trace_data,
          trace_url: null
        }
      };
    }
  }
  
  private async ensureLangfuseClient(credentials?: any) {
    if (this.langfuse) return;
    
    // Get credentials
    const publicKey = credentials?.LANGFUSE_PUBLIC_KEY || 
                     credentials?.langfuse_public_key ||
                     this.context.config.public_key;
                     
    const secretKey = credentials?.LANGFUSE_SECRET_KEY || 
                     credentials?.langfuse_secret_key ||
                     this.context.config.secret_key;
                     
    const baseUrl = credentials?.LANGFUSE_BASE_URL || 
                   credentials?.langfuse_base_url ||
                   this.context.config.base_url ||
                   'https://cloud.langfuse.com';
    
    if (!publicKey || !secretKey) {
      throw new Error('Langfuse credentials not provided');
    }
    
    // Initialize client
    this.langfuse = new Langfuse({
      publicKey,
      secretKey,
      baseUrl,
      release: this.context.config.release || process.env.LANGFUSE_RELEASE,
      requestTimeout: this.context.config.request_timeout || 10000,
      flushAt: this.context.config.flush_at || 1,
      flushInterval: this.context.config.flush_interval || 0
    });
  }
  
  private detectTraceType(data: any): string {
    if (data.messages && Array.isArray(data.messages)) return 'llm';
    if (data.agent_id || data.agent) return 'agent';
    if (data.flow_id || data.nodes) return 'flow';
    return 'generic';
  }
  
  private async traceLLMInteraction(data: any, metadata: any) {
    const trace = this.langfuse!.trace({
      name: metadata.name || 'LLM Interaction',
      metadata: {
        ...metadata,
        workspace: this.context.workspace,
        node_id: this.context.breadcrumb_id
      },
      input: data.input || data.messages,
      output: data.output || data.response,
      sessionId: metadata.session_id,
      userId: metadata.user_id,
      tags: metadata.tags || ['llm']
    });
    
    // Create generation if we have model info
    if (data.model) {
      const generation = trace.generation({
        name: metadata.generation_name || 'LLM Generation',
        model: data.model,
        input: data.messages || data.input,
        output: data.response || data.output,
        usage: data.usage,
        metadata: {
          temperature: data.temperature,
          max_tokens: data.max_tokens,
          ...data.metadata
        },
        completionStartTime: data.start_time ? new Date(data.start_time) : undefined,
        endTime: data.end_time ? new Date(data.end_time) : undefined
      });
      
      await generation.flush();
    }
    
    await trace.flush();
    
    return {
      traceId: trace.id,
      traceUrl: `${this.langfuse!.baseUrl}/trace/${trace.id}`
    };
  }
  
  private async traceAgentExecution(data: any, metadata: any) {
    const trace = this.langfuse!.trace({
      name: metadata.name || `Agent: ${data.agent_id || 'Unknown'}`,
      metadata: {
        ...metadata,
        agent_id: data.agent_id,
        workspace: this.context.workspace,
        node_id: this.context.breadcrumb_id
      },
      input: data.trigger || data.input,
      output: data.result || data.output,
      sessionId: metadata.session_id || data.session_id,
      userId: metadata.user_id || data.user_id,
      tags: ['agent', ...(metadata.tags || [])]
    });
    
    // Create spans for agent steps if available
    if (data.steps && Array.isArray(data.steps)) {
      for (const step of data.steps) {
        const span = trace.span({
          name: step.name || step.type || 'Agent Step',
          input: step.input,
          output: step.output,
          metadata: step.metadata,
          startTime: step.start_time ? new Date(step.start_time) : undefined,
          endTime: step.end_time ? new Date(step.end_time) : undefined
        });
        
        await span.flush();
      }
    }
    
    await trace.flush();
    
    return {
      traceId: trace.id,
      traceUrl: `${this.langfuse!.baseUrl}/trace/${trace.id}`
    };
  }
  
  private async traceFlowExecution(data: any, metadata: any) {
    const trace = this.langfuse!.trace({
      name: metadata.name || `Flow: ${data.flow_id || 'Unknown'}`,
      metadata: {
        ...metadata,
        flow_id: data.flow_id,
        workspace: this.context.workspace,
        node_id: this.context.breadcrumb_id,
        node_count: data.nodes?.length || 0
      },
      input: data.input || data.trigger,
      output: data.output || data.result,
      sessionId: metadata.session_id,
      userId: metadata.user_id,
      tags: ['flow', ...(metadata.tags || [])]
    });
    
    // Create spans for each node execution if available
    if (data.node_executions && Array.isArray(data.node_executions)) {
      for (const execution of data.node_executions) {
        const span = trace.span({
          name: `Node: ${execution.node_id || execution.node_type}`,
          input: execution.input,
          output: execution.output,
          metadata: {
            node_type: execution.node_type,
            node_id: execution.node_id,
            ...execution.metadata
          },
          startTime: execution.start_time ? new Date(execution.start_time) : undefined,
          endTime: execution.end_time ? new Date(execution.end_time) : undefined
        });
        
        await span.flush();
      }
    }
    
    await trace.flush();
    
    return {
      traceId: trace.id,
      traceUrl: `${this.langfuse!.baseUrl}/trace/${trace.id}`
    };
  }
  
  private async traceGeneric(data: any, metadata: any) {
    const trace = this.langfuse!.trace({
      name: metadata.name || 'Generic Trace',
      metadata: {
        ...metadata,
        workspace: this.context.workspace,
        node_id: this.context.breadcrumb_id
      },
      input: data.input || data,
      output: data.output,
      sessionId: metadata.session_id,
      userId: metadata.user_id,
      tags: metadata.tags || ['generic']
    });
    
    await trace.flush();
    
    return {
      traceId: trace.id,
      traceUrl: `${this.langfuse!.baseUrl}/trace/${trace.id}`
    };
  }
  
  async destroy() {
    // Flush any pending traces
    if (this.langfuse) {
      await this.langfuse.flush();
      await this.langfuse.shutdown();
      this.langfuse = null;
    }
    
    // Log cleanup
    await this.createBreadcrumb({
      schema_name: 'observability.cleanup.v1',
      title: 'Langfuse Node Shutdown',
      tags: ['observability:cleanup', 'langfuse', this.context.workspace],
      context: {
        node_id: this.context.breadcrumb_id,
        timestamp: new Date().toISOString()
      }
    });
  }
}
