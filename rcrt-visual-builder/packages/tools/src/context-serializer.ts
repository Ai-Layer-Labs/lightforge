/**
 * Context Serializer
 * Builds serializable execution context for Deno tools
 * Provides HTTP API wrapper for RCRT operations
 */

import { RcrtClientEnhanced } from '@rcrt-builder/sdk';

/**
 * Tool execution context passed to Deno process
 * Must be fully serializable (JSON-compatible)
 */
export interface ToolExecutionContext {
  // HTTP API for RCRT operations
  api: {
    baseUrl: string;
    token: string;
  };
  
  // Secrets (decrypted by tools-runner before passing)
  secrets: Record<string, string>;
  
  // Request metadata
  request: {
    id: string;
    workspace: string;
    agentId?: string;
    trigger_event?: any;
  };
  
  // Utility functions available in context
  utils: {
    waitForEventSupported: boolean;
  };
}

/**
 * Context serializer class
 * Converts RcrtClientEnhanced and secrets into serializable context
 */
export class ContextSerializer {
  constructor(
    private client: RcrtClientEnhanced,
    private workspace: string
  ) {}
  
  /**
   * Build execution context for a tool
   */
  async buildContext(
    requestId: string,
    agentId: string | undefined,
    requiredSecrets: string[],
    triggerEvent?: any
  ): Promise<ToolExecutionContext> {
    // Get authentication token
    const token = await this.client.getToken();
    if (!token) {
      throw new Error('No authentication token available');
    }
    
    // Fetch required secrets
    const secrets: Record<string, string> = {};
    for (const secretName of requiredSecrets) {
      try {
        const decrypted = await this.getSecret(secretName);
        secrets[secretName] = decrypted;
      } catch (error) {
        console.warn(`Failed to load secret ${secretName}:`, error);
        // Continue - tool will handle missing secret
      }
    }
    
    // Build serializable context
    return {
      api: {
        baseUrl: this.client['baseUrl'], // Access private property
        token
      },
      secrets,
      request: {
        id: requestId,
        workspace: this.workspace,
        agentId,
        trigger_event: triggerEvent
      },
      utils: {
        waitForEventSupported: false // Will be implemented in Phase 5
      }
    };
  }
  
  /**
   * Get secret by name
   * First tries RCRT secrets API, falls back to env vars
   */
  private async getSecret(secretName: string): Promise<string> {
    try {
      // Try to find secret breadcrumb by name
      // Get all secrets for the authenticated owner (no scope filtering needed)
      const secrets = await this.client.listSecrets();
      const secret = secrets.find(s => s.name === secretName);
      
      if (secret) {
        const decrypted = await this.client.getSecret(
          secret.id,
          `ToolExecution:${secretName}`
        );
        return decrypted.value;
      }
    } catch (error) {
      console.warn(`RCRT secrets lookup failed for ${secretName}:`, error);
    }
    
    // Fallback to environment variables
    const envValue = process.env[secretName];
    if (envValue) {
      return envValue;
    }
    
    throw new Error(`Secret not found: ${secretName}`);
  }
  
  /**
   * Generate context API wrapper code
   * This code will be injected into the Deno execution environment
   */
  static generateContextApiWrapper(): string {
    return `
// RCRT API Wrapper for Deno Tools
// Auto-generated - do not modify

const API_BASE_URL = CONTEXT_API_BASE_URL;
const API_TOKEN = CONTEXT_API_TOKEN;

const api = {
  /**
   * Get a single breadcrumb by ID
   */
  async getBreadcrumb(id: string): Promise<any> {
    const response = await fetch(\`\${API_BASE_URL}/breadcrumbs/\${id}\`, {
      headers: {
        'Authorization': \`Bearer \${API_TOKEN}\`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(\`Failed to get breadcrumb: \${response.status}\`);
    }
    
    return await response.json();
  },
  
  /**
   * Create a new breadcrumb
   */
  async createBreadcrumb(data: any): Promise<{ id: string }> {
    const response = await fetch(\`\${API_BASE_URL}/breadcrumbs\`, {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${API_TOKEN}\`,
        'Content-Type': 'application/json',
        'Idempotency-Key': \`tool-\${crypto.randomUUID()}\`
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(\`Failed to create breadcrumb: \${response.status} - \${error}\`);
    }
    
    return await response.json();
  },
  
  /**
   * Update an existing breadcrumb
   */
  async updateBreadcrumb(id: string, version: number, updates: any): Promise<void> {
    const response = await fetch(\`\${API_BASE_URL}/breadcrumbs/\${id}\`, {
      method: 'PATCH',
      headers: {
        'Authorization': \`Bearer \${API_TOKEN}\`,
        'Content-Type': 'application/json',
        'If-Match': version.toString()
      },
      body: JSON.stringify(updates)
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(\`Failed to update breadcrumb: \${response.status} - \${error}\`);
    }
  },
  
  /**
   * Delete a breadcrumb
   */
  async deleteBreadcrumb(id: string, version?: number): Promise<void> {
    const headers: Record<string, string> = {
      'Authorization': \`Bearer \${API_TOKEN}\`,
      'Content-Type': 'application/json'
    };
    
    if (version !== undefined) {
      headers['If-Match'] = version.toString();
    }
    
    const response = await fetch(\`\${API_BASE_URL}/breadcrumbs/\${id}\`, {
      method: 'DELETE',
      headers
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(\`Failed to delete breadcrumb: \${response.status} - \${error}\`);
    }
  },
  
  /**
   * Search breadcrumbs
   */
  async searchBreadcrumbs(params: any): Promise<any[]> {
    const queryParams = new URLSearchParams();
    
    if (params.schema_name) queryParams.set('schema_name', params.schema_name);
    if (params.tag) queryParams.set('tag', params.tag);
    if (params.limit) queryParams.set('limit', params.limit.toString());
    if (params.offset) queryParams.set('offset', params.offset.toString());
    
    const response = await fetch(\`\${API_BASE_URL}/breadcrumbs?\${queryParams}\`, {
      headers: {
        'Authorization': \`Bearer \${API_TOKEN}\`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(\`Failed to search breadcrumbs: \${response.status}\`);
    }
    
    return await response.json();
  },
  
  /**
   * Vector search breadcrumbs
   */
  async vectorSearch(params: any): Promise<any[]> {
    const queryParams = new URLSearchParams();
    
    if (params.q) queryParams.set('q', params.q);
    if (params.qvec) queryParams.set('qvec', JSON.stringify(params.qvec));
    if (params.nn) queryParams.set('nn', params.nn.toString());
    if (params.tag) queryParams.set('tag', params.tag);
    if (params.schema_name) queryParams.set('schema_name', params.schema_name);
    queryParams.set('include_context', 'true');
    
    const response = await fetch(\`\${API_BASE_URL}/breadcrumbs/search?\${queryParams}\`, {
      headers: {
        'Authorization': \`Bearer \${API_TOKEN}\`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(\`Failed to vector search: \${response.status}\`);
    }
    
    return await response.json();
  },
  
  /**
   * Decrypt a secret by ID
   */
  async decryptSecret(secretId: string, reason: string): Promise<{ value: string }> {
    const response = await fetch(\`\${API_BASE_URL}/secrets/\${secretId}/decrypt\`, {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${API_TOKEN}\`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason: reason || 'Tool execution' })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(\`Failed to decrypt secret: \${response.status} - \${error}\`);
    }
    
    return await response.json();
  },
  
  /**
   * Get a secret by ID (alias for decryptSecret)
   */
  async getSecret(secretId: string, reason: string): Promise<{ value: string }> {
    return this.decryptSecret(secretId, reason);
  }
};
`;
  }
}

