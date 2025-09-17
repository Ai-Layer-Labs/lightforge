/**
 * Tool Configuration System for Dashboard v2
 * Allows tools to expose UI variables that can be configured via breadcrumbs
 */

export interface UIVariable {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'secret' | 'json';
  description?: string;
  defaultValue?: any;
  required?: boolean;
  options?: Array<{ value: any; label: string }>; // For select type
  secretName?: string; // For secret type - which RCRT secret to use
  breadcrumbTag?: string; // Which breadcrumb tag to search for value
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: string[];
  };
}

export interface ToolConfig {
  toolName: string;
  variables: UIVariable[];
  configBreadcrumbTag?: string; // Tag to search for config breadcrumbs
  configSchema?: string; // Schema name for config breadcrumbs
}

export interface ToolConfigValue {
  [key: string]: any;
}

/**
 * Enhanced tool configuration that can be managed via Dashboard UI
 */
export class ConfigurableTool {
  abstract name: string;
  abstract description: string;
  abstract category: string;
  
  // Tools can expose UI variables for configuration
  getUIVariables(): UIVariable[] {
    return [];
  }
  
  // Get configuration from breadcrumbs and secrets
  async getConfiguration(context: any): Promise<ToolConfigValue> {
    const config: ToolConfigValue = {};
    const uiVariables = this.getUIVariables();
    
    for (const variable of uiVariables) {
      try {
        let value = variable.defaultValue;
        
        switch (variable.type) {
          case 'secret':
            if (variable.secretName) {
              value = await this.getSecretValue(variable.secretName, context);
            }
            break;
            
          case 'breadcrumb':
            if (variable.breadcrumbTag) {
              value = await this.getBreadcrumbValue(variable.breadcrumbTag, variable.key, context);
            }
            break;
            
          default:
            // For other types, check if there's a config breadcrumb
            if (this.getConfigBreadcrumbTag()) {
              const breadcrumbValue = await this.getBreadcrumbValue(
                this.getConfigBreadcrumbTag()!,
                variable.key,
                context
              );
              if (breadcrumbValue !== undefined) {
                value = breadcrumbValue;
              }
            }
        }
        
        config[variable.key] = value;
      } catch (error) {
        console.warn(`Failed to load config for ${variable.key}:`, error);
        config[variable.key] = variable.defaultValue;
      }
    }
    
    return config;
  }
  
  // Get breadcrumb tag for tool configuration
  protected getConfigBreadcrumbTag(): string | undefined {
    return `tool:config:${this.name}`;
  }
  
  // Get value from RCRT secret
  protected async getSecretValue(secretName: string, context: any): Promise<string> {
    try {
      const secrets = await context.rcrtClient.listSecrets();
      const secret = secrets.find((s: any) => s.name.toLowerCase() === secretName.toLowerCase());
      if (!secret) {
        throw new Error(`Secret ${secretName} not found`);
      }
      
      const decrypted = await context.rcrtClient.getSecret(secret.id, `Tool:${this.name}:config`);
      return decrypted.value;
    } catch (error) {
      throw new Error(`Failed to get secret ${secretName}: ${error.message}`);
    }
  }
  
  // Get value from breadcrumb context
  protected async getBreadcrumbValue(tag: string, key: string, context: any): Promise<any> {
    try {
      const breadcrumbs = await context.rcrtClient.searchBreadcrumbs({ tags: [tag] });
      if (breadcrumbs.length === 0) {
        throw new Error(`No breadcrumb found with tag: ${tag}`);
      }
      
      // Use the most recent breadcrumb
      const latest = breadcrumbs.sort((a: any, b: any) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      )[0];
      
      const fullBreadcrumb = await context.rcrtClient.getBreadcrumb(latest.id);
      return fullBreadcrumb.context?.[key];
    } catch (error) {
      throw new Error(`Failed to get breadcrumb value ${key} from tag ${tag}: ${error.message}`);
    }
  }
}

/**
 * Example: Enhanced OpenRouter tool with UI variables
 */
export class ConfigurableOpenRouterTool extends ConfigurableTool {
  name = 'openrouter';
  description = 'OpenRouter - Access to 100+ LLM models via unified API';
  category = 'llm';
  
  getUIVariables(): UIVariable[] {
    return [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'secret',
        secretName: 'OPENROUTER_API_KEY',
        description: 'OpenRouter API key for authentication',
        required: true,
      },
      {
        key: 'defaultModel',
        label: 'Default Model',
        type: 'select',
        description: 'Default model to use when none specified',
        defaultValue: 'google/gemini-2.5-flash',
        options: [
          { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
          { value: 'anthropic/claude-3-haiku', label: 'Claude 3 Haiku' },
          { value: 'openai/gpt-4o-mini', label: 'GPT-4o Mini' },
          { value: 'openai/gpt-4o', label: 'GPT-4o' },
        ],
      },
      {
        key: 'maxTokens',
        label: 'Max Tokens',
        type: 'number',
        description: 'Maximum tokens per response',
        defaultValue: 4000,
        validation: { min: 1, max: 32000 },
      },
      {
        key: 'temperature',
        label: 'Temperature',
        type: 'number',
        description: 'Response creativity (0.0 - 2.0)',
        defaultValue: 0.7,
        validation: { min: 0, max: 2 },
      },
      {
        key: 'enableCostTracking',
        label: 'Enable Cost Tracking',
        type: 'boolean',
        description: 'Track and log API costs',
        defaultValue: true,
      },
      {
        key: 'customEndpoint',
        label: 'Custom Endpoint',
        type: 'string',
        description: 'Custom API endpoint (optional)',
        defaultValue: 'https://openrouter.ai/api/v1/chat/completions',
      },
    ];
  }
}

/**
 * Tool configuration manager for Dashboard v2
 */
export class ToolConfigManager {
  static async loadToolConfig(toolName: string, context: any): Promise<ToolConfigValue> {
    // This would be implemented to load tool config from breadcrumbs
    // For now, return empty config
    return {};
  }
  
  static async saveToolConfig(toolName: string, config: ToolConfigValue, context: any): Promise<void> {
    // This would save tool config to a breadcrumb
    // Schema: tool.config.v1
    // Tags: tool:config, tool:config:{toolName}
  }
}
