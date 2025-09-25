/**
 * Tool Registry - Discovery, management, and orchestration of RCRT tools
 */

import { RcrtClientEnhanced } from '@rcrt-builder/sdk';
import { RCRTTool, RCRTToolWrapper } from './index.js';

export interface ToolCatalogEntry {
  name: string;
  description: string;
  category: string;
  version: string;
  inputSchema: any;
  outputSchema: any;
  capabilities: {
    async: boolean;
    timeout: number;
    retries: number;
  };
  status: 'active' | 'inactive' | 'error';
  lastSeen?: string;
}

export class ToolRegistry {
  private tools = new Map<string, RCRTToolWrapper>();
  private catalog: ToolCatalogEntry[] = [];
  private catalogBreadcrumbId?: string; // Track the single catalog breadcrumb

  constructor(
    private client: RcrtClientEnhanced,
    private workspace: string,
    private options: {
      enableUI?: boolean;
      catalogUpdateInterval?: number;
      healthCheckInterval?: number;
      applyClient?: RcrtClientEnhanced;
    } = {}
  ) {}

  async start(): Promise<void> {
    console.log(`[ToolRegistry] Starting for workspace: ${this.workspace}`);
    
    // Find existing catalog or create new one
    await this.initializeCatalog();
    
    // Set up periodic catalog updates
    if (this.options.catalogUpdateInterval) {
      setInterval(() => this.updateCatalog(), this.options.catalogUpdateInterval);
    }
    
    // Set up health checks
    if (this.options.healthCheckInterval) {
      setInterval(() => this.performHealthCheck(), this.options.healthCheckInterval);
    }
  }

  // Ensure required secrets exist in RCRT, optionally creating from env as fallback.
  // Returns a map of secret name -> decrypted value (undefined if missing).
  async ensureSecrets(names: string[], options?: { scope_type?: string; scope_id?: string; toolName?: string }): Promise<Record<string, string | undefined>> {
    const resolved: Record<string, string | undefined> = {};
    try {
      const existing = await this.client.listSecrets(options?.scope_type, options?.scope_id);
      for (const name of names) {
        const match = existing.find((s: any) => String(s?.name || '').toLowerCase() === name.toLowerCase());
        if (match) {
          try {
            const dec = await this.client.getSecret(match.id, `ToolRegistry:ensureSecrets:${options?.toolName || 'generic'}`);
            resolved[name] = dec?.value;
            continue;
          } catch (e) {
            console.warn(`[ToolRegistry] Failed to decrypt secret ${name}:`, e);
          }
        }

        // Still missing: emit a config request breadcrumb
        try {
          await this.client.createBreadcrumb({
            schema_name: 'tool.config.request.v1',
            title: `Missing secret: ${name}`,
            tags: [this.workspace, 'tool:config', 'tool:config:request', ...(options?.toolName ? [`tool:${options.toolName}`] : [])],
            context: {
              tool: options?.toolName,
              missing: [name],
              instructions: `Create secret '${name}' via /secrets (scope_type optional). The tools runner will pick it up automatically.`,
            }
          });
        } catch (e) {
          console.warn(`[ToolRegistry] Failed to emit config request for ${name}:`, e);
        }

        resolved[name] = undefined;
      }
    } catch (error) {
      console.error('[ToolRegistry] ensureSecrets error:', error);
      for (const name of names) resolved[name] = undefined;
    }
    return resolved;
  }

  async register(tool: RCRTTool): Promise<RCRTToolWrapper> {
    console.log(`[ToolRegistry] Registering tool: ${tool.name}`);
    
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool ${tool.name} is already registered`);
    }
    
    // Skip registration if tool already exists in loaded catalog
    const existingTool = this.catalog.find(entry => entry.name === tool.name);
    if (existingTool) {
      console.log(`[ToolRegistry] ⏭️  Skipping ${tool.name} - already exists in loaded catalog`);
      
      // If we have a wrapper for this tool, return it; otherwise, this is a new session
      // and we'll need to create the wrapper but not add to catalog again
      if (this.tools.has(tool.name)) {
        return this.tools.get(tool.name)!;
      } else {
        // Create wrapper but don't add to catalog (it's already there)
        const wrapper = new RCRTToolWrapper(
          tool, 
          this.client, 
          this.workspace, 
          { enableUI: this.options.enableUI, applyClient: this.options.applyClient }
        );
        await wrapper.start();
        this.tools.set(tool.name, wrapper);
        
        // Update the existing catalog entry status
        existingTool.status = 'active';
        existingTool.lastSeen = new Date().toISOString();
        
        console.log(`[ToolRegistry] ✅ Restored ${tool.name} from catalog (no catalog update needed)`);
        return wrapper;
      }
    }

    // Ensure required secrets for this tool
    if (Array.isArray(tool.requiredSecrets) && tool.requiredSecrets.length > 0) {
      const resolved = await this.ensureSecrets(tool.requiredSecrets, { toolName: tool.name });
      const missing = tool.requiredSecrets.filter(n => !resolved[n]);
      if (missing.length > 0) {
        console.warn(`[ToolRegistry] Tool ${tool.name} missing secrets: ${missing.join(', ')}`);
      }
    }

    const wrapper = new RCRTToolWrapper(
      tool, 
      this.client, 
      this.workspace, 
      { enableUI: this.options.enableUI, applyClient: this.options.applyClient }
    );
    
    await wrapper.start();
    this.tools.set(tool.name, wrapper);
    
    // Update catalog
    this.catalog.push({
      name: tool.name,
      description: tool.description,
      category: tool.category || 'general',
      version: tool.version || '1.0.0',
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
      capabilities: {
        async: true,
        timeout: 30000,
        retries: 0
      },
      status: 'active',
      lastSeen: new Date().toISOString()
    });
    
    console.log(`[ToolRegistry] DEBUG: About to update catalog. Current catalog length: ${this.catalog.length}`);
    console.log(`[ToolRegistry] DEBUG: Tools in catalog:`, this.catalog.map(t => ({ name: t.name, status: t.status })));
    
    await this.updateCatalog();
    
    console.log(`[ToolRegistry] DEBUG: Catalog update completed. Catalog length: ${this.catalog.length}`);
    return wrapper;
  }

  async unregister(toolName: string): Promise<void> {
    console.log(`[ToolRegistry] Unregistering tool: ${toolName}`);
    
    const wrapper = this.tools.get(toolName);
    if (wrapper) {
      await wrapper.stop();
      this.tools.delete(toolName);
    }
    
    this.catalog = this.catalog.filter(entry => entry.name !== toolName);
    await this.updateCatalog();
  }

  async registerLangChainTools(config: {
    serpApiKey?: string;
    openaiApiKey?: string;
    enableCalculator?: boolean;
    enableWebBrowser?: boolean;
    enableLLMTools?: boolean; // 🆕 NEW: Enable LLM tools
  } = {}): Promise<void> {
    const { registerAllToolsWithLLM } = await import('./langchain.js');
    
    try {
      // Ensure required secrets for LangChain set
      let serpKey = config.serpApiKey;
      if (!serpKey) {
        const sec = await this.ensureSecrets(['SERPAPI_API_KEY'], { toolName: 'serpapi' });
        serpKey = sec.SERPAPI_API_KEY;
        if (!serpKey) {
          console.warn('[ToolRegistry] SERPAPI_API_KEY missing; SerpAPI tool will be skipped until provisioned.');
        }
      }

      // Use enhanced registration that includes LLM tools
      const wrappers = await registerAllToolsWithLLM(this.client, this.workspace, {
        serpApiKey: serpKey,
        enableUI: this.options.enableUI,
        enableLLMTools: config.enableLLMTools !== false // Default to enabled
      });
      
      // Add to our registry AND catalog (with duplicate check)
      for (const wrapper of wrappers) {
        const toolName = (wrapper as any).tool?.name;
        const tool = (wrapper as any).tool;
        if (toolName && tool) {
          // Check if tool already exists in loaded catalog
          const existingTool = this.catalog.find(entry => entry.name === tool.name);
          if (existingTool) {
            console.log(`[ToolRegistry] ⏭️  Skipping ${tool.name} - already exists in loaded catalog`);
            
            // Just add to runtime registry and update status
            this.tools.set(toolName, wrapper);
            existingTool.status = 'active';
            existingTool.lastSeen = new Date().toISOString();
          } else {
            // Add to both runtime registry and catalog  
            this.tools.set(toolName, wrapper);
            this.catalog.push({
              name: tool.name,
              description: tool.description || `${tool.category || 'Tool'}: ${tool.name}`,
              category: tool.category || 'general',
              version: tool.version || '1.0.0',
              inputSchema: tool.inputSchema,
              outputSchema: tool.outputSchema,
              capabilities: {
                async: true,
                timeout: 30000,
                retries: 0
              },
              status: 'active',
              lastSeen: new Date().toISOString()
            });
            console.log(`[ToolRegistry] ✅ Added new ${tool.category || 'tool'} tool ${tool.name} to catalog`);
          }
        }
      }

      console.log(`[ToolRegistry] Registered ${wrappers.length} tools (LangChain + LLM)`);
      console.log(`[ToolRegistry] DEBUG: Total catalog now has ${this.catalog.length} tools`);
      await this.updateCatalog();
      
    } catch (error) {
      console.error('[ToolRegistry] Failed to register tools:', error);
    }
  }

  async registerBuiltinTools(): Promise<void> {
    const { builtinTools } = await import('./index.js');
    
    for (const [name, tool] of Object.entries(builtinTools)) {
      try {
        await this.register(tool);
      } catch (error) {
        console.error(`[ToolRegistry] Failed to register builtin tool ${name}:`, error);
      }
    }
  }

  private async initializeCatalog(): Promise<void> {
    try {
      console.log(`[ToolRegistry] DEBUG: Searching for existing catalogs in ${this.workspace}...`);
      
      // Use the correct SDK method - searchBreadcrumbs
      const allWorkspaceBreadcrumbs = await this.client.searchBreadcrumbs({
        tag: this.workspace
      });
      
      console.log(`[ToolRegistry] DEBUG: Found ${allWorkspaceBreadcrumbs.length} total breadcrumbs in ${this.workspace}`);
      console.log(`[ToolRegistry] DEBUG: Sample breadcrumbs:`, allWorkspaceBreadcrumbs.slice(0, 3).map(b => ({ 
        id: b.id, 
        title: b.title, 
        schema_name: b.schema_name,
        tags: b.tags 
      })));
      
      // Dead simple filter - just look for "tool:catalog" tag  
      const existingCatalogs = allWorkspaceBreadcrumbs.filter(b => 
        b.tags.includes('tool:catalog')
      );
      
      console.log(`[ToolRegistry] Found ${existingCatalogs.length} existing catalog(s) for ${this.workspace}`);
      
      if (existingCatalogs.length > 0) {
        console.log(`[ToolRegistry] DEBUG: Existing catalogs:`, existingCatalogs.map(c => ({
          id: c.id,
          title: c.title,
          version: c.version,
          updated_at: c.updated_at
        })));
      }
      
      if (existingCatalogs.length > 0) {
        // Sort by most recent  
        const sortedCatalogs = existingCatalogs.sort((a, b) => 
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
        
        // Use the most recent catalog
        const latest = sortedCatalogs[0];
        this.catalogBreadcrumbId = latest.id;
        console.log(`[ToolRegistry] Using latest catalog: ${this.catalogBreadcrumbId} (v${latest.version})`);
        
        // If multiple catalogs found, this indicates a problem - log it but don't auto-delete
        if (existingCatalogs.length > 1) {
          console.error(`[ToolRegistry] PROBLEM: Found ${existingCatalogs.length} catalog duplicates! This indicates the single catalog implementation has a bug.`);
          console.error(`[ToolRegistry] Duplicate catalogs:`, existingCatalogs.map(c => ({ id: c.id, version: c.version, updated_at: c.updated_at })));
          console.error(`[ToolRegistry] Using most recent catalog but this needs investigation.`);
        }
        
        // Load existing tools from catalog
        try {
          console.log(`[ToolRegistry] DEBUG: Loading full catalog from ID: ${this.catalogBreadcrumbId}`);
          const fullCatalog = await this.client.getBreadcrumb(this.catalogBreadcrumbId);
          
          console.log(`[ToolRegistry] DEBUG: Full catalog loaded:`, {
            id: fullCatalog.id,
            title: fullCatalog.title,
            context_exists: !!fullCatalog.context,
            context_tools_exists: !!fullCatalog.context?.tools,
            context_tools_length: fullCatalog.context?.tools?.length || 0,
            context_sample: fullCatalog.context ? Object.keys(fullCatalog.context) : []
          });
          
          if (fullCatalog.context?.tools) {
            this.catalog = fullCatalog.context.tools;
            console.log(`[ToolRegistry] ✅ Loaded ${this.catalog.length} tools from existing catalog`);
          } else {
            console.warn(`[ToolRegistry] ❌ Catalog has no tools array - context.tools is missing or empty`);
            console.warn(`[ToolRegistry] Catalog context:`, fullCatalog.context);
            this.catalog = [];
          }
        } catch (error) {
          console.error(`[ToolRegistry] ❌ Failed to load catalog contents:`, error);
          this.catalog = [];
        }
      } else {
        // Create initial empty catalog
        await this.createCatalogBreadcrumb();
      }
    } catch (error) {
      console.error('[ToolRegistry] Failed to initialize catalog:', error);
      // Create fresh catalog on error
      await this.createCatalogBreadcrumb();
    }
  }

  private async createCatalogBreadcrumb(): Promise<void> {
    try {
      // Add llm_hints for context transformation
      const llmHints = {
        transform: {
          tool_summary: {
            type: 'template',
            template: '{{context.activeTools}} tools available:\n{{#each context.tools}}- {{this.name}} ({{this.category}}): {{this.description}}\n{{/each}}\n\nTo use a tool, create a tool.request.v1 breadcrumb with:\n- tool: the tool name\n- input: parameters matching the inputSchema\n- requestId: unique identifier'
          },
          available_tools: {
            type: 'extract',
            value: '$.tools[*].name'
          },
          categories: {
            type: 'template',
            template: '{{#each context.tools}}{{#unless @first}}, {{/unless}}{{this.category}}{{/each}}'
          }
        },
        mode: 'replace'
      };

      const catalogBreadcrumb = await this.client.createBreadcrumb({
        schema_name: 'tool.catalog.v1',
        title: `${this.workspace} Tool Catalog`,
        tags: [this.workspace, 'tool:catalog'],
        context: {
          workspace: this.workspace,
          tools: this.catalog,
          totalTools: this.catalog.length,
          activeTools: this.catalog.filter(t => t.status === 'active').length,
          lastUpdated: new Date().toISOString(),
          llm_hints: llmHints
        }
      });
      
      this.catalogBreadcrumbId = catalogBreadcrumb.id;
      console.log(`[ToolRegistry] Created new catalog breadcrumb: ${this.catalogBreadcrumbId}`);
    } catch (error) {
      console.error('[ToolRegistry] Failed to create catalog breadcrumb:', error);
    }
  }

  private async updateCatalog(): Promise<void> {
    if (!this.catalogBreadcrumbId) {
      console.warn('[ToolRegistry] No catalog breadcrumb ID, creating new catalog');
      await this.createCatalogBreadcrumb();
      return;
    }

    try {
      // Update catalog with current status
      for (const entry of this.catalog) {
        const wrapper = this.tools.get(entry.name);
        entry.status = wrapper ? 'active' : 'inactive';
        entry.lastSeen = new Date().toISOString();
      }

      // Get current version for optimistic concurrency control
      const current = await this.client.getBreadcrumb(this.catalogBreadcrumbId);
      
      // Add llm_hints for context transformation
      const llmHints = {
        transform: {
          tool_summary: {
            type: 'template',
            template: '{{context.activeTools}} tools available:\n{{#each context.tools}}- {{this.name}} ({{this.category}}): {{this.description}}\n{{/each}}\n\nTo use a tool, create a tool.request.v1 breadcrumb with:\n- tool: the tool name\n- input: parameters matching the inputSchema\n- requestId: unique identifier'
          },
          available_tools: {
            type: 'extract',
            value: '$.tools[*].name'
          },
          categories: {
            type: 'template',
            template: '{{#each context.tools}}{{#unless @first}}, {{/unless}}{{this.category}}{{/each}}'
          }
        },
        mode: 'replace'
      };

      const updatePayload = {
        title: `${this.workspace} Tool Catalog`,
        context: {
          workspace: this.workspace,
          tools: this.catalog,
          totalTools: this.catalog.length,
          activeTools: this.catalog.filter(t => t.status === 'active').length,
          lastUpdated: new Date().toISOString(),
          llm_hints: llmHints
        }
      };
      
      console.log(`[ToolRegistry] DEBUG: Updating catalog breadcrumb with payload:`, {
        ...updatePayload,
        context: {
          ...updatePayload.context,
          tools: updatePayload.context.tools.map(t => ({ name: t.name, status: t.status }))
        }
      });
      
      console.log(`[ToolRegistry] DEBUG: About to call updateBreadcrumb with version ${current.version}`);
      
      const updateResult = await this.client.updateBreadcrumb(
        this.catalogBreadcrumbId, 
        current.version,
        updatePayload
      );
      
      console.log(`[ToolRegistry] DEBUG: Update result:`, updateResult);
      console.log(`[ToolRegistry] ✅ Updated catalog breadcrumb with ${this.catalog.length} tools`);
      
      // Verify the update by reading it back
      const verification = await this.client.getBreadcrumb(this.catalogBreadcrumbId);
      console.log(`[ToolRegistry] DEBUG: Verification - catalog now has ${verification.context?.tools?.length || 0} tools in database`);
      
    } catch (error) {
      console.error('[ToolRegistry] Failed to update catalog:', error);
      // Try to recreate if update failed (maybe breadcrumb was deleted)
      if (error.message?.includes('404') || error.message?.includes('not found')) {
        console.log('[ToolRegistry] Catalog breadcrumb not found, recreating...');
        this.catalogBreadcrumbId = undefined;
        await this.createCatalogBreadcrumb();
      }
    }
  }

  private async performHealthCheck(): Promise<void> {
    console.log('[ToolRegistry] Performing health check...');
    
    for (const [name, _wrapper] of this.tools) {
      try {
        // Simple ping test
        await this.client.createBreadcrumb({
          schema_name: 'tool.request.v1',
          title: `Health Check: ${name}`,
          tags: [this.workspace, 'tool:request', 'health:check'],
          context: {
            tool: name,
            input: { test: true },
            healthCheck: true
          }
        });
      } catch (error) {
        console.error(`[ToolRegistry] Health check failed for ${name}:`, error);
        
        // Update catalog status
        const catalogEntry = this.catalog.find(e => e.name === name);
        if (catalogEntry) {
          catalogEntry.status = 'error';
        }
      }
    }
  }

  async stop(): Promise<void> {
    console.log('[ToolRegistry] Stopping all tools...');
    
    for (const wrapper of this.tools.values()) {
      try {
        await wrapper.stop();
      } catch (error) {
        console.error('[ToolRegistry] Error stopping tool:', error);
      }
    }
    
    this.tools.clear();
    this.catalog = [];
  }

  // Get current tool status
  getToolStatus(): { name: string; status: string; lastSeen?: string }[] {
    return this.catalog.map(entry => ({
      name: entry.name,
      status: entry.status,
      lastSeen: entry.lastSeen
    }));
  }

  // Get tool by name
  getTool(name: string): RCRTToolWrapper | undefined {
    return this.tools.get(name);
  }

  // List all registered tools
  listTools(): string[] {
    return Array.from(this.tools.keys());
  }
}

// Factory function for easy setup
export async function createToolRegistry(
  client: RcrtClientEnhanced,
  workspace: string,
  config: {
    enableUI?: boolean;
    enableBuiltins?: boolean;
    enableLangChain?: boolean;
    langchainConfig?: {
      serpApiKey?: string;
      openaiApiKey?: string;
    };
  } = {}
): Promise<ToolRegistry> {
  const registry = new ToolRegistry(client, workspace, {
    enableUI: config.enableUI,
    catalogUpdateInterval: 60000, // Update every minute
    healthCheckInterval: 300000  // Health check every 5 minutes
  });
  
  await registry.start();
  
  // Register builtin tools
  if (config.enableBuiltins !== false) {
    await registry.registerBuiltinTools();
  }
  
  // Register LangChain tools
  if (config.enableLangChain) {
    await registry.registerLangChainTools(config.langchainConfig || {});
  }
  
  return registry;
}
