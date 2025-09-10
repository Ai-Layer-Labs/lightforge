/**
 * LangChain Tool Bridge for RCRT
 * Wraps LangChain tools to work with RCRT breadcrumb system
 */

import { RCRTTool, ToolExecutionContext, RCRTToolWrapper } from './index.js';
import { RcrtClientEnhanced } from '@rcrt-builder/sdk';

// LangChain tool interface (simplified)
interface LangChainTool {
  name: string;
  description: string;
  call(input: string, callbacks?: any): Promise<string>;
}

// Bridge class to wrap LangChain tools
export class LangChainToolBridge implements RCRTTool {
  public readonly name: string;
  public readonly description: string;
  public readonly category: string;
  public readonly version: string;

  constructor(
    private langchainTool: LangChainTool,
    options: {
      category?: string;
      version?: string;
      inputTransform?: (input: any) => string;
      outputTransform?: (output: string) => any;
    } = {}
  ) {
    this.name = langchainTool.name;
    this.description = langchainTool.description;
    this.category = options.category || 'langchain';
    this.version = options.version || '1.0.0';
  }

  get inputSchema() {
    return {
      type: "object",
      properties: {
        input: { 
          type: "string", 
          description: this.description 
        },
        parameters: {
          type: "object",
          description: "Additional parameters for the tool",
          additionalProperties: true
        }
      },
      required: ["input"]
    };
  }

  get outputSchema() {
    return {
      type: "object",
      properties: {
        result: { 
          type: "string",
          description: "Tool execution result"
        },
        metadata: {
          type: "object",
          description: "Additional result metadata"
        }
      },
      required: ["result"]
    };
  }

  validateInput(input: any): boolean | string {
    if (!input || typeof input !== 'object') {
      return 'Input must be an object';
    }
    if (!input.input || typeof input.input !== 'string') {
      return 'Input must contain a string "input" field';
    }
    return true;
  }

  async execute(input: any, context?: ToolExecutionContext): Promise<any> {
    const toolInput = input.input || input;
    
    try {
      const result = await this.langchainTool.call(toolInput);
      
      return {
        result,
        metadata: {
          tool: this.name,
          executedAt: new Date().toISOString(),
          context: context?.metadata
        }
      };
    } catch (error: any) {
      throw new Error(`LangChain tool execution failed: ${error.message}`);
    }
  }
}

// Factory function to create common LangChain tool bridges
export function createLangChainBridge(
  langchainTool: LangChainTool,
  options?: {
    category?: string;
    version?: string;
  }
): RCRTTool {
  return new LangChainToolBridge(langchainTool, options);
}

// Pre-configured bridges for common LangChain tools
export const langchainBridges = {
  braveSearch: () => ({
    name: 'brave_search',
    description: 'Search the web using Brave Search API',
    category: 'search',
    requiredSecrets: ['BRAVE_SEARCH_API_KEY'],
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        count: { type: 'number', description: 'Number of results', default: 5 },
        country: { type: 'string', description: 'Country code (optional)' }
      },
      required: ['query']
    },
    outputSchema: {
      type: 'object',
      properties: {
        results: { type: 'array', items: { type: 'object' } },
        metadata: { type: 'object' }
      }
    },
    async execute(input: any, context?: ToolExecutionContext) {
      const client = context?.rcrtClient;
      if (!client) throw new Error('Missing RCRT client in tool context');
      // Resolve key strictly from RCRT Secrets
      const secrets = await client.listSecrets();
      const sec = secrets.find((s: any) => String(s?.name || '').toLowerCase() === 'brave_search_api_key');
      if (!sec) throw new Error('BRAVE_SEARCH_API_KEY secret not found');
      const { value: apiKey } = await client.getSecret(sec.id, 'tools:brave_search');
      if (!apiKey) throw new Error('BRAVE_SEARCH_API_KEY is empty');

      const params = new URLSearchParams();
      params.set('q', input.query);
      const count = typeof input.count === 'number' ? input.count : 5;
      params.set('count', String(count));
      if (input.country) params.set('country', String(input.country));

      const resp = await fetch(`https://api.search.brave.com/res/v1/web/search?${params.toString()}`, {
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': apiKey
        }
      });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new Error(`Brave API error ${resp.status}: ${txt}`);
      }
      const json = await resp.json();
      const results = Array.isArray(json?.web?.results) ? json.web.results.map((r: any) => ({
        title: r.title,
        url: r.url,
        description: r.description
      })) : [];
      return { results, metadata: { query: input.query, count } };
    }
  } as RCRTTool),
  // Web search tools
  serpAPI: (apiKey: string) => {
    if (typeof window !== 'undefined') {
      throw new Error('SerpAPI requires server environment');
    }
    
    return {
      name: 'serpapi',
      description: 'Search the web using SerpAPI',
      category: 'search',
      requiredSecrets: ['SERPAPI_API_KEY'],
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          location: { type: "string", description: "Search location", default: "United States" }
        },
        required: ["query"]
      },
      outputSchema: {
        type: "object",
        properties: {
          results: { type: "array", description: "Search results" },
          metadata: { type: "object" }
        }
      },
      async execute(input: any) {
        // Dynamic import to avoid bundling in browser
        try {
          const langchainTools = await import('langchain/tools');
          const SerpAPIClass = (langchainTools as any).SerpAPI;
          if (SerpAPIClass) {
            const tool = new SerpAPIClass(apiKey);
            const result = await tool.call(input.query);
            return {
              results: JSON.parse(result),
              metadata: { query: input.query, location: input.location }
            };
          }
        } catch (error: any) {
          // Ignore import errors
        }
        
        // Fallback if SerpAPI not available
        return {
          results: [{
            title: `Search results for: ${input.query}`,
            snippet: 'SerpAPI not available - this is a mock result',
            link: 'https://example.com'
          }],
          metadata: { query: input.query, mock: true }
        };
      }
    } as RCRTTool;
  },

  // Calculator
  calculator: () => ({
    name: 'calculator',
    description: 'Perform mathematical calculations',
    category: 'math',
    inputSchema: {
      type: "object",
      properties: {
        expression: { type: "string", description: "Mathematical expression to evaluate" }
      },
      required: ["expression"]
    },
    outputSchema: {
      type: "object",
      properties: {
        result: { type: "number" },
        expression: { type: "string" }
      }
    },
    async execute(input: any) {
      try {
        const langchainTools = await import('langchain/tools');
        const CalculatorClass = (langchainTools as any).Calculator;
        if (CalculatorClass) {
          const tool = new CalculatorClass();
          const result = await tool.call(input.expression);
          return {
            result: parseFloat(result),
            expression: input.expression
          };
        }
      } catch (error: any) {
        // Ignore import errors
      }
      
      // Fallback calculator using eval (unsafe but works for demo)
      try {
        const result = Function('"use strict"; return (' + input.expression + ')')();
        return {
          result: parseFloat(result),
          expression: input.expression
        };
      } catch {
        throw new Error(`Invalid mathematical expression: ${input.expression}`);
      }
    }
  } as RCRTTool),

  // Web browser/scraper
  webBrowser: () => ({
    name: 'web_browser',
    description: 'Browse and extract content from web pages',
    category: 'web',
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to browse" },
        selector: { type: "string", description: "CSS selector for content extraction" }
      },
      required: ["url"]
    },
    outputSchema: {
      type: "object",
      properties: {
        content: { type: "string" },
        title: { type: "string" },
        url: { type: "string" }
      }
    },
    async execute(input: any) {
      // Simplified web browsing - in production, use proper scraping
      const response = await fetch(input.url);
      const html = await response.text();
      
      // Basic title extraction
      const titleMatch = html.match(/<title>(.*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1] : 'Untitled';
      
      // Basic content extraction (would use proper parsing in production)
      const content = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                          .replace(/<[^>]*>/g, ' ')
                          .replace(/\s+/g, ' ')
                          .trim()
                          .substring(0, 2000);
      
      return {
        content,
        title,
        url: input.url
      };
    }
  } as RCRTTool)
};

// Helper to register all available LangChain tools
export async function registerAllLangChainTools(
  client: RcrtClientEnhanced,
  workspace: string,
  config: {
    serpApiKey?: string;
    enableUI?: boolean;
  } = {}
): Promise<RCRTToolWrapper[]> {
  const wrappers: RCRTToolWrapper[] = [];

  // Register SerpAPI if key provided
  if (config.serpApiKey) {
    const serpTool = langchainBridges.serpAPI(config.serpApiKey);
    const wrapper = new RCRTToolWrapper(serpTool, client, workspace, { enableUI: config.enableUI });
    await wrapper.start();
    wrappers.push(wrapper);
  }

  // Register calculator
  const calcTool = langchainBridges.calculator();
  const calcWrapper = new RCRTToolWrapper(calcTool, client, workspace, { enableUI: config.enableUI });
  await calcWrapper.start();
  wrappers.push(calcWrapper);

  // Register web browser
  const browserTool = langchainBridges.webBrowser();
  const browserWrapper = new RCRTToolWrapper(browserTool, client, workspace, { enableUI: config.enableUI });
  await browserWrapper.start();
  wrappers.push(browserWrapper);

  console.log(`Registered ${wrappers.length} LangChain tools for workspace: ${workspace}`);
  
  return wrappers;
}
