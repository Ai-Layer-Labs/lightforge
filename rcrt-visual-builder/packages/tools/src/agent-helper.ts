/**
 * Agent Helper Tool
 * Provides system guidance and documentation to LLM-based agents
 */

import { RCRTTool, ToolExecutionContext } from './index.js';

export class AgentHelperTool implements RCRTTool {
  name = 'agent-helper';
  description = 'Provides system guidance, documentation, and examples for LLM-based agents';
  category = 'system';
  version = '1.0.0';

  get inputSchema() {
    return {
      type: 'object',
      properties: {
        query: { 
          type: 'string', 
          description: 'What do you need help with? (e.g., "how to use secrets", "create breadcrumbs", "search patterns")'
        },
        topic: {
          type: 'string',
          enum: ['breadcrumbs', 'tools', 'secrets', 'search', 'patterns', 'examples', 'overview'],
          description: 'Specific topic for focused guidance (optional)'
        },
        detail_level: {
          type: 'string',
          enum: ['quick', 'detailed', 'examples'],
          default: 'detailed',
          description: 'Level of detail in the response'
        }
      },
      required: ['query']
    };
  }

  get outputSchema() {
    return {
      type: 'object',
      properties: {
        guidance: {
          type: 'object',
          properties: {
            summary: { type: 'string', description: 'Quick summary of the guidance' },
            detailed_explanation: { type: 'string', description: 'Comprehensive explanation' },
            code_examples: { 
              type: 'array', 
              items: { 
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  code: { type: 'string' },
                  description: { type: 'string' }
                }
              }
            },
            related_documentation: {
              type: 'array',
              items: {
                type: 'object', 
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string' },
                  relevance: { type: 'string' }
                }
              }
            },
            next_steps: { type: 'array', items: { type: 'string' } }
          }
        }
      },
      required: ['guidance']
    };
  }

  async execute(input: any, context: ToolExecutionContext): Promise<any> {
    console.log(`🤖 Agent Helper responding to: "${input.query}"`);
    
    const query = input.query.toLowerCase();
    const topic = input.topic;
    const detailLevel = input.detail_level || 'detailed';
    
    try {
      // Search for relevant system documentation
      const systemDocs = await this.searchSystemDocs(query, context);
      
      // Search for relevant agent examples
      const examples = await this.searchAgentExamples(query, context);
      
      // Generate guidance based on query
      const guidance = await this.generateGuidance(query, topic, detailLevel, systemDocs, examples, context);
      
      return { guidance };
      
    } catch (error) {
      console.error('Agent Helper execution failed:', error);
      
      return {
        guidance: {
          summary: 'Error providing guidance',
          detailed_explanation: `I encountered an error while trying to help: ${error.message}`,
          code_examples: [],
          related_documentation: [],
          next_steps: [
            'Check the system documentation breadcrumbs manually',
            'Search for agent:definition breadcrumbs for examples',
            'Review the agent how-to documentation'
          ]
        }
      };
    }
  }

  // ============ PRIVATE METHODS ============

  private async searchSystemDocs(query: string, context: ToolExecutionContext): Promise<any[]> {
    try {
      const searchParams = new URLSearchParams({
        q: `${query} system documentation agent guide`,
        limit: '5'
      });
      
      const response = await fetch(`${context.rcrtClient.baseUrl}/breadcrumbs/search?${searchParams}`, {
        headers: { 'Authorization': `Bearer ${context.rcrtClient.token}` }
      });
      
      if (response.ok) {
        const results = await response.json();
        return results.filter((r: any) => 
          r.tags?.includes('system:documentation') || 
          r.tags?.includes('agent:howto')
        );
      }
      
      return [];
    } catch (error) {
      console.warn('Failed to search system docs:', error);
      return [];
    }
  }

  private async searchAgentExamples(query: string, context: ToolExecutionContext): Promise<any[]> {
    try {
      const searchParams = new URLSearchParams({
        q: `${query} agent definition example`,
        limit: '10'
      });
      
      const response = await fetch(`${context.rcrtClient.baseUrl}/breadcrumbs/search?${searchParams}`, {
        headers: { 'Authorization': `Bearer ${context.rcrtClient.token}` }
      });
      
      if (response.ok) {
        const results = await response.json();
        return results.filter((r: any) => 
          r.tags?.includes('agent:definition') && 
          r.schema_name === 'agent.definition.v1'
        );
      }
      
      return [];
    } catch (error) {
      console.warn('Failed to search agent examples:', error);
      return [];
    }
  }

  private async generateGuidance(
    query: string, 
    topic: string | undefined, 
    detailLevel: string,
    systemDocs: any[],
    examples: any[],
    context: ToolExecutionContext
  ): Promise<any> {
    
    const guidance: any = {
      summary: '',
      detailed_explanation: '',
      code_examples: [],
      related_documentation: systemDocs.map(doc => ({
        id: doc.id,
        title: doc.title,
        relevance: 'Contains system documentation and API reference'
      })),
      next_steps: []
    };

    // Generate guidance based on query keywords
    if (query.includes('secret') || query.includes('api key') || topic === 'secrets') {
      guidance.summary = 'How to access and use secrets in RCRT agents';
      guidance.detailed_explanation = `
Secrets in RCRT store encrypted credentials like API keys. Agents can access them securely using the getSecret function.

Key points:
- Secrets are encrypted at rest and require curator role to decrypt
- Always provide a reason when accessing secrets (for audit trail)
- Secrets can be scoped to global, workspace, or specific agents
- Tools are often pre-configured with secrets via tool.config.v1 breadcrumbs
      `;
      
      guidance.code_examples = [
        {
          title: 'Basic Secret Access',
          code: `const apiKey = await getSecret('MY_API_KEY', 'External API analysis task');`,
          description: 'Get a secret value with audit reason'
        },
        {
          title: 'Using Secret with Tool',
          code: `
const apiKey = await getSecret('MY_API_KEY');
await invokeTool('my-tool', {
  input: { data: 'Hello' },
  // Note: Most tools auto-configure secrets, manual key not needed
});`,
          description: 'Most tools automatically use configured secrets'
        }
      ];
      
      guidance.next_steps = [
        'Check existing secrets: search for breadcrumbs with tags ["secret", "tool:config"]',
        'Review tool configurations to see how secrets are mapped',
        'Use the secrets management UI on the dashboard for creating new secrets'
      ];
      
    } else if (query.includes('tool') || query.includes('invoke') || topic === 'tools') {
      guidance.summary = 'How to invoke tools and handle responses in RCRT agents';
      guidance.detailed_explanation = `
Tools are external services that extend agent capabilities. Invoke them using the invokeTool function.

All tools are defined as tool.code.v1 breadcrumbs and discovered dynamically from the tool catalog.

Tool execution is asynchronous - you create a tool.request.v1 breadcrumb and the tools-runner service executes it, creating a tool.response.v1 breadcrumb with results.
      `;
      
      guidance.code_examples = [
        {
          title: 'Basic Tool Invocation',
          code: `
const result = await invokeTool('calculator', { 
  expression: '2 + 2 * 3' 
});
console.log('Tool request created:', result.tool_request_id);`,
          description: 'Invoke calculator tool with expression'
        },
        {
          title: 'Generic Tool Usage',
          code: `
await invokeTool('my-tool', {
  input: {
    data: userQuery,
    options: { mode: 'advanced' }
  }
});`,
          description: 'Invoke any tool with structured input'
        }
      ];
      
      guidance.next_steps = [
        'Check tool catalog: search for breadcrumbs with tags ["tool:catalog"]',
        'Monitor tool responses: subscribe to tool:response breadcrumbs',
        'Review tool configurations: search for tool:config breadcrumbs'
      ];
      
    } else if (query.includes('breadcrumb') || query.includes('create') || topic === 'breadcrumbs') {
      guidance.summary = 'How to create effective breadcrumbs in RCRT';
      guidance.detailed_explanation = `
Breadcrumbs are the core data units in RCRT. They store semantic content with rich context, tags, and metadata.

Best practices:
- Use descriptive titles that explain the content
- Tag breadcrumbs for discoverability (workspace, type, purpose)
- Include rich context with structured data
- Use schema names for consistency (e.g., analysis.v1, response.v1)
- Reference related breadcrumbs by ID for connections
      `;
      
      guidance.code_examples = [
        {
          title: 'Basic Breadcrumb Creation',
          code: `
await createBreadcrumb({
  title: 'User Query Analysis',
  tags: ['analysis', 'user:query', 'workspace:agents'],
  context: {
    user_query: originalQuery,
    analysis: analysisResult,
    confidence: 0.85,
    sources: ['breadcrumb-id-1', 'breadcrumb-id-2']
  }
});`,
          description: 'Create analysis breadcrumb with rich context'
        },
        {
          title: 'Response Breadcrumb',
          code: `
await createBreadcrumb({
  title: 'Agent Response to User',
  tags: ['agent:response', 'user:answer'],
  context: {
    original_query_id: triggerBreadcrumb.id,
    response: generatedResponse,
    method: 'llm_analysis',
    timestamp: new Date().toISOString()
  }
});`,
          description: 'Create response with proper references'
        }
      ];
      
    } else if (query.includes('search') || topic === 'search') {
      guidance.summary = 'How to search and discover relevant breadcrumbs';
      guidance.detailed_explanation = `
Use semantic search to find relevant breadcrumbs and build on existing knowledge.

Search is semantic, not keyword-based - use natural language queries.
Combine query text with tag filters for precision.
Always search before creating to avoid duplicates.
      `;
      
      guidance.code_examples = [
        {
          title: 'Basic Search',
          code: `
const context = await searchBreadcrumbs('user preferences and settings', {
  tags: ['user:profile', 'user:settings'],
  limit: 5
});`,
          description: 'Search with semantic query and tag filters'
        },
        {
          title: 'Schema-Specific Search',
          code: `
const analyses = await searchBreadcrumbs('recent analysis results', {
  schema: 'analysis.v1',
  tags: ['workspace:agents'],
  limit: 10
});`,
          description: 'Find specific types of content'
        }
      ];
      
    } else {
      // General guidance
      guidance.summary = 'General RCRT system guidance for agents';
      guidance.detailed_explanation = `
RCRT is a semantic knowledge graph with real-time collaboration capabilities.

Core workflow for agents:
1. Search for relevant context using searchBreadcrumbs
2. Use tools for capabilities you don't have (LLM, calculation, web search)
3. Create structured responses with rich context and proper tags
4. Reference related breadcrumbs by ID to create visual connections
      `;
      
      guidance.code_examples = [
        {
          title: 'Complete Agent Pattern',
          code: `
// 1. Search for context
const context = await searchBreadcrumbs(userQuery, { limit: 5 });

// 2. Use external tool if needed
const toolResponse = await invokeTool('my-tool', {
  input: {
    context: JSON.stringify(context),
    query: userQuery
  }
});

// 3. Create structured response
await createBreadcrumb({
  title: 'Agent Response: ' + userQuery.substring(0, 50),
  tags: ['agent:response', 'user:answer'],
  context: {
    user_query: userQuery,
    tool_response: toolResponse,
    context_used: context.map(c => c.id),
    confidence: 0.9,
    method: 'context_aware_tool'
  }
});`,
          description: 'Complete pattern for responding to user queries'
        }
      ];
      
      guidance.next_steps = [
        'Search for system documentation: searchBreadcrumbs("agent system guide")',
        'Explore agent definitions: search for agent:definition breadcrumbs',
        'Check available tools: search for tool:catalog breadcrumbs',
        'Review examples: look at existing agent:response breadcrumbs'
      ];
    }

    // Add related documentation
    if (systemDocs.length > 0) {
      guidance.related_documentation = systemDocs.map(doc => ({
        id: doc.id,
        title: doc.title,
        relevance: 'System documentation with comprehensive API reference'
      }));
    }

    // Add example agents if found
    if (examples.length > 0) {
      guidance.example_agents = examples.map(ex => ({
        id: ex.id,
        name: ex.context?.agent_name || ex.title,
        category: ex.context?.category || 'unknown',
        description: ex.context?.description || 'No description'
      }));
    }

    return guidance;
  }

  private async searchSystemDocs(query: string, context: ToolExecutionContext): Promise<any[]> {
    try {
      const searchParams = new URLSearchParams({
        q: `${query} system documentation agent guide`,
        limit: '5'
      });
      
      const response = await fetch(`${context.rcrtClient.baseUrl}/breadcrumbs/search?${searchParams}`, {
        headers: { 'Authorization': `Bearer ${context.rcrtClient.token}` }
      });
      
      if (response.ok) {
        const results = await response.json();
        return results.filter((r: any) => 
          r.tags?.includes('system:documentation') || 
          r.tags?.includes('agent:howto')
        );
      }
      
      return [];
    } catch (error) {
      console.warn('Failed to search system docs:', error);
      return [];
    }
  }

  private async searchAgentExamples(query: string, context: ToolExecutionContext): Promise<any[]> {
    try {
      const searchParams = new URLSearchParams({
        q: `${query} agent definition example`,
        limit: '10'
      });
      
      const response = await fetch(`${context.rcrtClient.baseUrl}/breadcrumbs/search?${searchParams}`, {
        headers: { 'Authorization': `Bearer ${context.rcrtClient.token}` }
      });
      
      if (response.ok) {
        const results = await response.json();
        return results.filter((r: any) => 
          r.tags?.includes('agent:definition') && 
          r.schema_name === 'agent.definition.v1'
        );
      }
      
      return [];
    } catch (error) {
      console.warn('Failed to search agent examples:', error);
      return [];
    }
  }
}
